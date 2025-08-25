import type { AppConfig, Environment, LogLevel, Theme } from '../../src/lib/config';

// Mock constants
jest.mock('../../src/lib/constants', () => ({
  MONITORING_INTERVALS: {
    REALTIME_HEARTBEAT_INTERVAL: 30000,
  },
}));

describe('Config Module', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalWindow: typeof window;
  let mockConsole: {
    warn: jest.SpyInstance;
    error: jest.SpyInstance;
    info: jest.SpyInstance;
    debug: jest.SpyInstance;
    log: jest.SpyInstance;
    group: jest.SpyInstance;
    groupEnd: jest.SpyInstance;
  };

  beforeAll(() => {
    originalEnv = { ...process.env };
    originalWindow = (global as any).window;
    
    // Mock console methods
    mockConsole = {
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation(),
      info: jest.spyOn(console, 'info').mockImplementation(),
      debug: jest.spyOn(console, 'debug').mockImplementation(),
      log: jest.spyOn(console, 'log').mockImplementation(),
      group: jest.spyOn(console, 'group').mockImplementation(),
      groupEnd: jest.spyOn(console, 'groupEnd').mockImplementation(),
    };
  });

  beforeEach(() => {
    // Reset environment variables
    process.env = { ...originalEnv };
    
    // Set minimum required environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.NEXT_PUBLIC_ENVIRONMENT = 'development';
    process.env.NODE_ENV = 'test';
    
    // Clear module cache to force re-evaluation
    jest.resetModules();
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
    (global as any).window = originalWindow;
    
    // Restore console methods
    Object.values(mockConsole).forEach(spy => spy.mockRestore());
  });

  describe('Environment Validation', () => {
    it('should skip validation on client-side', async () => {
      // Simulate client-side
      (global as any).window = {};
      
      const { config } = await import('../../src/lib/config');
      expect(config).toBeDefined();
    });

    it('should validate required environment variables on server-side', async () => {
      // Simulate server-side
      delete (global as any).window;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      process.env.NODE_ENV = 'production';

      await expect(async () => {
        await import('../../src/lib/config');
      }).rejects.toThrow('Missing required environment variables');
    });

    it('should warn about missing variables in development', async () => {
      delete (global as any).window;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      process.env.NODE_ENV = 'development';

      await import('../../src/lib/config');

      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('Missing environment variables')
      );
    });

    it('should handle all required variables present', async () => {
      delete (global as any).window;
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';

      const { config } = await import('../../src/lib/config');
      
      expect(config.supabase.url).toBe('https://test.supabase.co');
      expect(config.supabase.anonKey).toBe('test-key');
    });
  });

  describe('Environment Variable Parsing', () => {
    it('should parse string environment variables', async () => {
      process.env.NEXT_PUBLIC_APP_TITLE = 'Custom Title';
      
      const { config } = await import('../../src/lib/config');
      expect(config.appTitle).toBe('Custom Title');
    });

    it('should parse boolean environment variables', async () => {
      process.env.NEXT_PUBLIC_ENABLE_REALTIME = 'false';
      process.env.NEXT_PUBLIC_DEBUG = 'true';
      
      const { config } = await import('../../src/lib/config');
      expect(config.features.enableRealtime).toBe(false);
      expect(config.debug.enabled).toBe(true);
    });

    it('should parse numeric environment variables', async () => {
      process.env.NEXT_PUBLIC_MAX_EVENTS_DISPLAY = '500';
      process.env.NEXT_PUBLIC_POLLING_INTERVAL = '3000';
      
      const { config } = await import('../../src/lib/config');
      expect(config.performance.maxEventsDisplay).toBe(500);
      expect(config.performance.pollingInterval).toBe(3000);
    });

    it('should handle invalid numeric values with defaults', async () => {
      process.env.NEXT_PUBLIC_MAX_EVENTS_DISPLAY = 'invalid-number';
      
      const { config } = await import('../../src/lib/config');
      expect(config.performance.maxEventsDisplay).toBe(1000); // Default value
    });

    it('should use defaults when environment variables are not set', async () => {
      // Don't set optional variables
      const { config } = await import('../../src/lib/config');
      
      expect(config.appTitle).toBe('Chronicle Observability');
      expect(config.features.enableRealtime).toBe(true);
      expect(config.performance.maxEventsDisplay).toBe(1000);
    });
  });

  describe('Environment Detection', () => {
    it('should correctly identify development environment', async () => {
      process.env.NEXT_PUBLIC_ENVIRONMENT = 'development';
      
      const { config, configUtils } = await import('../../src/lib/config');
      expect(config.environment).toBe('development');
      expect(configUtils.isDevelopment()).toBe(true);
      expect(configUtils.isProduction()).toBe(false);
      expect(configUtils.isStaging()).toBe(false);
    });

    it('should correctly identify production environment', async () => {
      process.env.NEXT_PUBLIC_ENVIRONMENT = 'production';
      
      const { config, configUtils } = await import('../../src/lib/config');
      expect(config.environment).toBe('production');
      expect(configUtils.isProduction()).toBe(true);
      expect(configUtils.isDevelopment()).toBe(false);
    });

    it('should correctly identify staging environment', async () => {
      process.env.NEXT_PUBLIC_ENVIRONMENT = 'staging';
      
      const { config, configUtils } = await import('../../src/lib/config');
      expect(config.environment).toBe('staging');
      expect(configUtils.isStaging()).toBe(true);
      expect(configUtils.isDevelopment()).toBe(false);
      expect(configUtils.isProduction()).toBe(false);
    });

    it('should default to development for invalid environment', async () => {
      process.env.NEXT_PUBLIC_ENVIRONMENT = 'invalid-env';
      
      const { config } = await import('../../src/lib/config');
      expect(config.environment).toBe('development');
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid environment "invalid-env"')
      );
    });
  });

  describe('Configuration Structure', () => {
    it('should have all required configuration sections', async () => {
      const { config } = await import('../../src/lib/config');
      
      expect(config).toHaveProperty('environment');
      expect(config).toHaveProperty('nodeEnv');
      expect(config).toHaveProperty('appTitle');
      expect(config).toHaveProperty('supabase');
      expect(config).toHaveProperty('monitoring');
      expect(config).toHaveProperty('features');
      expect(config).toHaveProperty('performance');
      expect(config).toHaveProperty('debug');
      expect(config).toHaveProperty('ui');
      expect(config).toHaveProperty('security');
    });

    it('should have proper supabase configuration', async () => {
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
      
      const { config } = await import('../../src/lib/config');
      
      expect(config.supabase).toEqual({
        url: 'https://test.supabase.co',
        anonKey: 'test-anon-key',
        serviceRoleKey: 'service-role-key',
      });
    });

    it('should configure monitoring when environment variables are present', async () => {
      process.env.SENTRY_DSN = 'https://test@sentry.io/123';
      process.env.SENTRY_SAMPLE_RATE = '0.5';
      process.env.NEXT_PUBLIC_ANALYTICS_ID = 'GA-123456789';
      process.env.NEXT_PUBLIC_ENABLE_ANALYTICS_TRACKING = 'true';
      
      const { config } = await import('../../src/lib/config');
      
      expect(config.monitoring.sentry).toBeDefined();
      expect(config.monitoring.sentry!.dsn).toBe('https://test@sentry.io/123');
      expect(config.monitoring.sentry!.sampleRate).toBe(0.5);
      
      expect(config.monitoring.analytics).toBeDefined();
      expect(config.monitoring.analytics!.id).toBe('GA-123456789');
      expect(config.monitoring.analytics!.trackingEnabled).toBe(true);
    });

    it('should not configure monitoring when environment variables are missing', async () => {
      // Ensure monitoring env vars are not set
      delete process.env.SENTRY_DSN;
      delete process.env.NEXT_PUBLIC_ANALYTICS_ID;
      
      const { config } = await import('../../src/lib/config');
      
      expect(config.monitoring.sentry).toBeUndefined();
      expect(config.monitoring.analytics).toBeUndefined();
    });
  });

  describe('Environment-Specific Defaults', () => {
    it('should enable security features in production', async () => {
      process.env.NEXT_PUBLIC_ENVIRONMENT = 'production';
      
      const { config } = await import('../../src/lib/config');
      
      expect(config.security.enableCSP).toBe(true);
      expect(config.security.enableSecurityHeaders).toBe(true);
      expect(config.security.rateLimiting.enabled).toBe(true);
      expect(config.features.enableExperimental).toBe(false);
      expect(config.debug.logLevel).toBe('error');
    });

    it('should enable development features in development', async () => {
      process.env.NEXT_PUBLIC_ENVIRONMENT = 'development';
      
      const { config } = await import('../../src/lib/config');
      
      expect(config.debug.enabled).toBe(true);
      expect(config.debug.enableProfiler).toBe(true);
      expect(config.debug.showDevTools).toBe(true);
      expect(config.debug.logLevel).toBe('debug');
      expect(config.features.enableExperimental).toBe(true);
    });
  });

  describe('Development Console Output', () => {
    it('should log configuration in development on client-side', async () => {
      (global as any).window = {};
      process.env.NEXT_PUBLIC_ENVIRONMENT = 'development';
      
      await import('../../src/lib/config');
      
      expect(mockConsole.group).toHaveBeenCalledWith('🔧 Chronicle Configuration');
      expect(mockConsole.log).toHaveBeenCalledWith('Environment:', 'development');
      expect(mockConsole.groupEnd).toHaveBeenCalled();
    });

    it('should not log configuration in production', async () => {
      (global as any).window = {};
      process.env.NEXT_PUBLIC_ENVIRONMENT = 'production';
      
      await import('../../src/lib/config');
      
      expect(mockConsole.group).not.toHaveBeenCalled();
    });

    it('should not log configuration on server-side', async () => {
      delete (global as any).window;
      process.env.NEXT_PUBLIC_ENVIRONMENT = 'development';
      
      await import('../../src/lib/config');
      
      expect(mockConsole.group).not.toHaveBeenCalled();
    });
  });

  describe('Config Utils', () => {
    describe('Feature checks', () => {
      it('should check feature enablement', async () => {
        process.env.NEXT_PUBLIC_ENABLE_REALTIME = 'false';
        process.env.NEXT_PUBLIC_ENABLE_ANALYTICS = 'true';
        
        const { configUtils } = await import('../../src/lib/config');
        
        expect(configUtils.isFeatureEnabled('enableRealtime')).toBe(false);
        expect(configUtils.isFeatureEnabled('enableAnalytics')).toBe(true);
      });

      it('should check debug enablement', async () => {
        process.env.NEXT_PUBLIC_DEBUG = 'true';
        
        const { configUtils } = await import('../../src/lib/config');
        expect(configUtils.isDebugEnabled()).toBe(true);
      });
    });

    describe('Configuration getters', () => {
      it('should return supabase configuration', async () => {
        const { config, configUtils } = await import('../../src/lib/config');
        
        expect(configUtils.getSupabaseConfig()).toEqual(config.supabase);
      });

      it('should return monitoring configuration', async () => {
        const { config, configUtils } = await import('../../src/lib/config');
        
        expect(configUtils.getMonitoringConfig()).toEqual(config.monitoring);
      });
    });

    describe('Logging', () => {
      it('should log messages based on log level', async () => {
        process.env.NEXT_PUBLIC_LOG_LEVEL = 'info';
        
        const { configUtils } = await import('../../src/lib/config');
        
        configUtils.log('error', 'Error message');
        configUtils.log('warn', 'Warning message');
        configUtils.log('info', 'Info message');
        configUtils.log('debug', 'Debug message'); // Should not log
        
        expect(mockConsole.error).toHaveBeenCalledWith(
          '[Chronicle:ERROR]', 'Error message'
        );
        expect(mockConsole.warn).toHaveBeenCalledWith(
          '[Chronicle:WARN]', 'Warning message'
        );
        expect(mockConsole.info).toHaveBeenCalledWith(
          '[Chronicle:INFO]', 'Info message'
        );
        expect(mockConsole.debug).not.toHaveBeenCalled();
      });

      it('should log with additional arguments', async () => {
        process.env.NEXT_PUBLIC_LOG_LEVEL = 'debug';
        
        const { configUtils } = await import('../../src/lib/config');
        
        const obj = { key: 'value' };
        configUtils.log('info', 'Message with data', obj, 123);
        
        expect(mockConsole.info).toHaveBeenCalledWith(
          '[Chronicle:INFO]', 'Message with data', obj, 123
        );
      });

      it('should respect log level hierarchy', async () => {
        process.env.NEXT_PUBLIC_LOG_LEVEL = 'warn';
        
        const { configUtils } = await import('../../src/lib/config');
        
        configUtils.log('error', 'Should log');
        configUtils.log('warn', 'Should log');
        configUtils.log('info', 'Should not log');
        configUtils.log('debug', 'Should not log');
        
        expect(mockConsole.error).toHaveBeenCalled();
        expect(mockConsole.warn).toHaveBeenCalled();
        expect(mockConsole.info).not.toHaveBeenCalled();
        expect(mockConsole.debug).not.toHaveBeenCalled();
      });
    });
  });

  describe('Complex Configuration Scenarios', () => {
    it('should handle partial monitoring configuration', async () => {
      process.env.SENTRY_DSN = 'https://test@sentry.io/123';
      // Don't set analytics
      
      const { config } = await import('../../src/lib/config');
      
      expect(config.monitoring.sentry).toBeDefined();
      expect(config.monitoring.analytics).toBeUndefined();
    });

    it('should handle all monitoring features enabled', async () => {
      process.env.SENTRY_DSN = 'https://test@sentry.io/123';
      process.env.SENTRY_DEBUG = 'true';
      process.env.SENTRY_SAMPLE_RATE = '0.8';
      process.env.SENTRY_TRACES_SAMPLE_RATE = '0.2';
      process.env.NEXT_PUBLIC_ANALYTICS_ID = 'GA-123';
      process.env.NEXT_PUBLIC_ENABLE_ANALYTICS_TRACKING = 'true';
      
      const { config } = await import('../../src/lib/config');
      
      expect(config.monitoring.sentry).toEqual({
        dsn: 'https://test@sentry.io/123',
        environment: 'development',
        debug: true,
        sampleRate: 0.8,
        tracesSampleRate: 0.2,
      });
      
      expect(config.monitoring.analytics).toEqual({
        id: 'GA-123',
        trackingEnabled: true,
      });
    });

    it('should handle custom performance settings', async () => {
      process.env.NEXT_PUBLIC_MAX_EVENTS_DISPLAY = '2000';
      process.env.NEXT_PUBLIC_POLLING_INTERVAL = '10000';
      process.env.NEXT_PUBLIC_BATCH_SIZE = '100';
      process.env.NEXT_PUBLIC_REALTIME_TIMEOUT = '20000';
      
      const { config } = await import('../../src/lib/config');
      
      expect(config.performance).toEqual({
        maxEventsDisplay: 2000,
        pollingInterval: 10000,
        batchSize: 100,
        realtimeHeartbeat: 30000, // From mocked constants
        realtimeTimeout: 20000,
      });
    });

    it('should handle rate limiting window conversion', async () => {
      process.env.NEXT_PUBLIC_RATE_LIMIT_WINDOW = '600'; // 10 minutes in seconds
      
      const { config } = await import('../../src/lib/config');
      
      expect(config.security.rateLimiting.windowMs).toBe(600000); // Converted to milliseconds
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing NODE_ENV gracefully', async () => {
      delete process.env.NODE_ENV;
      
      const { config } = await import('../../src/lib/config');
      expect(config.nodeEnv).toBe('development'); // Default value
    });

    it('should handle empty string environment variables', async () => {
      process.env.NEXT_PUBLIC_APP_TITLE = '';
      
      const { config } = await import('../../src/lib/config');
      expect(config.appTitle).toBe(''); // Empty string preserved
    });

    it('should handle malformed floating point numbers', async () => {
      process.env.SENTRY_SAMPLE_RATE = 'not-a-number';
      process.env.SENTRY_TRACES_SAMPLE_RATE = '';
      process.env.SENTRY_DSN = 'https://test@sentry.io/123';
      
      const { config } = await import('../../src/lib/config');
      
      expect(config.monitoring.sentry!.sampleRate).toBeNaN();
      expect(config.monitoring.sentry!.tracesSampleRate).toBeNaN();
    });

    it('should handle extreme numeric values', async () => {
      process.env.NEXT_PUBLIC_MAX_EVENTS_DISPLAY = '999999999';
      process.env.NEXT_PUBLIC_POLLING_INTERVAL = '0';
      
      const { config } = await import('../../src/lib/config');
      
      expect(config.performance.maxEventsDisplay).toBe(999999999);
      expect(config.performance.pollingInterval).toBe(0);
    });

    it('should handle boolean-like strings correctly', async () => {
      process.env.NEXT_PUBLIC_DEBUG = 'TRUE'; // Uppercase
      process.env.NEXT_PUBLIC_ENABLE_REALTIME = 'False'; // Mixed case
      process.env.NEXT_PUBLIC_ENABLE_ANALYTICS = '1'; // Numeric-like
      
      const { config } = await import('../../src/lib/config');
      
      expect(config.debug.enabled).toBe(true);
      expect(config.features.enableRealtime).toBe(false);
      expect(config.features.enableAnalytics).toBe(false); // '1' is not 'true'
    });

    it('should handle undefined vs empty string differences', async () => {
      process.env.NEXT_PUBLIC_APP_TITLE = '';
      delete process.env.SENTRY_DSN; // undefined
      
      const { config } = await import('../../src/lib/config');
      
      expect(config.appTitle).toBe(''); // Empty string
      expect(config.monitoring.sentry).toBeUndefined(); // Not configured
    });
  });

  describe('Type Safety', () => {
    it('should maintain type safety for environment types', async () => {
      const { config } = await import('../../src/lib/config');
      
      const env: Environment = config.environment;
      expect(['development', 'staging', 'production']).toContain(env);
    });

    it('should maintain type safety for log levels', async () => {
      const { config } = await import('../../src/lib/config');
      
      const logLevel: LogLevel = config.debug.logLevel;
      expect(['error', 'warn', 'info', 'debug']).toContain(logLevel);
    });

    it('should maintain type safety for theme', async () => {
      process.env.NEXT_PUBLIC_DEFAULT_THEME = 'light';
      
      const { config } = await import('../../src/lib/config');
      
      const theme: Theme = config.ui.defaultTheme;
      expect(['light', 'dark']).toContain(theme);
    });
  });

  describe('Performance Considerations', () => {
    it('should create configuration efficiently', async () => {
      const start = performance.now();
      
      await import('../../src/lib/config');
      
      const end = performance.now();
      expect(end - start).toBeLessThan(100); // Should be very fast
    });

    it('should not re-evaluate configuration on multiple imports', async () => {
      const { config: config1 } = await import('../../src/lib/config');
      const { config: config2 } = await import('../../src/lib/config');
      
      expect(config1).toBe(config2); // Should be the same object reference
    });
  });
});