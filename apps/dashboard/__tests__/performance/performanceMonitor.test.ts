/**
 * Performance monitor test suite
 * Tests for performance monitoring, alerting, and optimization features
 */

import { getPerformanceMonitor, resetPerformanceMonitor } from '../../src/lib/performanceMonitor';

// Mock performance API
const mockPerformance = {
  now: jest.fn(),
  memory: {
    usedJSHeapSize: 50 * 1024 * 1024, // 50MB
    totalJSHeapSize: 100 * 1024 * 1024, // 100MB
  },
};

Object.defineProperty(global, 'performance', {
  value: mockPerformance,
  writable: true,
});

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((cb) => {
  setTimeout(cb, 16);
  return 1;
});

global.cancelAnimationFrame = jest.fn();

describe('PerformanceMonitor', () => {
  let performanceMonitor: ReturnType<typeof getPerformanceMonitor>;

  beforeEach(() => {
    jest.useFakeTimers();
    resetPerformanceMonitor();
    performanceMonitor = getPerformanceMonitor();
    jest.clearAllMocks();
    mockPerformance.now.mockReturnValue(100);
  });

  afterEach(() => {
    performanceMonitor.stop();
    resetPerformanceMonitor();
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      expect(performanceMonitor).toBeDefined();
      const metrics = performanceMonitor.getMetrics();
      expect(metrics.frameRate).toBe(0);
      expect(metrics.memoryUsage.used).toBe(0);
    });

    it('should accept custom configuration', () => {
      resetPerformanceMonitor();
      const customMonitor = getPerformanceMonitor({
        frameRateTarget: 30,
        memoryThreshold: 200,
        alertingEnabled: false,
      });
      
      expect(customMonitor).toBeDefined();
    });
  });

  describe('Component Tracking', () => {
    it('should track component render times', () => {
      const componentName = 'TestComponent';
      const renderTime = 15.5;

      performanceMonitor.trackComponentRender(componentName, renderTime);

      const metrics = performanceMonitor.getMetrics();
      const componentMetrics = metrics.componentMetrics.get(componentName);

      expect(componentMetrics).toBeDefined();
      expect(componentMetrics?.name).toBe(componentName);
      expect(componentMetrics?.renderCount).toBe(1);
      expect(componentMetrics?.averageRenderTime).toBe(renderTime);
      expect(componentMetrics?.maxRenderTime).toBe(renderTime);
      expect(componentMetrics?.lastRenderTime).toBe(renderTime);
    });

    it('should aggregate multiple renders for same component', () => {
      const componentName = 'TestComponent';
      
      performanceMonitor.trackComponentRender(componentName, 10);
      performanceMonitor.trackComponentRender(componentName, 20);
      performanceMonitor.trackComponentRender(componentName, 30);

      const componentMetrics = performanceMonitor.getMetrics().componentMetrics.get(componentName);

      expect(componentMetrics?.renderCount).toBe(3);
      expect(componentMetrics?.averageRenderTime).toBe(20);
      expect(componentMetrics?.maxRenderTime).toBe(30);
      expect(componentMetrics?.lastRenderTime).toBe(30);
    });

    it('should create performance alerts for slow renders', () => {
      const alertListener = jest.fn();
      performanceMonitor.subscribeToAlerts(alertListener);

      // Render that exceeds threshold (16ms)
      performanceMonitor.trackComponentRender('SlowComponent', 25);

      expect(alertListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'warning',
          metric: 'renderTime',
          value: 25,
          threshold: 16,
        })
      );
    });
  });

  describe('Event Tracking', () => {
    it('should track event processing', () => {
      performanceMonitor.trackEvent();
      performanceMonitor.trackEvent();
      performanceMonitor.trackEvent();

      // Wait for processing
      jest.advanceTimersByTime(1000);

      const metrics = performanceMonitor.getMetrics();
      expect(metrics.eventThroughput.eventsPerSecond).toBeGreaterThan(0);
    });

    it('should handle high-frequency events', () => {
      // Simulate burst of events
      for (let i = 0; i < 250; i++) {
        performanceMonitor.trackEvent();
      }

      // Should not cause performance issues
      expect(() => {
        const metrics = performanceMonitor.getMetrics();
        expect(metrics).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('Frame Rate Monitoring', () => {
    it('should start frame rate monitoring when started', () => {
      performanceMonitor.start();
      expect(global.requestAnimationFrame).toHaveBeenCalled();
    });

    it('should stop frame rate monitoring when stopped', () => {
      performanceMonitor.start();
      performanceMonitor.stop();
      expect(global.cancelAnimationFrame).toHaveBeenCalled();
    });

    it('should measure frame rate over time', (done) => {
      let frameCount = 0;
      mockPerformance.now.mockImplementation(() => {
        frameCount++;
        return frameCount * 16.67; // ~60fps
      });

      performanceMonitor.start();

      setTimeout(() => {
        const metrics = performanceMonitor.getMetrics();
        expect(metrics.frameRate).toBeGreaterThan(0);
        done();
      }, 100);
    });
  });

  describe('Memory Monitoring', () => {
    it('should track memory usage when available', () => {
      performanceMonitor.start();
      
      // Trigger metrics collection
      jest.advanceTimersByTime(1000);

      const metrics = performanceMonitor.getMetrics();
      expect(metrics.memoryUsage.used).toBe(50); // 50MB from mock
      expect(metrics.memoryUsage.total).toBe(100); // 100MB from mock
      expect(metrics.memoryUsage.percentage).toBe(50);
    });

    it('should create alerts for high memory usage', () => {
      const alertListener = jest.fn();
      performanceMonitor.subscribeToAlerts(alertListener);

      // Mock high memory usage
      mockPerformance.memory.usedJSHeapSize = 150 * 1024 * 1024; // 150MB

      performanceMonitor.start();
      jest.advanceTimersByTime(1000);

      expect(alertListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'critical',
          metric: 'memory',
        })
      );
    });
  });

  describe('Performance Profiler', () => {
    it('should create profiler for components', () => {
      const profiler = performanceMonitor.createProfiler('TestComponent');
      expect(profiler).toBeDefined();
      expect(profiler.start).toBeFunction();
    });

    it('should measure execution time with profiler', () => {
      mockPerformance.now
        .mockReturnValueOnce(100)
        .mockReturnValueOnce(125);

      const profiler = performanceMonitor.createProfiler('TestComponent');
      const measurement = profiler.start();
      const duration = measurement.end();

      expect(duration).toBe(25);

      const componentMetrics = performanceMonitor.getMetrics().componentMetrics.get('TestComponent');
      expect(componentMetrics?.lastRenderTime).toBe(25);
    });
  });

  describe('Alerts System', () => {
    it('should create and store alerts', () => {
      const alertListener = jest.fn();
      performanceMonitor.subscribeToAlerts(alertListener);

      performanceMonitor.trackComponentRender('SlowComponent', 50);

      const alerts = performanceMonitor.getAlerts();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('warning');
      expect(alerts[0].metric).toBe('renderTime');
    });

    it('should limit alert history', () => {
      // Create more than 50 alerts
      for (let i = 0; i < 60; i++) {
        performanceMonitor.trackComponentRender(`Component${i}`, 50);
      }

      const alerts = performanceMonitor.getAlerts();
      expect(alerts).toHaveLength(50); // Should be capped at 50
    });

    it('should clear alerts when requested', () => {
      performanceMonitor.trackComponentRender('SlowComponent', 50);
      expect(performanceMonitor.getAlerts()).toHaveLength(1);

      performanceMonitor.clearAlerts();
      expect(performanceMonitor.getAlerts()).toHaveLength(0);
    });
  });

  describe('Performance Summary', () => {
    it('should provide performance summary', () => {
      performanceMonitor.trackComponentRender('TestComponent', 10);
      performanceMonitor.trackEvent();

      const summary = performanceMonitor.getPerformanceSummary();

      expect(summary).toMatchObject({
        status: expect.any(String),
        frameRate: expect.any(Number),
        memoryUsage: expect.any(Number),
        averageRenderTime: expect.any(Number),
        eventThroughput: expect.any(Number),
        criticalAlerts: expect.any(Number),
        warningAlerts: expect.any(Number),
        componentCount: expect.any(Number),
      });
    });

    it('should report healthy status with good metrics', () => {
      // Mock good performance
      mockPerformance.memory.usedJSHeapSize = 30 * 1024 * 1024; // 30MB
      
      performanceMonitor.trackComponentRender('FastComponent', 8);
      performanceMonitor.start();

      const summary = performanceMonitor.getPerformanceSummary();
      expect(summary.status).toBe('healthy');
    });

    it('should report warning status with moderate issues', () => {
      performanceMonitor.trackComponentRender('SlowComponent', 25); // Above threshold

      const summary = performanceMonitor.getPerformanceSummary();
      expect(summary.status).toBe('warning');
    });
  });

  describe('Subscription Management', () => {
    it('should allow subscribing to metrics updates', () => {
      const listener = jest.fn();
      const unsubscribe = performanceMonitor.subscribe(listener);

      performanceMonitor.start();
      jest.advanceTimersByTime(1000);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          frameRate: expect.any(Number),
          memoryUsage: expect.any(Object),
          renderTimes: expect.any(Object),
        })
      );

      unsubscribe();
    });

    it('should remove listeners when unsubscribed', () => {
      const listener = jest.fn();
      const unsubscribe = performanceMonitor.subscribe(listener);

      unsubscribe();
      
      performanceMonitor.start();
      jest.advanceTimersByTime(1000);

      expect(listener).not.toHaveBeenCalled();
    });
  });
});