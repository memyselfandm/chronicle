import {
  sentry,
  performance,
  analytics,
  initializeMonitoring,
  monitoringUtils,
  ErrorBoundaryHandler,
  usePerformanceMonitoring,
  PerformanceMetrics,
  ErrorEvent,
  AnalyticsEvent,
} from '../../src/lib/monitoring';

// Mock dependencies
jest.mock('../../src/lib/config', () => ({
  config: {
    environment: 'test',
    monitoring: {
      sentry: {
        dsn: 'mock-sentry-dsn',
        environment: 'test',
        debug: false,
        sampleRate: 1.0,
        tracesSampleRate: 0.1,
      },
      analytics: {
        trackingEnabled: true,
      },
    },
  },
  configUtils: {
    isProduction: jest.fn(() => false),
    isDevelopment: jest.fn(() => true),
    log: jest.fn(),
  },
}));

jest.mock('../../src/lib/constants', () => ({
  TIME_CONSTANTS: {
    MILLISECONDS_PER_SECOND: 1000,
  },
}));

jest.mock('../../src/lib/utils', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock Sentry
jest.mock('@sentry/nextjs', () => ({
  init: jest.fn(),
  configureScope: jest.fn(),
  captureException: jest.fn(),
  withScope: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

// Mock renderHook for React hook testing
import { renderHook, act } from '@testing-library/react';

describe('Monitoring System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset module state
    (sentry as any).initialized = false;
    (analytics as any).initialized = false;
    (performance as any).metrics = [];
  });

  describe('SentryMonitoring', () => {
    it('should initialize Sentry with correct configuration', async () => {
      const mockInit = jest.fn();
      const mockConfigureScope = jest.fn();
      
      jest.doMock('@sentry/nextjs', () => ({
        init: mockInit,
        configureScope: mockConfigureScope,
      }));

      await sentry.initialize();

      expect(mockInit).toHaveBeenCalledWith({
        dsn: 'mock-sentry-dsn',
        environment: 'test',
        debug: false,
        sampleRate: 1.0,
        tracesSampleRate: 0.1,
        beforeSend: expect.any(Function),
        beforeSendTransaction: expect.any(Function),
      });

      expect(mockConfigureScope).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should not initialize Sentry if already initialized', async () => {
      const mockInit = jest.fn();
      jest.doMock('@sentry/nextjs', () => ({
        init: mockInit,
        configureScope: jest.fn(),
      }));

      await sentry.initialize();
      await sentry.initialize(); // Second call

      expect(mockInit).toHaveBeenCalledTimes(1);
    });

    it('should capture error with context', async () => {
      const mockCaptureException = jest.fn();
      const mockWithScope = jest.fn((callback) => callback({
        setExtra: jest.fn(),
      }));

      jest.doMock('@sentry/nextjs', () => ({
        init: jest.fn(),
        configureScope: jest.fn(),
        captureException: mockCaptureException,
        withScope: mockWithScope,
      }));

      const error = new Error('Test error');
      const context = { userId: '123', action: 'test' };

      await sentry.captureError(error, context);

      expect(mockWithScope).toHaveBeenCalled();
      expect(mockCaptureException).toHaveBeenCalledWith(error);
    });

    it('should handle Sentry initialization failure gracefully', async () => {
      jest.doMock('@sentry/nextjs', () => {
        throw new Error('Sentry import failed');
      });

      await expect(sentry.initialize()).resolves.not.toThrow();
    });

    it('should add breadcrumbs when initialized', async () => {
      const mockAddBreadcrumb = jest.fn();
      
      jest.doMock('@sentry/nextjs', () => ({
        init: jest.fn(),
        configureScope: jest.fn(),
        addBreadcrumb: mockAddBreadcrumb,
      }));

      await sentry.initialize();
      await sentry.addBreadcrumb('Test message', 'test', { key: 'value' });

      expect(mockAddBreadcrumb).toHaveBeenCalledWith({
        message: 'Test message',
        category: 'test',
        data: { key: 'value' },
        level: 'info',
        timestamp: expect.any(Number),
      });
    });

    it('should not add breadcrumbs when not initialized', async () => {
      const mockAddBreadcrumb = jest.fn();
      
      jest.doMock('@sentry/nextjs', () => ({
        addBreadcrumb: mockAddBreadcrumb,
      }));

      await sentry.addBreadcrumb('Test message', 'test');

      expect(mockAddBreadcrumb).not.toHaveBeenCalled();
    });

    it('should filter development errors in production', async () => {
      const { configUtils } = require('../../src/lib/config');
      configUtils.isProduction.mockReturnValue(true);

      const mockInit = jest.fn();
      jest.doMock('@sentry/nextjs', () => ({
        init: mockInit,
        configureScope: jest.fn(),
      }));

      await sentry.initialize();

      const beforeSend = mockInit.mock.calls[0][0].beforeSend;
      const mockEvent = {
        exception: {
          values: [{ value: 'development error occurred' }],
        },
      };

      const result = beforeSend(mockEvent);
      expect(result).toBeNull(); // Should filter out development errors
    });

    it('should filter noisy transactions', async () => {
      const mockInit = jest.fn();
      jest.doMock('@sentry/nextjs', () => ({
        init: mockInit,
        configureScope: jest.fn(),
      }));

      await sentry.initialize();

      const beforeSendTransaction = mockInit.mock.calls[0][0].beforeSendTransaction;
      const noisyTransaction = { transaction: '_next/static/chunks/123' };
      const normalTransaction = { transaction: 'dashboard/events' };

      expect(beforeSendTransaction(noisyTransaction)).toBeNull();
      expect(beforeSendTransaction(normalTransaction)).toBe(normalTransaction);
    });
  });

  describe('PerformanceMonitoring', () => {
    it('should record performance metrics', () => {
      const mockMetric = {
        page: 'dashboard',
        loadTime: 1500,
        renderTime: 800,
        eventCount: 10,
        memory: { used: 1000000, total: 2000000 },
      };

      performance.recordMetric(mockMetric);

      const summary = performance.getSummary();
      expect(summary.totalMetrics).toBe(1);
      expect(summary.averageLoadTime).toBe(1500);
      expect(summary.averageRenderTime).toBe(800);
    });

    it('should maintain maximum metrics limit', () => {
      const maxMetrics = 100;

      // Record more than the limit
      for (let i = 0; i < 120; i++) {
        performance.recordMetric({
          page: 'dashboard',
          loadTime: 1000 + i,
          renderTime: 500 + i,
          eventCount: i,
        });
      }

      const summary = performance.getSummary();
      expect(summary.totalMetrics).toBe(maxMetrics);
      expect(summary.averageLoadTime).toBeGreaterThan(1000); // Should be from recent metrics
    });

    it('should return empty summary when no metrics', () => {
      const summary = performance.getSummary();
      
      expect(summary).toEqual({
        averageLoadTime: 0,
        averageRenderTime: 0,
        totalMetrics: 0,
        lastUpdate: 0,
      });
    });

    it('should calculate correct averages', () => {
      performance.recordMetric({
        page: 'dashboard',
        loadTime: 1000,
        renderTime: 500,
        eventCount: 5,
      });

      performance.recordMetric({
        page: 'events',
        loadTime: 2000,
        renderTime: 1000,
        eventCount: 10,
      });

      const summary = performance.getSummary();
      expect(summary.averageLoadTime).toBe(1500); // (1000 + 2000) / 2
      expect(summary.averageRenderTime).toBe(750); // (500 + 1000) / 2
      expect(summary.totalMetrics).toBe(2);
    });

    it('should send metrics to analytics when enabled', () => {
      const trackSpy = jest.spyOn(analytics, 'track').mockResolvedValue();

      performance.recordMetric({
        page: 'dashboard',
        loadTime: 1500,
        renderTime: 800,
        eventCount: 10,
        memory: { used: 1000000, total: 2000000 },
      });

      expect(trackSpy).toHaveBeenCalledWith('performance_metric', {
        page: 'dashboard',
        loadTime: 1500,
        renderTime: 800,
        eventCount: 10,
        memoryUsed: 1000000,
        memoryTotal: 2000000,
      });

      trackSpy.mockRestore();
    });
  });

  describe('Analytics', () => {
    it('should initialize analytics when enabled', async () => {
      const { configUtils } = require('../../src/lib/config');
      
      await analytics.initialize();

      expect(configUtils.log).toHaveBeenCalledWith('info', 'Analytics tracking initialized');
    });

    it('should track events with correct format', async () => {
      const { logger } = require('../../src/lib/utils');
      
      await analytics.track('page_view', { page: 'dashboard', userId: '123' });

      expect(logger.debug).toHaveBeenCalledWith(
        'Analytics Event',
        expect.objectContaining({
          component: 'monitoring',
          action: 'trackAnalyticsEvent',
          data: expect.objectContaining({
            event: 'page_view',
            properties: { page: 'dashboard', userId: '123' },
            timestamp: expect.any(Number),
          }),
        })
      );
    });

    it('should track page views', async () => {
      const trackSpy = jest.spyOn(analytics, 'track').mockResolvedValue();

      await analytics.trackPageView('dashboard', { section: 'events' });

      expect(trackSpy).toHaveBeenCalledWith('page_view', {
        page: 'dashboard',
        section: 'events',
      });

      trackSpy.mockRestore();
    });

    it('should not track when tracking is disabled', async () => {
      const { config } = require('../../src/lib/config');
      config.monitoring.analytics.trackingEnabled = false;
      
      const { logger } = require('../../src/lib/utils');
      logger.debug.mockClear();

      await analytics.track('test_event');

      expect(logger.debug).not.toHaveBeenCalled();

      // Reset for other tests
      config.monitoring.analytics.trackingEnabled = true;
    });

    it('should handle analytics initialization failure gracefully', async () => {
      const { configUtils } = require('../../src/lib/config');
      const originalLog = configUtils.log;
      
      configUtils.log = jest.fn((level, message, error) => {
        if (level === 'error' && message.includes('Failed to initialize analytics')) {
          throw error || new Error('Test error');
        }
      });

      await expect(analytics.initialize()).resolves.not.toThrow();

      configUtils.log = originalLog;
    });
  });

  describe('ErrorBoundaryHandler', () => {
    it('should capture error with component stack', () => {
      const captureErrorSpy = jest.spyOn(sentry, 'captureError').mockResolvedValue();
      const { configUtils } = require('../../src/lib/config');

      const error = new Error('Component error');
      const errorInfo = { componentStack: 'ComponentA > ComponentB > ComponentC' };

      ErrorBoundaryHandler.captureError(error, errorInfo);

      expect(configUtils.log).toHaveBeenCalledWith(
        'error',
        'Error boundary caught error',
        expect.objectContaining({
          message: 'Component error',
          stack: error.stack,
          component: 'ComponentA > ComponentB > ComponentC',
          timestamp: expect.any(Number),
          environment: 'test',
        })
      );

      expect(captureErrorSpy).toHaveBeenCalledWith(error, expect.any(Object));

      captureErrorSpy.mockRestore();
    });
  });

  describe('usePerformanceMonitoring', () => {
    beforeEach(() => {
      // Mock window.performance.memory
      Object.defineProperty(window, 'performance', {
        writable: true,
        value: {
          memory: {
            usedJSHeapSize: 1000000,
            totalJSHeapSize: 2000000,
          },
        },
      });
    });

    it('should record page load performance', () => {
      const recordMetricSpy = jest.spyOn(performance, 'recordMetric');
      
      const { result } = renderHook(() => usePerformanceMonitoring('dashboard'));

      act(() => {
        result.current.recordPageLoad(5);
      });

      expect(recordMetricSpy).toHaveBeenCalledWith({
        page: 'dashboard',
        loadTime: expect.any(Number),
        renderTime: expect.any(Number),
        eventCount: 5,
        memory: {
          used: 1000000,
          total: 2000000,
        },
      });

      recordMetricSpy.mockRestore();
    });

    it('should handle missing performance.memory gracefully', () => {
      Object.defineProperty(window, 'performance', {
        writable: true,
        value: {},
      });

      const recordMetricSpy = jest.spyOn(performance, 'recordMetric');
      
      const { result } = renderHook(() => usePerformanceMonitoring('dashboard'));

      act(() => {
        result.current.recordPageLoad();
      });

      expect(recordMetricSpy).toHaveBeenCalledWith({
        page: 'dashboard',
        loadTime: expect.any(Number),
        renderTime: expect.any(Number),
        eventCount: 0,
        memory: undefined,
      });

      recordMetricSpy.mockRestore();
    });
  });

  describe('initializeMonitoring', () => {
    it('should initialize all monitoring services', async () => {
      const sentryInitSpy = jest.spyOn(sentry, 'initialize').mockResolvedValue();
      const analyticsInitSpy = jest.spyOn(analytics, 'initialize').mockResolvedValue();
      const { configUtils } = require('../../src/lib/config');

      await initializeMonitoring();

      expect(sentryInitSpy).toHaveBeenCalled();
      expect(analyticsInitSpy).toHaveBeenCalled();
      expect(configUtils.log).toHaveBeenCalledWith('info', 'Initializing monitoring services...');
      expect(configUtils.log).toHaveBeenCalledWith('info', 'Monitoring services initialized');

      sentryInitSpy.mockRestore();
      analyticsInitSpy.mockRestore();
    });

    it('should handle initialization failures gracefully', async () => {
      const sentryInitSpy = jest.spyOn(sentry, 'initialize').mockRejectedValue(new Error('Sentry failed'));
      const analyticsInitSpy = jest.spyOn(analytics, 'initialize').mockResolvedValue();

      await expect(initializeMonitoring()).resolves.not.toThrow();

      sentryInitSpy.mockRestore();
      analyticsInitSpy.mockRestore();
    });
  });

  describe('monitoringUtils', () => {
    describe('observeWebVitals', () => {
      beforeEach(() => {
        // Mock PerformanceObserver
        global.PerformanceObserver = jest.fn().mockImplementation((callback) => ({
          observe: jest.fn(),
          disconnect: jest.fn(),
        }));

        Object.defineProperty(window, 'location', {
          value: { pathname: '/dashboard' },
          writable: true,
        });
      });

      afterEach(() => {
        delete (global as any).PerformanceObserver;
      });

      it('should observe web vitals when PerformanceObserver is available', () => {
        const trackSpy = jest.spyOn(analytics, 'track').mockResolvedValue();

        monitoringUtils.observeWebVitals();

        expect(global.PerformanceObserver).toHaveBeenCalledTimes(3); // LCP, FID, CLS

        trackSpy.mockRestore();
      });

      it('should handle missing PerformanceObserver gracefully', () => {
        delete (global as any).PerformanceObserver;

        expect(() => {
          monitoringUtils.observeWebVitals();
        }).not.toThrow();
      });

      it('should handle server-side rendering', () => {
        const originalWindow = global.window;
        delete (global as any).window;

        expect(() => {
          monitoringUtils.observeWebVitals();
        }).not.toThrow();

        global.window = originalWindow;
      });

      it('should track LCP metrics correctly', () => {
        const trackSpy = jest.spyOn(analytics, 'track').mockResolvedValue();
        let lcpObserver: any;

        global.PerformanceObserver = jest.fn().mockImplementation((callback) => {
          if (!lcpObserver) {
            lcpObserver = { observe: jest.fn(), callback };
          }
          return lcpObserver;
        });

        monitoringUtils.observeWebVitals();

        // Simulate LCP entry
        const mockEntry = { startTime: 1500 };
        lcpObserver.callback({ getEntries: () => [mockEntry] });

        expect(trackSpy).toHaveBeenCalledWith('web_vital_lcp', {
          value: 1500,
          page: '/dashboard',
        });

        trackSpy.mockRestore();
      });
    });

    describe('trackInteraction', () => {
      beforeEach(() => {
        Object.defineProperty(window, 'location', {
          value: { pathname: '/dashboard' },
          writable: true,
        });
      });

      it('should track user interactions', () => {
        const trackSpy = jest.spyOn(analytics, 'track').mockResolvedValue();

        monitoringUtils.trackInteraction('click', 'button', { buttonId: 'submit' });

        expect(trackSpy).toHaveBeenCalledWith('user_interaction', {
          action: 'click',
          element: 'button',
          page: '/dashboard',
          buttonId: 'submit',
        });

        trackSpy.mockRestore();
      });
    });

    describe('trackApiCall', () => {
      beforeEach(() => {
        Object.defineProperty(window, 'location', {
          value: { pathname: '/dashboard' },
          writable: true,
        });
      });

      it('should track API call performance', () => {
        const trackSpy = jest.spyOn(analytics, 'track').mockResolvedValue();

        monitoringUtils.trackApiCall('/api/events', 1500, true);

        expect(trackSpy).toHaveBeenCalledWith('api_call', {
          endpoint: '/api/events',
          duration: 1500,
          success: true,
          page: '/dashboard',
        });

        trackSpy.mockRestore();
      });

      it('should track failed API calls', () => {
        const trackSpy = jest.spyOn(analytics, 'track').mockResolvedValue();

        monitoringUtils.trackApiCall('/api/sessions', 3000, false);

        expect(trackSpy).toHaveBeenCalledWith('api_call', {
          endpoint: '/api/sessions',
          duration: 3000,
          success: false,
          page: '/dashboard',
        });

        trackSpy.mockRestore();
      });
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle rapid metric recording efficiently', () => {
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        performance.recordMetric({
          page: 'dashboard',
          loadTime: 1000 + i,
          renderTime: 500 + i,
          eventCount: i,
        });
      }

      const end = performance.now();
      const summary = performance.getSummary();

      expect(summary.totalMetrics).toBe(100); // Should be capped at maxMetrics
      expect(end - start).toBeLessThan(100); // Should complete quickly
    });

    it('should handle concurrent initialization calls', async () => {
      const initPromises = [
        sentry.initialize(),
        sentry.initialize(),
        sentry.initialize(),
      ];

      await Promise.all(initPromises);

      // Should only initialize once
      expect((sentry as any).initialized).toBe(true);
    });

    it('should handle invalid metric data gracefully', () => {
      expect(() => {
        performance.recordMetric({
          page: '',
          loadTime: -1,
          renderTime: NaN,
          eventCount: Infinity,
        });
      }).not.toThrow();

      const summary = performance.getSummary();
      expect(summary.totalMetrics).toBe(1);
    });

    it('should handle analytics tracking with malformed data', async () => {
      const circularObj: any = { prop: 'value' };
      circularObj.circular = circularObj;

      await expect(analytics.track('test', circularObj)).resolves.not.toThrow();
    });

    it('should handle memory pressure during metric collection', () => {
      // Simulate memory pressure by recording many large metrics
      const largeMetadata = {
        largeData: 'x'.repeat(10000),
        moreData: Array(1000).fill('test'),
      };

      for (let i = 0; i < 200; i++) {
        performance.recordMetric({
          page: 'dashboard',
          loadTime: i,
          renderTime: i,
          eventCount: i,
          memory: { used: i * 1000000, total: i * 2000000 },
          ...largeMetadata as any,
        });
      }

      const summary = performance.getSummary();
      expect(summary.totalMetrics).toBe(100); // Should maintain limit
    });
  });
});