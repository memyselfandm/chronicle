/**
 * Performance monitoring and alerting system for Chronicle Dashboard
 * Tracks frame rate, memory usage, and component render performance
 */

export interface PerformanceMetrics {
  frameRate: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  renderTimes: {
    average: number;
    max: number;
    p95: number;
  };
  eventThroughput: {
    eventsPerSecond: number;
    droppedEvents: number;
  };
  componentMetrics: Map<string, ComponentMetrics>;
}

export interface ComponentMetrics {
  name: string;
  renderCount: number;
  averageRenderTime: number;
  maxRenderTime: number;
  lastRenderTime: number;
  mountTime: number;
}

export interface PerformanceAlert {
  type: 'warning' | 'critical';
  metric: string;
  value: number;
  threshold: number;
  timestamp: Date;
  message: string;
}

export interface PerformanceConfig {
  frameRateTarget: number;
  memoryThreshold: number;
  renderTimeThreshold: number;
  throughputThreshold: number;
  alertingEnabled: boolean;
  samplingInterval: number;
}

const DEFAULT_CONFIG: PerformanceConfig = {
  frameRateTarget: 60,
  memoryThreshold: 100, // MB
  renderTimeThreshold: 16, // ms (60fps)
  throughputThreshold: 200, // events per minute
  alertingEnabled: true,
  samplingInterval: 1000, // ms
};

class PerformanceMonitor {
  private config: PerformanceConfig;
  private metrics: PerformanceMetrics;
  private frameRateBuffer: number[] = [];
  private renderTimeBuffer: number[] = [];
  private componentMetrics = new Map<string, ComponentMetrics>();
  private alerts: PerformanceAlert[] = [];
  private listeners: Set<(metrics: PerformanceMetrics) => void> = new Set();
  private alertListeners: Set<(alert: PerformanceAlert) => void> = new Set();
  private isMonitoring = false;
  private animationFrameId: number | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private lastFrameTime = 0;
  private eventCounter = { count: 0, lastReset: Date.now() };

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.metrics = this.createEmptyMetrics();
  }

  private createEmptyMetrics(): PerformanceMetrics {
    return {
      frameRate: 0,
      memoryUsage: { used: 0, total: 0, percentage: 0 },
      renderTimes: { average: 0, max: 0, p95: 0 },
      eventThroughput: { eventsPerSecond: 0, droppedEvents: 0 },
      componentMetrics: new Map(),
    };
  }

  /**
   * Start performance monitoring
   */
  public start(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.startFrameRateMonitoring();
    this.startMetricsCollection();
  }

  /**
   * Stop performance monitoring
   */
  public stop(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Track component render performance
   */
  public trackComponentRender(componentName: string, renderTime: number): void {
    const existing = this.componentMetrics.get(componentName);
    
    if (existing) {
      existing.renderCount++;
      existing.lastRenderTime = renderTime;
      existing.maxRenderTime = Math.max(existing.maxRenderTime, renderTime);
      existing.averageRenderTime = 
        (existing.averageRenderTime * (existing.renderCount - 1) + renderTime) / existing.renderCount;
    } else {
      this.componentMetrics.set(componentName, {
        name: componentName,
        renderCount: 1,
        averageRenderTime: renderTime,
        maxRenderTime: renderTime,
        lastRenderTime: renderTime,
        mountTime: Date.now(),
      });
    }

    this.renderTimeBuffer.push(renderTime);
    if (this.renderTimeBuffer.length > 100) {
      this.renderTimeBuffer.shift();
    }

    // Check for performance issues
    if (renderTime > this.config.renderTimeThreshold) {
      this.createAlert('warning', 'renderTime', renderTime, this.config.renderTimeThreshold,
        `Component ${componentName} render time exceeded threshold`);
    }
  }

  /**
   * Track event processing
   */
  public trackEvent(): void {
    this.eventCounter.count++;
    
    // Reset counter every minute to calculate events per second
    const now = Date.now();
    if (now - this.eventCounter.lastReset > 60000) {
      const eventsPerSecond = this.eventCounter.count / 60;
      this.metrics.eventThroughput.eventsPerSecond = eventsPerSecond;
      
      if (eventsPerSecond > this.config.throughputThreshold / 60) {
        this.createAlert('warning', 'throughput', eventsPerSecond, this.config.throughputThreshold / 60,
          'Event throughput exceeding threshold');
      }
      
      this.eventCounter = { count: 0, lastReset: now };
    }
  }

  /**
   * Get current performance metrics
   */
  public getMetrics(): PerformanceMetrics {
    return {
      ...this.metrics,
      componentMetrics: new Map(this.componentMetrics),
    };
  }

  /**
   * Get performance alerts
   */
  public getAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  /**
   * Clear performance alerts
   */
  public clearAlerts(): void {
    this.alerts = [];
  }

  /**
   * Subscribe to metrics updates
   */
  public subscribe(listener: (metrics: PerformanceMetrics) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Subscribe to performance alerts
   */
  public subscribeToAlerts(listener: (alert: PerformanceAlert) => void): () => void {
    this.alertListeners.add(listener);
    return () => this.alertListeners.delete(listener);
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  private startFrameRateMonitoring(): void {
    const measureFrameRate = (timestamp: number) => {
      if (this.lastFrameTime > 0) {
        const delta = timestamp - this.lastFrameTime;
        const fps = 1000 / delta;
        
        this.frameRateBuffer.push(fps);
        if (this.frameRateBuffer.length > 60) {
          this.frameRateBuffer.shift();
        }
        
        const averageFps = this.frameRateBuffer.reduce((sum, fps) => sum + fps, 0) / this.frameRateBuffer.length;
        this.metrics.frameRate = averageFps;
        
        if (averageFps < this.config.frameRateTarget - 10) {
          this.createAlert('warning', 'frameRate', averageFps, this.config.frameRateTarget,
            'Frame rate dropped below target');
        }
      }
      
      this.lastFrameTime = timestamp;
      
      if (this.isMonitoring) {
        this.animationFrameId = requestAnimationFrame(measureFrameRate);
      }
    };

    this.animationFrameId = requestAnimationFrame(measureFrameRate);
  }

  private startMetricsCollection(): void {
    this.intervalId = setInterval(() => {
      this.updateMemoryMetrics();
      this.updateRenderMetrics();
      this.notifyListeners();
    }, this.config.samplingInterval);
  }

  private updateMemoryMetrics(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const used = memory.usedJSHeapSize / (1024 * 1024); // MB
      const total = memory.totalJSHeapSize / (1024 * 1024); // MB
      
      this.metrics.memoryUsage = {
        used,
        total,
        percentage: (used / total) * 100,
      };
      
      if (used > this.config.memoryThreshold) {
        this.createAlert('critical', 'memory', used, this.config.memoryThreshold,
          'Memory usage exceeded threshold');
      }
    }
  }

  private updateRenderMetrics(): void {
    if (this.renderTimeBuffer.length > 0) {
      const sorted = [...this.renderTimeBuffer].sort((a, b) => a - b);
      const average = this.renderTimeBuffer.reduce((sum, time) => sum + time, 0) / this.renderTimeBuffer.length;
      const max = Math.max(...this.renderTimeBuffer);
      const p95Index = Math.floor(sorted.length * 0.95);
      const p95 = sorted[p95Index] || 0;
      
      this.metrics.renderTimes = { average, max, p95 };
    }
  }

  private createAlert(
    type: 'warning' | 'critical',
    metric: string,
    value: number,
    threshold: number,
    message: string
  ): void {
    if (!this.config.alertingEnabled) return;

    const alert: PerformanceAlert = {
      type,
      metric,
      value,
      threshold,
      timestamp: new Date(),
      message,
    };

    this.alerts.push(alert);
    
    // Keep only the last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts.shift();
    }

    this.alertListeners.forEach(listener => {
      try {
        listener(alert);
      } catch (error) {
        console.error('Performance alert listener error:', error);
      }
    });
  }

  private notifyListeners(): void {
    const metrics = this.getMetrics();
    this.listeners.forEach(listener => {
      try {
        listener(metrics);
      } catch (error) {
        console.error('Performance metrics listener error:', error);
      }
    });
  }

  /**
   * Create a performance profiler for component usage
   */
  public createProfiler(componentName: string) {
    return {
      start: () => {
        const startTime = performance.now();
        return {
          end: () => {
            const endTime = performance.now();
            const renderTime = endTime - startTime;
            this.trackComponentRender(componentName, renderTime);
            return renderTime;
          }
        };
      }
    };
  }

  /**
   * Get performance summary for dashboard display
   */
  public getPerformanceSummary() {
    const metrics = this.getMetrics();
    const alerts = this.getAlerts();
    const criticalAlerts = alerts.filter(a => a.type === 'critical').length;
    const warningAlerts = alerts.filter(a => a.type === 'warning').length;

    return {
      status: criticalAlerts > 0 ? 'critical' : warningAlerts > 0 ? 'warning' : 'healthy',
      frameRate: Math.round(metrics.frameRate),
      memoryUsage: Math.round(metrics.memoryUsage.percentage),
      averageRenderTime: Math.round(metrics.renderTimes.average * 100) / 100,
      eventThroughput: Math.round(metrics.eventThroughput.eventsPerSecond),
      criticalAlerts,
      warningAlerts,
      componentCount: metrics.componentMetrics.size,
    };
  }
}

// Global performance monitor instance
let globalPerformanceMonitor: PerformanceMonitor | null = null;

export const getPerformanceMonitor = (config?: Partial<PerformanceConfig>): PerformanceMonitor => {
  if (!globalPerformanceMonitor) {
    globalPerformanceMonitor = new PerformanceMonitor(config);
  }
  return globalPerformanceMonitor;
};

export const resetPerformanceMonitor = (): void => {
  if (globalPerformanceMonitor) {
    globalPerformanceMonitor.stop();
    globalPerformanceMonitor = null;
  }
};

/**
 * React hook for using performance monitor
 */
export const usePerformanceMonitor = () => {
  const monitor = getPerformanceMonitor();
  
  return {
    monitor,
    metrics: monitor.getMetrics(),
    alerts: monitor.getAlerts(),
    summary: monitor.getPerformanceSummary(),
    start: () => monitor.start(),
    stop: () => monitor.stop(),
    createProfiler: (componentName: string) => monitor.createProfiler(componentName),
  };
};