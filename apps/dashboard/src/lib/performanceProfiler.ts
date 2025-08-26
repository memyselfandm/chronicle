/**
 * Production Performance Profiler
 * Agent-5 Performance Monitoring Integration
 * 
 * Real-time performance monitoring system for Chronicle Dashboard
 * Tracks key metrics and detects performance regressions in production
 */

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  context?: Record<string, any>;
}

export interface PerformanceProfile {
  id: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  metrics: PerformanceMetric[];
  context: Record<string, any>;
}

export interface PerformanceThreshold {
  metric: string;
  warning: number;
  critical: number;
  unit: string;
}

export interface PerformanceAlert {
  level: 'warning' | 'critical';
  metric: string;
  value: number;
  threshold: number;
  timestamp: Date;
  context: Record<string, any>;
}

class ProductionPerformanceProfiler {
  private profiles: Map<string, PerformanceProfile> = new Map();
  private metrics: PerformanceMetric[] = [];
  private thresholds: Map<string, PerformanceThreshold> = new Map();
  private alertCallbacks: Set<(alert: PerformanceAlert) => void> = new Set();
  private metricsBuffer: PerformanceMetric[] = [];
  private bufferFlushInterval: NodeJS.Timeout | null = null;
  
  private readonly MAX_METRICS_BUFFER = 100;
  private readonly BUFFER_FLUSH_INTERVAL = 10000; // 10 seconds
  private readonly MAX_STORED_METRICS = 1000;

  constructor() {
    this.initializeDefaultThresholds();
    this.startBufferFlushing();
  }

  private initializeDefaultThresholds(): void {
    // Component render performance thresholds
    this.setThreshold('component_render', 100, 200, 'ms');
    this.setThreshold('dashboard_render', 300, 500, 'ms');
    this.setThreshold('event_feed_render', 200, 400, 'ms');
    
    // Event processing thresholds
    this.setThreshold('event_processing', 50, 100, 'ms');
    this.setThreshold('event_batching', 100, 200, 'ms');
    this.setThreshold('session_calculation', 20, 50, 'ms');
    
    // Memory usage thresholds
    this.setThreshold('memory_usage', 50, 100, 'MB');
    this.setThreshold('memory_growth', 10, 25, 'MB/min');
    
    // UI responsiveness thresholds
    this.setThreshold('ui_response', 50, 100, 'ms');
    this.setThreshold('scroll_performance', 16, 33, 'ms'); // 60fps = 16.67ms, 30fps = 33ms
    this.setThreshold('filter_response', 100, 250, 'ms');
    
    // System throughput thresholds
    this.setThreshold('event_throughput', 100, 50, 'events/sec'); // Higher is better, so warning > critical
    this.setThreshold('render_fps', 45, 30, 'fps'); // Higher is better
  }

  private startBufferFlushing(): void {
    this.bufferFlushInterval = setInterval(() => {
      this.flushMetricsBuffer();
    }, this.BUFFER_FLUSH_INTERVAL);
  }

  /**
   * Set performance threshold for a metric
   */
  setThreshold(metric: string, warning: number, critical: number, unit: string): void {
    this.thresholds.set(metric, { metric, warning, critical, unit });
  }

  /**
   * Start a performance profile
   */
  startProfile(name: string, context: Record<string, any> = {}): string {
    const id = this.generateProfileId();
    const profile: PerformanceProfile = {
      id,
      name,
      startTime: new Date(),
      metrics: [],
      context
    };
    
    this.profiles.set(id, profile);
    return id;
  }

  /**
   * End a performance profile and record duration
   */
  endProfile(id: string): PerformanceProfile | null {
    const profile = this.profiles.get(id);
    if (!profile) {
      console.warn(`PerformanceProfiler: Profile ${id} not found`);
      return null;
    }

    profile.endTime = new Date();
    profile.duration = profile.endTime.getTime() - profile.startTime.getTime();

    // Record duration as a metric
    this.recordMetric(`${profile.name}_duration`, profile.duration, 'ms', profile.context);

    // Check thresholds
    this.checkThreshold(`${profile.name}_duration`, profile.duration, profile.context);

    this.profiles.delete(id);
    return profile;
  }

  /**
   * Record a performance metric
   */
  recordMetric(
    name: string, 
    value: number, 
    unit: string, 
    context: Record<string, any> = {}
  ): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date(),
      context
    };

    this.metricsBuffer.push(metric);

    // Check thresholds immediately for critical metrics
    this.checkThreshold(name, value, context);

    // Flush buffer if it's getting full
    if (this.metricsBuffer.length >= this.MAX_METRICS_BUFFER) {
      this.flushMetricsBuffer();
    }
  }

  /**
   * Record component render performance
   */
  recordComponentRender(componentName: string, renderTime: number, context: Record<string, any> = {}): void {
    this.recordMetric(`${componentName}_render`, renderTime, 'ms', {
      component: componentName,
      ...context
    });
  }

  /**
   * Record memory usage
   */
  recordMemoryUsage(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const memoryMB = memory.usedJSHeapSize / 1024 / 1024;
      
      this.recordMetric('memory_usage', memoryMB, 'MB', {
        total: memory.totalJSHeapSize / 1024 / 1024,
        limit: memory.jsHeapSizeLimit / 1024 / 1024
      });
    }
  }

  /**
   * Record event processing performance
   */
  recordEventProcessing(eventCount: number, processingTime: number, context: Record<string, any> = {}): void {
    const eventsPerSecond = eventCount / (processingTime / 1000);
    
    this.recordMetric('event_processing', processingTime, 'ms', {
      eventCount,
      eventsPerSecond,
      ...context
    });
    
    this.recordMetric('event_throughput', eventsPerSecond, 'events/sec', context);
  }

  /**
   * Record UI interaction response time
   */
  recordUIResponse(action: string, responseTime: number, context: Record<string, any> = {}): void {
    this.recordMetric('ui_response', responseTime, 'ms', {
      action,
      ...context
    });
  }

  /**
   * Record scroll performance (frame time)
   */
  recordScrollPerformance(frameTime: number, context: Record<string, any> = {}): void {
    const fps = 1000 / frameTime;
    
    this.recordMetric('scroll_performance', frameTime, 'ms', context);
    this.recordMetric('render_fps', fps, 'fps', context);
  }

  /**
   * Get recent metrics
   */
  getRecentMetrics(count: number = 50): PerformanceMetric[] {
    return this.metrics.slice(-count);
  }

  /**
   * Get metrics for a specific metric name
   */
  getMetricsByName(name: string, count: number = 20): PerformanceMetric[] {
    return this.metrics
      .filter(metric => metric.name === name)
      .slice(-count);
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    totalMetrics: number;
    activeProfiles: number;
    recentAlerts: PerformanceAlert[];
    metricSummary: Record<string, {
      count: number;
      average: number;
      min: number;
      max: number;
      unit: string;
    }>;
  } {
    const metricSummary: Record<string, any> = {};
    const recentAlerts: PerformanceAlert[] = [];

    // Group metrics by name and calculate statistics
    const metricGroups = new Map<string, PerformanceMetric[]>();
    
    this.metrics.forEach(metric => {
      if (!metricGroups.has(metric.name)) {
        metricGroups.set(metric.name, []);
      }
      metricGroups.get(metric.name)!.push(metric);
    });

    metricGroups.forEach((metrics, name) => {
      const values = metrics.map(m => m.value);
      metricSummary[name] = {
        count: metrics.length,
        average: values.reduce((sum, val) => sum + val, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        unit: metrics[0].unit
      };
    });

    return {
      totalMetrics: this.metrics.length,
      activeProfiles: this.profiles.size,
      recentAlerts,
      metricSummary
    };
  }

  /**
   * Subscribe to performance alerts
   */
  onAlert(callback: (alert: PerformanceAlert) => void): () => void {
    this.alertCallbacks.add(callback);
    
    return () => {
      this.alertCallbacks.delete(callback);
    };
  }

  /**
   * Clear old metrics to prevent memory growth
   */
  clearOldMetrics(): void {
    if (this.metrics.length > this.MAX_STORED_METRICS) {
      const toRemove = this.metrics.length - this.MAX_STORED_METRICS;
      this.metrics.splice(0, toRemove);
    }
  }

  /**
   * Export metrics for external analysis
   */
  exportMetrics(): {
    timestamp: string;
    metrics: PerformanceMetric[];
    summary: ReturnType<typeof this.getPerformanceSummary>;
  } {
    return {
      timestamp: new Date().toISOString(),
      metrics: [...this.metrics],
      summary: this.getPerformanceSummary()
    };
  }

  /**
   * Destroy profiler and clean up resources
   */
  destroy(): void {
    if (this.bufferFlushInterval) {
      clearInterval(this.bufferFlushInterval);
      this.bufferFlushInterval = null;
    }
    
    this.flushMetricsBuffer();
    this.profiles.clear();
    this.alertCallbacks.clear();
  }

  private generateProfileId(): string {
    return `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private checkThreshold(metricName: string, value: number, context: Record<string, any>): void {
    const threshold = this.thresholds.get(metricName);
    if (!threshold) return;

    let alertLevel: 'warning' | 'critical' | null = null;

    // Handle metrics where higher values are better (like throughput, fps)
    const higherIsBetter = ['event_throughput', 'render_fps'].some(metric => metricName.includes(metric));

    if (higherIsBetter) {
      if (value <= threshold.critical) {
        alertLevel = 'critical';
      } else if (value <= threshold.warning) {
        alertLevel = 'warning';
      }
    } else {
      if (value >= threshold.critical) {
        alertLevel = 'critical';
      } else if (value >= threshold.warning) {
        alertLevel = 'warning';
      }
    }

    if (alertLevel) {
      const alert: PerformanceAlert = {
        level: alertLevel,
        metric: metricName,
        value,
        threshold: alertLevel === 'critical' ? threshold.critical : threshold.warning,
        timestamp: new Date(),
        context
      };

      this.notifyAlert(alert);
    }
  }

  private notifyAlert(alert: PerformanceAlert): void {
    // Log alert
    const emoji = alert.level === 'critical' ? '🚨' : '⚠️';
    console.warn(
      `${emoji} Performance Alert [${alert.level.toUpperCase()}]: ` +
      `${alert.metric} = ${alert.value} (threshold: ${alert.threshold})`
    );

    // Notify subscribers
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        console.error('PerformanceProfiler: Alert callback error', error);
      }
    });
  }

  private flushMetricsBuffer(): void {
    if (this.metricsBuffer.length === 0) return;

    // Move buffered metrics to main storage
    this.metrics.push(...this.metricsBuffer);
    this.metricsBuffer = [];

    // Clean up old metrics if needed
    this.clearOldMetrics();
  }
}

// Create singleton instance
let globalProfiler: ProductionPerformanceProfiler | null = null;

export const getPerformanceProfiler = (): ProductionPerformanceProfiler => {
  if (!globalProfiler) {
    globalProfiler = new ProductionPerformanceProfiler();
  }
  return globalProfiler;
};

/**
 * React hook for component performance profiling
 */
export const usePerformanceProfiler = (componentName: string) => {
  const profiler = getPerformanceProfiler();

  const startRender = () => {
    return profiler.startProfile(`${componentName}_render`, {
      component: componentName,
      timestamp: Date.now()
    });
  };

  const endRender = (profileId: string) => {
    return profiler.endProfile(profileId);
  };

  const recordMetric = (name: string, value: number, unit: string, context?: Record<string, any>) => {
    profiler.recordMetric(name, value, unit, {
      component: componentName,
      ...context
    });
  };

  return {
    startRender,
    endRender,
    recordMetric
  };
};

/**
 * Higher-order component for automatic performance profiling
 */
export function withPerformanceProfiler<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
): React.ComponentType<P> {
  const WrappedComponent: React.FC<P> = (props) => {
    const name = componentName || Component.displayName || Component.name || 'UnknownComponent';
    const { startRender, endRender } = usePerformanceProfiler(name);
    
    const [profileId, setProfileId] = React.useState<string | null>(null);

    React.useLayoutEffect(() => {
      const id = startRender();
      setProfileId(id);
      
      return () => {
        if (id) {
          endRender(id);
        }
      };
    }, []);

    return React.createElement(Component, props);
  };

  WrappedComponent.displayName = `withPerformanceProfiler(${componentName || Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

/**
 * Performance profiling decorator for class components
 */
export function profilePerformance(target: any, propertyName: string, descriptor: PropertyDescriptor) {
  const method = descriptor.value;
  
  descriptor.value = function (...args: any[]) {
    const profiler = getPerformanceProfiler();
    const profileId = profiler.startProfile(`${target.constructor.name}.${propertyName}`, {
      class: target.constructor.name,
      method: propertyName,
      args: args.length
    });

    try {
      const result = method.apply(this, args);
      
      // Handle promise results
      if (result && typeof result.then === 'function') {
        return result.finally(() => {
          profiler.endProfile(profileId);
        });
      }
      
      profiler.endProfile(profileId);
      return result;
    } catch (error) {
      profiler.endProfile(profileId);
      throw error;
    }
  };

  return descriptor;
}

export { ProductionPerformanceProfiler };