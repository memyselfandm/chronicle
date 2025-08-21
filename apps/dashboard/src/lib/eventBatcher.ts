/**
 * High-performance event batching system for Chronicle Dashboard
 * Handles burst event processing with configurable windowing and ordering
 */

import {
  BatchConfig,
  EventBatch,
  EventProcessingResult,
  ProcessingError,
  DEFAULT_BATCH_CONFIG,
  isValidEvent
} from '../types/chronicle';

/**
 * Event batcher for high-performance real-time event processing
 * Implements 100ms windowing with burst handling and order preservation
 */
export class EventBatcher {
  private config: BatchConfig;
  private currentBatch: any[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private windowStart: Date | null = null;
  private isProcessing = false;
  private eventQueue: any[] = [];
  private processedCount = 0;
  private errorCount = 0;
  private listeners: Set<(batch: EventBatch) => void> = new Set();
  private performanceMetrics: {
    batchProcessingTimes: number[];
    averageEventLatency: number;
    throughput: number;
    lastProcessedAt: Date | null;
  } = {
    batchProcessingTimes: [],
    averageEventLatency: 0,
    throughput: 0,
    lastProcessedAt: null
  };

  constructor(config: Partial<BatchConfig> = {}) {
    this.config = { ...DEFAULT_BATCH_CONFIG, ...config };
  }

  /**
   * Add event to the batching queue
   * Handles high-frequency events with automatic flushing
   */
  public addEvent(event: any): void {
    if (!isValidEvent(event)) {
      console.warn('EventBatcher: Invalid event received', event);
      return;
    }

    // Add timestamp for latency tracking
    const eventWithMetadata = {
      ...event,
      _batchedAt: new Date(),
      _receivedAt: new Date(event.timestamp)
    };

    this.eventQueue.push(eventWithMetadata);
    this.processEventQueue();
  }

  /**
   * Add multiple events at once (batch add)
   */
  public addEvents(events: any[]): void {
    const validEvents = events.filter(isValidEvent);
    if (validEvents.length !== events.length) {
      console.warn(`EventBatcher: ${events.length - validEvents.length} invalid events filtered out`);
    }

    const eventsWithMetadata = validEvents.map(event => ({
      ...event,
      _batchedAt: new Date(),
      _receivedAt: new Date(event.timestamp)
    }));

    this.eventQueue.push(...eventsWithMetadata);
    this.processEventQueue();
  }

  /**
   * Process the event queue with intelligent batching
   */
  private processEventQueue(): void {
    if (this.isProcessing || this.eventQueue.length === 0) {
      return;
    }

    // Handle burst scenario (>200 events/min = ~3.33 events/sec)
    const now = new Date();
    if (this.eventQueue.length > 10) {
      // Immediate flush for burst scenarios
      this.flushCurrentBatch();
      return;
    }

    // Initialize batch window if needed
    if (!this.windowStart) {
      this.windowStart = now;
      this.startBatchTimer();
    }

    // Move events from queue to current batch
    while (this.eventQueue.length > 0 && this.currentBatch.length < this.config.maxBatchSize) {
      this.currentBatch.push(this.eventQueue.shift());
    }

    // Flush if batch is full
    if (this.currentBatch.length >= this.config.maxBatchSize) {
      this.flushCurrentBatch();
    }
  }

  /**
   * Start the batch timer for windowed processing
   */
  private startBatchTimer(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    this.batchTimer = setTimeout(() => {
      this.flushCurrentBatch();
    }, this.config.windowMs);
  }

  /**
   * Flush the current batch and notify listeners
   */
  private flushCurrentBatch(): void {
    if (this.currentBatch.length === 0) {
      return;
    }

    this.isProcessing = true;
    const startTime = performance.now();

    try {
      // Preserve chronological order if configured
      if (this.config.preserveOrder) {
        this.currentBatch.sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
      }

      const batch: EventBatch = {
        id: this.generateBatchId(),
        events: [...this.currentBatch],
        batchedAt: new Date(),
        windowStart: this.windowStart || new Date(),
        windowEnd: new Date(),
        size: this.currentBatch.length
      };

      // Calculate performance metrics
      this.updatePerformanceMetrics(batch, startTime);

      // Notify all listeners
      this.listeners.forEach(listener => {
        try {
          listener(batch);
        } catch (error) {
          console.error('EventBatcher: Listener error', error);
          this.errorCount++;
        }
      });

      this.processedCount += batch.size;
      this.performanceMetrics.lastProcessedAt = new Date();

    } catch (error) {
      console.error('EventBatcher: Batch processing error', error);
      this.errorCount++;
    } finally {
      // Reset batch state
      this.currentBatch = [];
      this.windowStart = null;
      this.isProcessing = false;

      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
        this.batchTimer = null;
      }

      // Continue processing queue if more events are waiting
      if (this.eventQueue.length > 0) {
        // Use setTimeout to prevent stack overflow in high-frequency scenarios
        setTimeout(() => this.processEventQueue(), 0);
      }
    }
  }

  /**
   * Update performance metrics for monitoring
   */
  private updatePerformanceMetrics(batch: EventBatch, startTime: number): void {
    const processingTime = performance.now() - startTime;
    
    // Track batch processing times (keep last 100)
    this.performanceMetrics.batchProcessingTimes.push(processingTime);
    if (this.performanceMetrics.batchProcessingTimes.length > 100) {
      this.performanceMetrics.batchProcessingTimes.shift();
    }

    // Calculate average event latency
    const totalLatency = batch.events.reduce((sum, event) => {
      const latency = batch.batchedAt.getTime() - event._receivedAt.getTime();
      return sum + latency;
    }, 0);
    this.performanceMetrics.averageEventLatency = totalLatency / batch.events.length;

    // Calculate throughput (events per second)
    const timeSinceLastBatch = this.performanceMetrics.lastProcessedAt
      ? batch.batchedAt.getTime() - this.performanceMetrics.lastProcessedAt.getTime()
      : 1000;
    this.performanceMetrics.throughput = (batch.size / timeSinceLastBatch) * 1000;
  }

  /**
   * Generate unique batch ID
   */
  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Subscribe to batch processing events
   */
  public subscribe(listener: (batch: EventBatch) => void): () => void {
    this.listeners.add(listener);
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Force flush current batch (useful for testing or cleanup)
   */
  public flush(): void {
    if (this.currentBatch.length > 0 || this.eventQueue.length > 0) {
      // Move any queued events to current batch
      this.currentBatch.push(...this.eventQueue);
      this.eventQueue = [];
      this.flushCurrentBatch();
    }
  }

  /**
   * Get current performance metrics
   */
  public getMetrics(): typeof this.performanceMetrics & {
    queueLength: number;
    currentBatchSize: number;
    processedCount: number;
    errorCount: number;
    averageProcessingTime: number;
  } {
    const averageProcessingTime = this.performanceMetrics.batchProcessingTimes.length > 0
      ? this.performanceMetrics.batchProcessingTimes.reduce((a, b) => a + b, 0) / 
        this.performanceMetrics.batchProcessingTimes.length
      : 0;

    return {
      ...this.performanceMetrics,
      queueLength: this.eventQueue.length,
      currentBatchSize: this.currentBatch.length,
      processedCount: this.processedCount,
      errorCount: this.errorCount,
      averageProcessingTime
    };
  }

  /**
   * Update configuration at runtime
   */
  public updateConfig(newConfig: Partial<BatchConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  public getConfig(): BatchConfig {
    return { ...this.config };
  }

  /**
   * Clear all metrics and reset state
   */
  public reset(): void {
    this.flush(); // Flush any pending events first
    
    this.processedCount = 0;
    this.errorCount = 0;
    this.performanceMetrics = {
      batchProcessingTimes: [],
      averageEventLatency: 0,
      throughput: 0,
      lastProcessedAt: null
    };
  }

  /**
   * Check if batcher is healthy (processing events within acceptable time)
   */
  public isHealthy(): boolean {
    const metrics = this.getMetrics();
    
    // Consider unhealthy if:
    // - Queue is backing up (>100 events)
    // - Average processing time is too high (>50ms)
    // - No events processed in last 30 seconds (if events were received)
    // - Memory pressure from large queue
    const queueBacklog = metrics.queueLength > 100;
    const slowProcessing = metrics.averageProcessingTime > 50;
    const staleProcessing = metrics.lastProcessedAt && 
      (Date.now() - metrics.lastProcessedAt.getTime()) > 30000;
    const memoryPressure = this.getMemoryPressure() > 0.8; // 80% threshold

    return !queueBacklog && !slowProcessing && !staleProcessing && !memoryPressure;
  }

  /**
   * Calculate memory pressure from queue size and event data
   */
  private getMemoryPressure(): number {
    const queueSize = this.eventQueue.length + this.currentBatch.length;
    const maxRecommendedQueue = 200; // Recommended max queue size
    
    return Math.min(1, queueSize / maxRecommendedQueue);
  }

  /**
   * Get memory optimization recommendations
   */
  public getMemoryOptimizationTips(): {
    shouldFlushImmediately: boolean;
    shouldReduceBatchSize: boolean;
    shouldIncreaseFlushFrequency: boolean;
    memoryPressure: number;
  } {
    const metrics = this.getMetrics();
    const memoryPressure = this.getMemoryPressure();
    
    return {
      shouldFlushImmediately: metrics.queueLength > 150,
      shouldReduceBatchSize: memoryPressure > 0.7,
      shouldIncreaseFlushFrequency: metrics.averageProcessingTime > 30,
      memoryPressure,
    };
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.flush();
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    this.listeners.clear();
    this.currentBatch = [];
    this.eventQueue = [];
  }
}

/**
 * Create a singleton instance for the application
 */
let globalEventBatcher: EventBatcher | null = null;

export const getEventBatcher = (config?: Partial<BatchConfig>): EventBatcher => {
  if (!globalEventBatcher) {
    globalEventBatcher = new EventBatcher(config);
  }
  return globalEventBatcher;
};

/**
 * Reset the global instance (useful for testing)
 */
export const resetEventBatcher = (): void => {
  if (globalEventBatcher) {
    globalEventBatcher.destroy();
    globalEventBatcher = null;
  }
};