/**
 * Standalone Event Queue for Chronicle Dashboard
 * Handles event queuing during disconnection with persistence and retry logic
 */

import { EventHandler, UnsubscribeFunction } from '@/types/chronicle';

export interface QueuedEvent {
  id: string;
  event: any;
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
  priority: 'high' | 'normal' | 'low';
}

export interface EventQueueConfig {
  maxQueueSize: number;
  persistToStorage: boolean;
  storageKey: string;
  retryDelayMs: number;
  maxRetryAttempts: number;
  priorityLevels: boolean;
}

export interface EventQueueMetrics {
  totalEnqueued: number;
  totalDequeued: number;
  currentSize: number;
  failedEvents: number;
  retriedEvents: number;
  lastFlushTime: Date | null;
  memoryUsage: number;
}

const DEFAULT_CONFIG: EventQueueConfig = {
  maxQueueSize: 1000,
  persistToStorage: true,
  storageKey: 'chronicle-event-queue',
  retryDelayMs: 1000,
  maxRetryAttempts: 3,
  priorityLevels: true
};

/**
 * High-performance event queue with persistence and retry capabilities
 * Designed for robust handling of events during connection interruptions
 */
export class EventQueue {
  private queue: Map<string, QueuedEvent> = new Map();
  private config: EventQueueConfig;
  private listeners: Set<EventHandler<QueuedEvent[]>> = new Set();
  private metrics: EventQueueMetrics;
  private retryTimer: NodeJS.Timeout | null = null;
  private isProcessingRetries = false;

  constructor(config: Partial<EventQueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.metrics = this.createInitialMetrics();
    
    // Load persisted queue on initialization
    if (this.config.persistToStorage) {
      this.loadFromStorage();
    }
  }

  /**
   * Add event to the queue with automatic deduplication
   */
  public enqueue(event: any, priority: 'high' | 'normal' | 'low' = 'normal'): boolean {
    // Check queue size limit
    if (this.queue.size >= this.config.maxQueueSize) {
      this.evictOldestEvents();
    }

    const eventId = this.generateEventId(event);
    
    // Prevent duplicate events
    if (this.queue.has(eventId)) {
      return false;
    }

    const queuedEvent: QueuedEvent = {
      id: eventId,
      event: { ...event },
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: this.config.maxRetryAttempts,
      priority
    };

    this.queue.set(eventId, queuedEvent);
    this.metrics.totalEnqueued++;
    this.updateMemoryUsage();

    // Persist to storage
    if (this.config.persistToStorage) {
      this.persistToStorage();
    }

    // Notify listeners of queue change
    this.notifyQueueChange();

    return true;
  }

  /**
   * Dequeue events in priority order
   */
  public dequeue(count?: number): QueuedEvent[] {
    if (this.queue.size === 0) {
      return [];
    }

    // Sort events by priority and timestamp
    const sortedEvents = Array.from(this.queue.values()).sort((a, b) => {
      // Priority order: high -> normal -> low
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      
      // Same priority, sort by timestamp (oldest first)
      return a.timestamp.getTime() - b.timestamp.getTime();
    });

    const eventsToDequeue = count ? sortedEvents.slice(0, count) : sortedEvents;
    
    // Remove from queue
    eventsToDequeue.forEach(event => {
      this.queue.delete(event.id);
      this.metrics.totalDequeued++;
    });

    this.updateMemoryUsage();

    // Update storage
    if (this.config.persistToStorage) {
      this.persistToStorage();
    }

    this.notifyQueueChange();

    return eventsToDequeue;
  }

  /**
   * Flush all events from the queue
   */
  public flush(): QueuedEvent[] {
    const allEvents = this.dequeue();
    this.metrics.lastFlushTime = new Date();
    
    return allEvents;
  }

  /**
   * Peek at events without removing them
   */
  public peek(count: number = 10): QueuedEvent[] {
    return Array.from(this.queue.values())
      .sort((a, b) => {
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        return priorityDiff !== 0 ? priorityDiff : a.timestamp.getTime() - b.timestamp.getTime();
      })
      .slice(0, count);
  }

  /**
   * Retry failed events with exponential backoff
   */
  public retryFailedEvents(): void {
    if (this.isProcessingRetries) {
      return;
    }

    this.isProcessingRetries = true;
    const now = new Date();
    const eventsToRetry: QueuedEvent[] = [];

    this.queue.forEach(queuedEvent => {
      if (queuedEvent.retryCount > 0 && queuedEvent.retryCount < queuedEvent.maxRetries) {
        const timeSinceLastRetry = now.getTime() - queuedEvent.timestamp.getTime();
        const retryDelay = this.config.retryDelayMs * Math.pow(2, queuedEvent.retryCount - 1);
        
        if (timeSinceLastRetry >= retryDelay) {
          eventsToRetry.push(queuedEvent);
        }
      }
    });

    if (eventsToRetry.length > 0) {
      this.metrics.retriedEvents += eventsToRetry.length;
      this.notifyRetryEvents(eventsToRetry);
    }

    this.isProcessingRetries = false;

    // Schedule next retry check
    this.scheduleRetryCheck();
  }

  /**
   * Mark events as failed (increment retry count)
   */
  public markEventsFailed(eventIds: string[]): void {
    eventIds.forEach(id => {
      const queuedEvent = this.queue.get(id);
      if (queuedEvent) {
        queuedEvent.retryCount++;
        queuedEvent.timestamp = new Date();
        
        if (queuedEvent.retryCount >= queuedEvent.maxRetries) {
          // Remove permanently failed events
          this.queue.delete(id);
          this.metrics.failedEvents++;
        }
      }
    });

    if (this.config.persistToStorage) {
      this.persistToStorage();
    }

    this.notifyQueueChange();
  }

  /**
   * Get current queue metrics
   */
  public getMetrics(): EventQueueMetrics {
    return {
      ...this.metrics,
      currentSize: this.queue.size,
      memoryUsage: this.calculateMemoryUsage()
    };
  }

  /**
   * Get events by priority
   */
  public getEventsByPriority(priority: 'high' | 'normal' | 'low'): QueuedEvent[] {
    return Array.from(this.queue.values()).filter(event => event.priority === priority);
  }

  /**
   * Clear all events from queue
   */
  public clear(): void {
    const clearedCount = this.queue.size;
    this.queue.clear();
    this.metrics.failedEvents += clearedCount;

    if (this.config.persistToStorage) {
      this.clearStorage();
    }

    this.notifyQueueChange();
  }

  /**
   * Subscribe to queue changes
   */
  public subscribe(listener: EventHandler<QueuedEvent[]>): UnsubscribeFunction {
    this.listeners.add(listener);
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Check if queue is empty
   */
  public isEmpty(): boolean {
    return this.queue.size === 0;
  }

  /**
   * Check if queue is at capacity
   */
  public isFull(): boolean {
    return this.queue.size >= this.config.maxQueueSize;
  }

  /**
   * Get queue health status
   */
  public getHealthStatus(): {
    isHealthy: boolean;
    warnings: string[];
    memoryPressure: number;
  } {
    const metrics = this.getMetrics();
    const warnings: string[] = [];
    const memoryPressure = metrics.memoryUsage / (10 * 1024 * 1024); // 10MB threshold

    if (metrics.currentSize > this.config.maxQueueSize * 0.8) {
      warnings.push('Queue is near capacity');
    }

    if (memoryPressure > 0.8) {
      warnings.push('High memory usage detected');
    }

    if (metrics.failedEvents > 100) {
      warnings.push('High number of failed events');
    }

    const isHealthy = warnings.length === 0 && memoryPressure < 0.5;

    return {
      isHealthy,
      warnings,
      memoryPressure
    };
  }

  /**
   * Update queue configuration
   */
  public updateConfig(newConfig: Partial<EventQueueConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Adjust queue size if needed
    if (this.queue.size > this.config.maxQueueSize) {
      this.evictOldestEvents();
    }
  }

  /**
   * Destroy queue and cleanup resources
   */
  public destroy(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    this.listeners.clear();
    this.queue.clear();

    if (this.config.persistToStorage) {
      this.clearStorage();
    }
  }

  // Private methods

  private generateEventId(event: any): string {
    const timestamp = event.timestamp || new Date().toISOString();
    const sessionId = event.session_id || 'unknown';
    const eventType = event.event_type || 'unknown';
    const hash = this.simpleHash(`${timestamp}-${sessionId}-${eventType}`);
    return `event_${hash}_${Date.now()}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private evictOldestEvents(): void {
    const sortedEvents = Array.from(this.queue.entries()).sort(
      ([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    // Remove oldest 10% of events
    const evictCount = Math.floor(this.queue.size * 0.1);
    for (let i = 0; i < evictCount; i++) {
      const [eventId] = sortedEvents[i];
      this.queue.delete(eventId);
    }
  }

  private persistToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const queueData = {
        events: Array.from(this.queue.entries()),
        timestamp: new Date().toISOString()
      };
      
      localStorage.setItem(this.config.storageKey, JSON.stringify(queueData));
    } catch (error) {
      console.warn('EventQueue: Failed to persist to storage', error);
    }
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(this.config.storageKey);
      if (stored) {
        const queueData = JSON.parse(stored);
        
        // Restore events
        queueData.events.forEach(([id, event]: [string, QueuedEvent]) => {
          // Restore Date objects
          event.timestamp = new Date(event.timestamp);
          this.queue.set(id, event);
        });

        this.updateMemoryUsage();
      }
    } catch (error) {
      console.warn('EventQueue: Failed to load from storage', error);
    }
  }

  private clearStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem(this.config.storageKey);
    } catch (error) {
      console.warn('EventQueue: Failed to clear storage', error);
    }
  }

  private createInitialMetrics(): EventQueueMetrics {
    return {
      totalEnqueued: 0,
      totalDequeued: 0,
      currentSize: 0,
      failedEvents: 0,
      retriedEvents: 0,
      lastFlushTime: null,
      memoryUsage: 0
    };
  }

  private updateMemoryUsage(): void {
    this.metrics.memoryUsage = this.calculateMemoryUsage();
  }

  private calculateMemoryUsage(): number {
    // Rough estimate of memory usage
    let totalSize = 0;
    this.queue.forEach(event => {
      totalSize += JSON.stringify(event).length * 2; // Approximate UTF-16 encoding
    });
    return totalSize;
  }

  private scheduleRetryCheck(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }

    this.retryTimer = setTimeout(() => {
      this.retryFailedEvents();
    }, this.config.retryDelayMs);
  }

  private notifyQueueChange(): void {
    const events = Array.from(this.queue.values());
    this.listeners.forEach(listener => {
      try {
        listener(events);
      } catch (error) {
        console.error('EventQueue: Listener error', error);
      }
    });
  }

  private notifyRetryEvents(events: QueuedEvent[]): void {
    this.listeners.forEach(listener => {
      try {
        listener(events, { type: 'retry' });
      } catch (error) {
        console.error('EventQueue: Retry listener error', error);
      }
    });
  }
}

/**
 * Create singleton instance for global use
 */
let globalEventQueue: EventQueue | null = null;

export const getEventQueue = (config?: Partial<EventQueueConfig>): EventQueue => {
  if (!globalEventQueue) {
    globalEventQueue = new EventQueue(config);
  }
  return globalEventQueue;
};

export const resetEventQueue = (): void => {
  if (globalEventQueue) {
    globalEventQueue.destroy();
    globalEventQueue = null;
  }
};