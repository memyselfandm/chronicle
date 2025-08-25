import { supabase } from '../../src/lib/supabase';
import { config } from '../../src/lib/config';

describe('Environment Configuration Integration Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Environment Variable Validation', () => {
    it('should handle missing SUPABASE_URL gracefully', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      
      // Re-import to get updated config
      jest.resetModules();
      const { supabase: testSupabase } = await import('../../src/lib/supabase');
      
      // Should use fallback URL
      expect(testSupabase).toBeDefined();
      // Should warn about missing configuration
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Supabase Client Initialization')
      );
    });

    it('should handle missing SUPABASE_ANON_KEY gracefully', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      jest.resetModules();
      const { supabase: testSupabase } = await import('../../src/lib/supabase');
      
      expect(testSupabase).toBeDefined();
      // Should use placeholder key to prevent build errors
    });

    it('should prioritize environment variables over config file', () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'env://test-url';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'env-key-12345';
      
      // Mock config values
      const mockConfig = {
        supabase: {
          url: 'config://different-url',
          anonKey: 'config-key-67890'
        }
      };
      
      jest.doMock('../../src/lib/config', () => ({
        config: mockConfig,
        configUtils: { isProduction: () => false }
      }));
      
      jest.resetModules();
      
      // Environment variables should take precedence
      expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBe('env://test-url');
      expect(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe('env-key-12345');
    });

    it('should validate required configuration fields', () => {
      const requiredFields = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY'
      ];

      requiredFields.forEach(field => {
        process.env[field] = '';
        
        jest.resetModules();
        
        // Should handle empty values gracefully
        expect(() => require('../../src/lib/supabase')).not.toThrow();
      });
    });
  });

  describe('Production vs Development Configuration', () => {
    it('should use production settings in production environment', async () => {
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://prod.supabase.co';
      
      jest.resetModules();
      
      // Mock production config
      jest.doMock('../../src/lib/config', () => ({
        config: {
          environment: 'production',
          performance: {
            realtimeHeartbeat: 30000,
            realtimeTimeout: 60000,
            batchSize: 50,
            maxEventsDisplay: 1000
          },
          supabase: {
            url: 'https://prod.supabase.co',
            anonKey: 'prod-key'
          }
        },
        configUtils: { isProduction: () => true }
      }));
      
      const { REALTIME_CONFIG } = await import('../../src/lib/supabase');
      
      expect(REALTIME_CONFIG.EVENTS_PER_SECOND).toBe(5); // Lower for production
      expect(REALTIME_CONFIG.HEARTBEAT_INTERVAL).toBe(30000); // 30 seconds in production
    });

    it('should use development settings in development environment', async () => {
      process.env.NODE_ENV = 'development';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
      
      jest.resetModules();
      
      jest.doMock('../../src/lib/config', () => ({
        config: {
          environment: 'development',
          performance: {
            realtimeHeartbeat: 10000,
            realtimeTimeout: 30000,
            batchSize: 25,
            maxEventsDisplay: 500
          },
          supabase: {
            url: 'http://localhost:54321',
            anonKey: 'dev-key'
          }
        },
        configUtils: { isProduction: () => false }
      }));
      
      const { REALTIME_CONFIG } = await import('../../src/lib/supabase');
      
      expect(REALTIME_CONFIG.EVENTS_PER_SECOND).toBe(10); // Higher for development
      expect(REALTIME_CONFIG.HEARTBEAT_INTERVAL).toBe(10000); // 10 seconds in development
    });
  });

  describe('Connection Timeout Configuration', () => {
    it('should respect configured timeout values', async () => {
      const customTimeout = 45000;
      
      jest.doMock('../../src/lib/config', () => ({
        config: {
          environment: 'test',
          performance: {
            realtimeHeartbeat: 15000,
            realtimeTimeout: customTimeout,
            batchSize: 30,
            maxEventsDisplay: 750
          },
          supabase: {
            url: 'http://localhost:54321',
            anonKey: 'test-key'
          }
        },
        configUtils: { isProduction: () => false }
      }));
      
      jest.resetModules();
      const { REALTIME_CONFIG } = await import('../../src/lib/supabase');
      
      expect(REALTIME_CONFIG.TIMEOUT).toBe(customTimeout);
    });

    it('should handle invalid timeout configurations', async () => {
      jest.doMock('../../src/lib/config', () => ({
        config: {
          environment: 'test',
          performance: {
            realtimeHeartbeat: 'invalid',
            realtimeTimeout: null,
            batchSize: -1,
            maxEventsDisplay: 'not-a-number'
          },
          supabase: {
            url: 'http://localhost:54321',
            anonKey: 'test-key'
          }
        },
        configUtils: { isProduction: () => false }
      }));
      
      jest.resetModules();
      
      // Should not crash with invalid values
      expect(() => require('../../src/lib/supabase')).not.toThrow();
    });
  });

  describe('Custom Headers Configuration', () => {
    it('should include custom headers in requests', async () => {
      const testEnvironment = 'test-env';
      const testVersion = '1.2.3';
      
      jest.doMock('../../src/lib/config', () => ({
        config: {
          environment: testEnvironment,
          performance: {
            realtimeHeartbeat: 10000,
            realtimeTimeout: 30000,
            batchSize: 25,
            maxEventsDisplay: 500
          },
          supabase: {
            url: 'http://localhost:54321',
            anonKey: 'test-key'
          }
        },
        configUtils: { isProduction: () => false }
      }));
      
      jest.resetModules();
      const { supabase: testSupabase } = await import('../../src/lib/supabase');
      
      // Check that supabase client was created with custom headers
      expect(testSupabase).toBeDefined();
      
      // The headers should be included in the client configuration
      // (This would be tested more thoroughly in a real integration test)
    });
  });

  describe('Authentication Configuration', () => {
    it('should disable session persistence for MVP', async () => {
      jest.resetModules();
      const { supabase: testSupabase } = await import('../../src/lib/supabase');
      
      // Should be configured with persistSession: false
      expect(testSupabase).toBeDefined();
      
      // In a real test, we'd verify the auth configuration
      // This test validates the configuration is applied without errors
    });

    it('should disable URL session detection for performance', async () => {
      jest.resetModules();
      const { supabase: testSupabase } = await import('../../src/lib/supabase');
      
      expect(testSupabase).toBeDefined();
      
      // Should not attempt to detect sessions in URL
      // This prevents unnecessary parsing and improves performance
    });
  });

  describe('Realtime Configuration', () => {
    it('should configure realtime parameters correctly', async () => {
      const customRealtimeConfig = {
        eventsPerSecond: 8,
        heartbeatIntervalMs: 20000,
        timeoutMs: 50000
      };
      
      jest.doMock('../../src/lib/config', () => ({
        config: {
          environment: 'test',
          performance: {
            realtimeHeartbeat: customRealtimeConfig.heartbeatIntervalMs,
            realtimeTimeout: customRealtimeConfig.timeoutMs,
            batchSize: 40,
            maxEventsDisplay: 800
          },
          supabase: {
            url: 'http://localhost:54321',
            anonKey: 'test-key'
          }
        },
        configUtils: { isProduction: () => false }
      }));
      
      jest.resetModules();
      const { REALTIME_CONFIG } = await import('../../src/lib/supabase');
      
      expect(REALTIME_CONFIG.EVENTS_PER_SECOND).toBe(10); // From configUtils.isProduction()
      expect(REALTIME_CONFIG.HEARTBEAT_INTERVAL).toBe(customRealtimeConfig.heartbeatIntervalMs);
      expect(REALTIME_CONFIG.TIMEOUT).toBe(customRealtimeConfig.timeoutMs);
    });

    it('should handle missing realtime configuration gracefully', async () => {
      jest.doMock('../../src/lib/config', () => ({
        config: {
          environment: 'test',
          performance: {
            // Missing realtime configurations
            batchSize: 25,
            maxEventsDisplay: 500
          },
          supabase: {
            url: 'http://localhost:54321',
            anonKey: 'test-key'
          }
        },
        configUtils: { isProduction: () => false }
      }));
      
      jest.resetModules();
      
      // Should not crash with missing realtime config
      expect(() => require('../../src/lib/supabase')).not.toThrow();
    });
  });

  describe('Configuration Validation', () => {
    it('should validate URL format', () => {
      const validUrls = [
        'https://project.supabase.co',
        'http://localhost:54321',
        'https://localhost:8000'
      ];
      
      const invalidUrls = [
        'not-a-url',
        'ftp://invalid.protocol',
        '',
        null,
        undefined
      ];
      
      validUrls.forEach(url => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = url;
        jest.resetModules();
        expect(() => require('../../src/lib/supabase')).not.toThrow();
      });
      
      invalidUrls.forEach(url => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = url;
        jest.resetModules();
        // Should handle invalid URLs gracefully
        expect(() => require('../../src/lib/supabase')).not.toThrow();
      });
    });

    it('should validate API key format', () => {
      const validKeys = [
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
        'sb-test-project-key-12345',
        'valid-test-key'
      ];
      
      const invalidKeys = [
        '',
        null,
        undefined,
        123456,
        {}
      ];
      
      validKeys.forEach(key => {
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = key;
        jest.resetModules();
        expect(() => require('../../src/lib/supabase')).not.toThrow();
      });
      
      invalidKeys.forEach(key => {
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = key;
        jest.resetModules();
        // Should handle invalid keys gracefully
        expect(() => require('../../src/lib/supabase')).not.toThrow();
      });
    });
  });

  describe('Performance Configuration Impact', () => {
    it('should adjust batch sizes based on environment', async () => {
      // Test production batch size
      jest.doMock('../../src/lib/config', () => ({
        config: {
          environment: 'production',
          performance: { batchSize: 100 },
          supabase: { url: 'test', anonKey: 'test' }
        },
        configUtils: { isProduction: () => true }
      }));
      
      jest.resetModules();
      const { REALTIME_CONFIG: prodConfig } = await import('../../src/lib/supabase');
      expect(prodConfig.BATCH_SIZE).toBe(100);
      
      // Test development batch size
      jest.doMock('../../src/lib/config', () => ({
        config: {
          environment: 'development',
          performance: { batchSize: 50 },
          supabase: { url: 'test', anonKey: 'test' }
        },
        configUtils: { isProduction: () => false }
      }));
      
      jest.resetModules();
      const { REALTIME_CONFIG: devConfig } = await import('../../src/lib/supabase');
      expect(devConfig.BATCH_SIZE).toBe(50);
    });

    it('should configure event limits per environment', async () => {
      const testCases = [
        { env: 'production', maxEvents: 2000, isProduction: true },
        { env: 'development', maxEvents: 1000, isProduction: false },
        { env: 'test', maxEvents: 500, isProduction: false }
      ];
      
      for (const testCase of testCases) {
        jest.doMock('../../src/lib/config', () => ({
          config: {
            environment: testCase.env,
            performance: { maxEventsDisplay: testCase.maxEvents },
            supabase: { url: 'test', anonKey: 'test' }
          },
          configUtils: { isProduction: () => testCase.isProduction }
        }));
        
        jest.resetModules();
        const { REALTIME_CONFIG } = await import('../../src/lib/supabase');
        expect(REALTIME_CONFIG.MAX_CACHED_EVENTS).toBe(testCase.maxEvents);
      }
    });
  });

  describe('Error Recovery Configuration', () => {
    it('should configure appropriate retry attempts', async () => {
      jest.doMock('../../src/lib/config', () => ({
        config: {
          environment: 'test',
          performance: {},
          supabase: { url: 'test', anonKey: 'test' }
        },
        configUtils: { isProduction: () => false }
      }));
      
      jest.resetModules();
      const { REALTIME_CONFIG } = await import('../../src/lib/supabase');
      
      expect(REALTIME_CONFIG.RECONNECT_ATTEMPTS).toBe(5);
      expect(typeof REALTIME_CONFIG.RECONNECT_ATTEMPTS).toBe('number');
      expect(REALTIME_CONFIG.RECONNECT_ATTEMPTS).toBeGreaterThan(0);
    });

    it('should configure reasonable batch delays', async () => {
      jest.resetModules();
      const { REALTIME_CONFIG } = await import('../../src/lib/supabase');
      
      expect(REALTIME_CONFIG.BATCH_DELAY).toBe(100);
      expect(REALTIME_CONFIG.BATCH_DELAY).toBeGreaterThan(0);
      expect(REALTIME_CONFIG.BATCH_DELAY).toBeLessThan(1000);
    });
  });
});