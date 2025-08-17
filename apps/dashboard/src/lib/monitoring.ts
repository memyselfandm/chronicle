/**
 * Chronicle Dashboard Monitoring and Error Tracking Configuration
 * Handles Sentry, analytics, and performance monitoring setup
 */

import { config, configUtils } from './config';

/**
 * Performance monitoring interface
 */
export interface PerformanceMetrics {
  timestamp: number;
  page: string;
  loadTime: number;
  renderTime: number;
  eventCount: number;
  memory?: {
    used: number;
    total: number;
  };
}

/**
 * Error tracking interface
 */
export interface ErrorEvent {
  message: string;
  stack?: string;
  component?: string;
  userId?: string;
  sessionId?: string;
  timestamp: number;
  environment: string;
  additionalContext?: Record<string, unknown>;
}

/**
 * Analytics event interface
 */
export interface AnalyticsEvent {
  event: string;
  properties?: Record<string, unknown>;
  userId?: string;
  sessionId?: string;
  timestamp: number;
}

/**
 * Sentry configuration and initialization
 */
class SentryMonitoring {
  private initialized = false;
  
  /**
   * Initialize Sentry if configuration is available
   */
  async initialize(): Promise<void> {
    if (this.initialized || !config.monitoring.sentry?.dsn) {
      return;
    }
    
    try {
      // Dynamic import to avoid bundling Sentry in development if not needed
      const { init, configureScope } = await import('@sentry/nextjs');
      
      init({
        dsn: config.monitoring.sentry.dsn,
        environment: config.monitoring.sentry.environment,
        debug: config.monitoring.sentry.debug,
        sampleRate: config.monitoring.sentry.sampleRate,
        tracesSampleRate: config.monitoring.sentry.tracesSampleRate,
        beforeSend: (event) => {
          // Filter out development errors if in production
          if (configUtils.isProduction() && event.exception) {
            const error = event.exception.values?.[0];
            if (error?.value?.includes('development')) {
              return null;
            }
          }
          return event;
        },
        beforeSendTransaction: (transaction) => {
          // Filter noisy transactions
          if (transaction.transaction?.includes('_next/static')) {
            return null;
          }
          return transaction;
        },
      });
      
      configureScope((scope) => {
        scope.setTag('chronicle.component', 'dashboard');
        scope.setTag('chronicle.version', '1.0.0');
        scope.setLevel('error');
      });
      
      this.initialized = true;
      configUtils.log('info', 'Sentry monitoring initialized');
      
    } catch (error) {
      configUtils.log('error', 'Failed to initialize Sentry', error);
    }
  }
  
  /**
   * Capture an error with context
   */
  async captureError(error: Error | string, context?: Record<string, unknown>): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      const { captureException, withScope } = await import('@sentry/nextjs');
      
      withScope((scope) => {
        if (context) {
          Object.entries(context).forEach(([key, value]) => {
            scope.setExtra(key, value);
          });
        }
        captureException(error);
      });
      
    } catch (importError) {
      configUtils.log('error', 'Failed to capture error in Sentry', importError);
    }
  }
  
  /**
   * Add breadcrumb for debugging
   */
  async addBreadcrumb(message: string, category: string, data?: Record<string, unknown>): Promise<void> {
    if (!this.initialized) return;
    
    try {
      const { addBreadcrumb } = await import('@sentry/nextjs');
      
      addBreadcrumb({
        message,
        category,
        data,
        level: 'info',
        timestamp: Date.now() / 1000,
      });
      
    } catch (error) {
      configUtils.log('error', 'Failed to add breadcrumb', error);
    }
  }
}

/**
 * Performance monitoring
 */
class PerformanceMonitoring {
  private metrics: PerformanceMetrics[] = [];
  private maxMetrics = 100; // Keep last 100 metrics
  
  /**
   * Record a performance metric
   */
  recordMetric(metric: Omit<PerformanceMetrics, 'timestamp'>): void {
    const fullMetric: PerformanceMetrics = {
      ...metric,
      timestamp: Date.now(),
    };
    
    this.metrics.push(fullMetric);
    
    // Keep only the last maxMetrics entries
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
    
    configUtils.log('debug', 'Performance metric recorded', fullMetric);
    
    // Send to monitoring service if configured
    if (config.monitoring.analytics?.trackingEnabled) {
      this.sendToAnalytics(fullMetric);
    }
  }
  
  /**
   * Get performance summary
   */
  getSummary(): {
    averageLoadTime: number;
    averageRenderTime: number;
    totalMetrics: number;
    lastUpdate: number;
  } {
    if (this.metrics.length === 0) {
      return {
        averageLoadTime: 0,
        averageRenderTime: 0,
        totalMetrics: 0,
        lastUpdate: 0,
      };
    }
    
    const totalLoadTime = this.metrics.reduce((sum, m) => sum + m.loadTime, 0);
    const totalRenderTime = this.metrics.reduce((sum, m) => sum + m.renderTime, 0);
    
    return {
      averageLoadTime: totalLoadTime / this.metrics.length,
      averageRenderTime: totalRenderTime / this.metrics.length,
      totalMetrics: this.metrics.length,
      lastUpdate: this.metrics[this.metrics.length - 1]?.timestamp || 0,
    };
  }
  
  /**
   * Send metric to analytics service
   */
  private sendToAnalytics(metric: PerformanceMetrics): void {
    analytics.track('performance_metric', {
      page: metric.page,
      loadTime: metric.loadTime,
      renderTime: metric.renderTime,
      eventCount: metric.eventCount,
      memoryUsed: metric.memory?.used,
      memoryTotal: metric.memory?.total,
    });
  }
}

/**
 * Analytics tracking
 */
class Analytics {
  private initialized = false;
  
  /**
   * Initialize analytics if enabled
   */
  async initialize(): Promise<void> {
    if (this.initialized || !config.monitoring.analytics?.trackingEnabled) {
      return;
    }
    
    try {
      // Here you would initialize your analytics service (e.g., Google Analytics, Mixpanel, etc.)
      // For now, we'll just log that it's initialized
      this.initialized = true;
      configUtils.log('info', 'Analytics tracking initialized');
      
    } catch (error) {
      configUtils.log('error', 'Failed to initialize analytics', error);
    }
  }
  
  /**
   * Track an event
   */
  async track(event: string, properties?: Record<string, unknown>): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (!config.monitoring.analytics?.trackingEnabled) {
      return;
    }
    
    const analyticsEvent: AnalyticsEvent = {
      event,
      properties,
      timestamp: Date.now(),
    };
    
    configUtils.log('debug', 'Analytics event tracked', analyticsEvent);
    
    // Here you would send to your analytics service
    // For development, we just log the event
    if (configUtils.isDevelopment()) {
      console.log('📊 Analytics Event:', analyticsEvent);
    }
  }
  
  /**
   * Track a page view
   */
  async trackPageView(page: string, properties?: Record<string, unknown>): Promise<void> {
    await this.track('page_view', {
      page,
      ...properties,
    });
  }
}

/**
 * Error boundary helper
 */
export class ErrorBoundaryHandler {
  static captureError(error: Error, errorInfo: { componentStack: string }): void {
    const errorEvent: ErrorEvent = {
      message: error.message,
      stack: error.stack,
      component: errorInfo.componentStack,
      timestamp: Date.now(),
      environment: config.environment,
    };
    
    configUtils.log('error', 'Error boundary caught error', errorEvent);
    sentry.captureError(error, errorEvent);
  }
}

/**
 * React hook for performance monitoring
 */
export function usePerformanceMonitoring(pageName: string) {
  const startTime = Date.now();
  
  const recordPageLoad = (eventCount: number = 0) => {
    const loadTime = Date.now() - startTime;
    
    performance.recordMetric({
      page: pageName,
      loadTime,
      renderTime: loadTime, // Approximation for now
      eventCount,
      memory: (window as any).performance?.memory ? {
        used: (window as any).performance.memory.usedJSHeapSize,
        total: (window as any).performance.memory.totalJSHeapSize,
      } : undefined,
    });
  };
  
  return { recordPageLoad };
}

// Export singleton instances
export const sentry = new SentryMonitoring();
export const performance = new PerformanceMonitoring();
export const analytics = new Analytics();

/**
 * Initialize all monitoring services
 */
export async function initializeMonitoring(): Promise<void> {
  configUtils.log('info', 'Initializing monitoring services...');
  
  await Promise.all([
    sentry.initialize(),
    analytics.initialize(),
  ]);
  
  configUtils.log('info', 'Monitoring services initialized');
}

/**
 * Monitoring utilities
 */
export const monitoringUtils = {
  /**
   * Add performance observer for Core Web Vitals
   */
  observeWebVitals(): void {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
      return;
    }
    
    try {
      // Observe Largest Contentful Paint (LCP)
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          analytics.track('web_vital_lcp', {
            value: entry.startTime,
            page: window.location.pathname,
          });
        }
      }).observe({ entryTypes: ['largest-contentful-paint'] });
      
      // Observe First Input Delay (FID)
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          analytics.track('web_vital_fid', {
            value: (entry as any).processingStart - entry.startTime,
            page: window.location.pathname,
          });
        }
      }).observe({ entryTypes: ['first-input'] });
      
      // Observe Cumulative Layout Shift (CLS)
      new PerformanceObserver((list) => {
        let clsScore = 0;
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsScore += (entry as any).value;
          }
        }
        if (clsScore > 0) {
          analytics.track('web_vital_cls', {
            value: clsScore,
            page: window.location.pathname,
          });
        }
      }).observe({ entryTypes: ['layout-shift'] });
      
    } catch (error) {
      configUtils.log('error', 'Failed to observe web vitals', error);
    }
  },
  
  /**
   * Track user interaction
   */
  trackInteraction: (action: string, element: string, properties?: Record<string, unknown>) => {
    analytics.track('user_interaction', {
      action,
      element,
      page: window.location.pathname,
      ...properties,
    });
  },
  
  /**
   * Track API call performance
   */
  trackApiCall: (endpoint: string, duration: number, success: boolean) => {
    analytics.track('api_call', {
      endpoint,
      duration,
      success,
      page: window.location.pathname,
    });
  },
};

export default {
  sentry,
  performance,
  analytics,
  initializeMonitoring,
  monitoringUtils,
  ErrorBoundaryHandler,
  usePerformanceMonitoring,
};