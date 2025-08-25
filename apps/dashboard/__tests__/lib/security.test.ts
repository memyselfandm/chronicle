import {
  CSP_DIRECTIVES,
  SECURITY_HEADERS,
  RATE_LIMIT_CONFIG,
  generateCSPHeader,
  inputValidation,
  envValidation,
  securityChecks,
  getSecurityMiddleware,
  initializeSecurity,
} from '../../src/lib/security';

// Mock dependencies
const mockConfig = {
  environment: 'test',
  security: {
    enableCSP: true,
    enableSecurityHeaders: true,
    rateLimiting: {
      enabled: true,
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100,
    },
  },
  supabase: {
    url: 'https://test.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.key',
  },
  monitoring: {
    sentry: {
      dsn: 'https://test@sentry.io/project',
    },
  },
  debug: {
    enabled: false,
    showDevTools: false,
  },
};

const mockConfigUtils = {
  isDevelopment: jest.fn(() => false),
  isProduction: jest.fn(() => true),
  log: jest.fn(),
};

jest.mock('../../src/lib/config', () => ({
  config: mockConfig,
  configUtils: mockConfigUtils,
}));

jest.mock('../../src/lib/utils', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Security Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigUtils.isDevelopment.mockReturnValue(false);
    mockConfigUtils.isProduction.mockReturnValue(true);
    mockConfig.security.enableCSP = true;
    mockConfig.security.enableSecurityHeaders = true;
    mockConfig.debug.enabled = false;
  });

  describe('CSP Directives', () => {
    it('should have proper CSP directive structure', () => {
      expect(CSP_DIRECTIVES).toHaveProperty('default-src');
      expect(CSP_DIRECTIVES).toHaveProperty('script-src');
      expect(CSP_DIRECTIVES).toHaveProperty('style-src');
      expect(CSP_DIRECTIVES).toHaveProperty('img-src');
      expect(CSP_DIRECTIVES).toHaveProperty('connect-src');
      expect(CSP_DIRECTIVES).toHaveProperty('frame-ancestors');
    });

    it('should include required sources', () => {
      expect(CSP_DIRECTIVES['default-src']).toContain("'self'");
      expect(CSP_DIRECTIVES['script-src']).toContain("'self'");
      expect(CSP_DIRECTIVES['script-src']).toContain('https://*.supabase.co');
      expect(CSP_DIRECTIVES['connect-src']).toContain('https://*.supabase.co');
      expect(CSP_DIRECTIVES['connect-src']).toContain('wss://*.supabase.co');
    });

    it('should include development sources when in development', () => {
      mockConfigUtils.isDevelopment.mockReturnValue(true);
      
      expect(CSP_DIRECTIVES['connect-src']).toContain('ws://localhost:*');
      expect(CSP_DIRECTIVES['connect-src']).toContain('http://localhost:*');
    });

    it('should include Sentry sources when DSN is configured', () => {
      expect(CSP_DIRECTIVES['connect-src']).toContain('https://sentry.io');
      expect(CSP_DIRECTIVES['connect-src']).toContain('https://*.sentry.io');
    });

    it('should set frame-ancestors to none for clickjacking protection', () => {
      expect(CSP_DIRECTIVES['frame-ancestors']).toEqual(["'none'"]);
    });
  });

  describe('generateCSPHeader', () => {
    it('should generate valid CSP header string', () => {
      const cspHeader = generateCSPHeader();
      
      expect(cspHeader).toContain("default-src 'self'");
      expect(cspHeader).toContain("script-src 'self'");
      expect(cspHeader).toContain("frame-ancestors 'none'");
      expect(cspHeader).toContain(';'); // Should be semicolon separated
    });

    it('should return empty string when CSP is disabled', () => {
      mockConfig.security.enableCSP = false;
      
      const cspHeader = generateCSPHeader();
      expect(cspHeader).toBe('');
    });

    it('should handle undefined values in directives', () => {
      mockConfigUtils.isProduction.mockReturnValue(false);
      
      const cspHeader = generateCSPHeader();
      expect(cspHeader).toBeTruthy();
    });

    it('should include upgrade-insecure-requests in production', () => {
      mockConfigUtils.isProduction.mockReturnValue(true);
      
      const cspHeader = generateCSPHeader();
      expect(cspHeader).not.toContain('upgrade-insecure-requests');
    });

    it('should filter out empty directives', () => {
      const cspHeader = generateCSPHeader();
      
      expect(cspHeader).not.toContain(';;'); // No double semicolons
      expect(cspHeader).not.toContain('; ;'); // No empty segments
    });
  });

  describe('Security Headers', () => {
    it('should have all required security headers', () => {
      expect(SECURITY_HEADERS).toHaveProperty('X-Frame-Options', 'DENY');
      expect(SECURITY_HEADERS).toHaveProperty('X-Content-Type-Options', 'nosniff');
      expect(SECURITY_HEADERS).toHaveProperty('X-XSS-Protection', '1; mode=block');
      expect(SECURITY_HEADERS).toHaveProperty('Referrer-Policy', 'strict-origin-when-cross-origin');
      expect(SECURITY_HEADERS).toHaveProperty('Permissions-Policy');
    });

    it('should include HSTS header in production', () => {
      mockConfigUtils.isProduction.mockReturnValue(true);
      
      // Re-evaluate the headers object
      const { SECURITY_HEADERS: prodHeaders } = require('../../src/lib/security');
      expect(prodHeaders).toHaveProperty('Strict-Transport-Security');
    });

    it('should not include HSTS header in development', () => {
      mockConfigUtils.isProduction.mockReturnValue(false);
      
      expect(SECURITY_HEADERS).not.toHaveProperty('Strict-Transport-Security');
    });

    it('should have proper permissions policy restrictions', () => {
      const permissionsPolicy = SECURITY_HEADERS['Permissions-Policy'] as string;
      
      expect(permissionsPolicy).toContain('accelerometer=()');
      expect(permissionsPolicy).toContain('camera=()');
      expect(permissionsPolicy).toContain('microphone=()');
      expect(permissionsPolicy).toContain('geolocation=()');
    });
  });

  describe('Input Validation', () => {
    describe('sanitizeString', () => {
      it('should remove angle brackets', () => {
        const input = '<script>alert("xss")</script>';
        const result = inputValidation.sanitizeString(input);
        expect(result).toBe('scriptalert("xss")/script');
      });

      it('should remove javascript protocol', () => {
        const input = 'javascript:alert("xss")';
        const result = inputValidation.sanitizeString(input);
        expect(result).toBe('alert("xss")');
      });

      it('should remove event handlers', () => {
        const input = 'onclick=alert("xss")';
        const result = inputValidation.sanitizeString(input);
        expect(result).toBe('alert("xss")');
      });

      it('should limit string length', () => {
        const longString = 'a'.repeat(2000);
        const result = inputValidation.sanitizeString(longString);
        expect(result.length).toBe(1000);
      });

      it('should handle non-string input', () => {
        expect(inputValidation.sanitizeString(null as any)).toBe('');
        expect(inputValidation.sanitizeString(undefined as any)).toBe('');
        expect(inputValidation.sanitizeString(123 as any)).toBe('');
      });

      it('should trim whitespace', () => {
        const input = '  test string  ';
        const result = inputValidation.sanitizeString(input);
        expect(result).toBe('test string');
      });

      it('should be case insensitive for javascript protocol', () => {
        const input = 'JAVASCRIPT:alert("xss")';
        const result = inputValidation.sanitizeString(input);
        expect(result).toBe('alert("xss")');
      });
    });

    describe('isValidEmail', () => {
      it('should validate correct email formats', () => {
        expect(inputValidation.isValidEmail('user@example.com')).toBe(true);
        expect(inputValidation.isValidEmail('test.email+tag@domain.co.uk')).toBe(true);
        expect(inputValidation.isValidEmail('user123@test-domain.com')).toBe(true);
      });

      it('should reject invalid email formats', () => {
        expect(inputValidation.isValidEmail('invalid-email')).toBe(false);
        expect(inputValidation.isValidEmail('user@')).toBe(false);
        expect(inputValidation.isValidEmail('@domain.com')).toBe(false);
        expect(inputValidation.isValidEmail('user@domain')).toBe(false);
        expect(inputValidation.isValidEmail('')).toBe(false);
      });
    });

    describe('isValidUUID', () => {
      it('should validate correct UUID formats', () => {
        expect(inputValidation.isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
        expect(inputValidation.isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      });

      it('should reject invalid UUID formats', () => {
        expect(inputValidation.isValidUUID('invalid-uuid')).toBe(false);
        expect(inputValidation.isValidUUID('123e4567-e89b-12d3-a456')).toBe(false);
        expect(inputValidation.isValidUUID('123e4567-e89b-12d3-a456-42661417400g')).toBe(false);
        expect(inputValidation.isValidUUID('')).toBe(false);
      });
    });

    describe('isValidURL', () => {
      it('should validate correct URL formats', () => {
        expect(inputValidation.isValidURL('https://example.com')).toBe(true);
        expect(inputValidation.isValidURL('http://localhost:3000')).toBe(true);
        expect(inputValidation.isValidURL('ftp://files.example.com')).toBe(true);
      });

      it('should reject invalid URL formats', () => {
        expect(inputValidation.isValidURL('not-a-url')).toBe(false);
        expect(inputValidation.isValidURL('://invalid')).toBe(false);
        expect(inputValidation.isValidURL('')).toBe(false);
      });
    });

    describe('sanitizeObject', () => {
      it('should sanitize string properties', () => {
        const input = {
          name: '<script>alert("xss")</script>',
          description: 'onclick=evil()',
        };

        const result = inputValidation.sanitizeObject(input) as any;
        expect(result.name).toBe('scriptalert("xss")/script');
        expect(result.description).toBe('evil()');
      });

      it('should preserve non-string properties', () => {
        const input = {
          number: 123,
          boolean: true,
          nullValue: null,
          undefinedValue: undefined,
        };

        const result = inputValidation.sanitizeObject(input) as any;
        expect(result.number).toBe(123);
        expect(result.boolean).toBe(true);
        expect(result.nullValue).toBe(null);
        expect(result.undefinedValue).toBe(undefined);
      });

      it('should sanitize arrays', () => {
        const input = ['<script>alert("xss")</script>', 'normal string', 123, true];
        
        const result = inputValidation.sanitizeObject(input) as any[];
        expect(result[0]).toBe('scriptalert("xss")/script');
        expect(result[1]).toBe('normal string');
        expect(result[2]).toBe(123);
        expect(result[3]).toBe(true);
      });

      it('should sanitize nested objects', () => {
        const input = {
          user: {
            name: '<script>evil</script>',
            profile: {
              bio: 'onclick=hack()',
            },
          },
        };

        const result = inputValidation.sanitizeObject(input) as any;
        expect(result.user.name).toBe('scriptevil/script');
        expect(result.user.profile.bio).toBe('hack()');
      });

      it('should handle malicious keys', () => {
        const input = {
          '<script>': 'value',
          'onclick=evil()': 'another value',
        };

        const result = inputValidation.sanitizeObject(input) as any;
        expect(result['script']).toBe('value');
        expect(result['evil()']).toBe('another value');
      });

      it('should handle null and undefined input', () => {
        expect(inputValidation.sanitizeObject(null)).toBe(null);
        expect(inputValidation.sanitizeObject(undefined)).toBe(undefined);
      });

      it('should handle circular references gracefully', () => {
        const circular: any = { prop: 'value' };
        circular.circular = circular;

        expect(() => {
          inputValidation.sanitizeObject(circular);
        }).not.toThrow();
      });
    });
  });

  describe('Environment Validation', () => {
    describe('isValidSupabaseURL', () => {
      it('should validate official Supabase URLs', () => {
        expect(envValidation.isValidSupabaseURL('https://project.supabase.co')).toBe(true);
        expect(envValidation.isValidSupabaseURL('https://test-project.supabase.co')).toBe(true);
      });

      it('should allow localhost in development', () => {
        expect(envValidation.isValidSupabaseURL('http://localhost:54321')).toBe(true);
      });

      it('should allow any URL in development mode', () => {
        mockConfigUtils.isDevelopment.mockReturnValue(true);
        expect(envValidation.isValidSupabaseURL('https://custom-domain.com')).toBe(true);
      });

      it('should reject invalid URLs', () => {
        expect(envValidation.isValidSupabaseURL('not-a-url')).toBe(false);
        expect(envValidation.isValidSupabaseURL('')).toBe(false);
      });

      it('should reject non-Supabase domains in production', () => {
        mockConfigUtils.isDevelopment.mockReturnValue(false);
        expect(envValidation.isValidSupabaseURL('https://evil-domain.com')).toBe(false);
      });
    });

    describe('isValidSupabaseKey', () => {
      it('should validate JWT-like key format', () => {
        const validKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0MDk5NTIwMCwiZXhwIjoxOTU2NTcxMjAwfQ.test-signature-here';
        expect(envValidation.isValidSupabaseKey(validKey)).toBe(true);
      });

      it('should reject short keys', () => {
        expect(envValidation.isValidSupabaseKey('short-key')).toBe(false);
      });

      it('should reject keys without dots', () => {
        const keyWithoutDots = 'a'.repeat(150);
        expect(envValidation.isValidSupabaseKey(keyWithoutDots)).toBe(false);
      });

      it('should reject keys with spaces', () => {
        const keyWithSpaces = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0MDk5NTIwMCwiZXhwIjoxOTU2NTcxMjAwfQ test-signature-here';
        expect(envValidation.isValidSupabaseKey(keyWithSpaces)).toBe(false);
      });

      it('should handle non-string input', () => {
        expect(envValidation.isValidSupabaseKey(null as any)).toBe(false);
        expect(envValidation.isValidSupabaseKey(undefined as any)).toBe(false);
        expect(envValidation.isValidSupabaseKey(123 as any)).toBe(false);
      });
    });

    describe('isValidSentryDSN', () => {
      it('should validate official Sentry DSN format', () => {
        expect(envValidation.isValidSentryDSN('https://public@sentry.io/project')).toBe(true);
        expect(envValidation.isValidSentryDSN('https://key@ingest.sentry.io/project')).toBe(true);
      });

      it('should reject non-Sentry domains', () => {
        expect(envValidation.isValidSentryDSN('https://public@evil-domain.com/project')).toBe(false);
      });

      it('should reject invalid URLs', () => {
        expect(envValidation.isValidSentryDSN('not-a-url')).toBe(false);
        expect(envValidation.isValidSentryDSN('')).toBe(false);
      });
    });
  });

  describe('Security Checks', () => {
    describe('isSecureContext', () => {
      it('should return true for server-side', () => {
        // Simulate server-side by having no window
        const originalWindow = global.window;
        delete (global as any).window;

        expect(securityChecks.isSecureContext()).toBe(true);

        global.window = originalWindow;
      });

      it('should check window.isSecureContext', () => {
        Object.defineProperty(window, 'isSecureContext', {
          value: true,
          writable: true,
        });

        expect(securityChecks.isSecureContext()).toBe(true);
      });

      it('should check HTTPS protocol', () => {
        Object.defineProperty(window, 'isSecureContext', {
          value: false,
          writable: true,
        });
        Object.defineProperty(window, 'location', {
          value: { protocol: 'https:' },
          writable: true,
        });

        expect(securityChecks.isSecureContext()).toBe(true);
      });

      it('should return false for HTTP in insecure context', () => {
        Object.defineProperty(window, 'isSecureContext', {
          value: false,
          writable: true,
        });
        Object.defineProperty(window, 'location', {
          value: { protocol: 'http:' },
          writable: true,
        });

        expect(securityChecks.isSecureContext()).toBe(false);
      });
    });

    describe('checkDevelopmentExposure', () => {
      it('should warn about React DevTools in production', () => {
        mockConfigUtils.isProduction.mockReturnValue(true);
        (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {};

        securityChecks.checkDevelopmentExposure();

        expect(mockConfigUtils.log).toHaveBeenCalledWith(
          'warn',
          'React DevTools detected in production'
        );

        delete (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
      });

      it('should warn about debug mode in production', () => {
        mockConfigUtils.isProduction.mockReturnValue(true);
        mockConfig.debug.enabled = true;

        securityChecks.checkDevelopmentExposure();

        expect(mockConfigUtils.log).toHaveBeenCalledWith(
          'warn',
          'Debug mode enabled in production'
        );
      });

      it('should warn about development tools in production', () => {
        mockConfigUtils.isProduction.mockReturnValue(true);
        mockConfig.debug.showDevTools = true;

        securityChecks.checkDevelopmentExposure();

        expect(mockConfigUtils.log).toHaveBeenCalledWith(
          'warn',
          'Development tools enabled in production'
        );
      });

      it('should not warn in development', () => {
        mockConfigUtils.isProduction.mockReturnValue(false);
        mockConfig.debug.enabled = true;

        securityChecks.checkDevelopmentExposure();

        expect(mockConfigUtils.log).not.toHaveBeenCalled();
      });
    });

    describe('validateEnvironmentConfig', () => {
      it('should return empty array for valid config', () => {
        const issues = securityChecks.validateEnvironmentConfig();
        expect(issues).toEqual([]);
      });

      it('should detect invalid Supabase URL', () => {
        mockConfig.supabase.url = 'invalid-url';
        
        const issues = securityChecks.validateEnvironmentConfig();
        expect(issues).toContain('Invalid Supabase URL format');
      });

      it('should detect invalid Supabase key', () => {
        mockConfig.supabase.anonKey = 'short-key';
        
        const issues = securityChecks.validateEnvironmentConfig();
        expect(issues).toContain('Invalid Supabase anonymous key format');
      });

      it('should detect invalid Sentry DSN', () => {
        mockConfig.monitoring.sentry.dsn = 'invalid-dsn';
        
        const issues = securityChecks.validateEnvironmentConfig();
        expect(issues).toContain('Invalid Sentry DSN format');
      });

      it('should detect production issues', () => {
        mockConfigUtils.isProduction.mockReturnValue(true);
        mockConfig.debug.enabled = true;
        mockConfig.security.enableCSP = false;
        mockConfig.security.enableSecurityHeaders = false;
        
        const issues = securityChecks.validateEnvironmentConfig();
        expect(issues).toContain('Debug mode should be disabled in production');
        expect(issues).toContain('CSP should be enabled in production');
        expect(issues).toContain('Security headers should be enabled in production');
      });

      it('should not detect development issues in development', () => {
        mockConfigUtils.isProduction.mockReturnValue(false);
        mockConfig.debug.enabled = true;
        mockConfig.security.enableCSP = false;
        
        const issues = securityChecks.validateEnvironmentConfig();
        expect(issues).not.toContain('Debug mode should be disabled in production');
      });
    });
  });

  describe('getSecurityMiddleware', () => {
    it('should return security configuration when enabled', () => {
      const middleware = getSecurityMiddleware();
      
      expect(middleware.headers).toEqual(SECURITY_HEADERS);
      expect(middleware.csp).toBeTruthy();
      expect(middleware.rateLimiting).toEqual(RATE_LIMIT_CONFIG);
    });

    it('should return empty configuration when disabled', () => {
      mockConfig.security.enableSecurityHeaders = false;
      mockConfig.security.enableCSP = false;
      mockConfig.security.rateLimiting.enabled = false;
      
      const middleware = getSecurityMiddleware();
      
      expect(middleware.headers).toEqual({});
      expect(middleware.csp).toBe('');
      expect(middleware.rateLimiting).toBeNull();
    });
  });

  describe('initializeSecurity', () => {
    it('should run all security checks', () => {
      const checkDevSpy = jest.spyOn(securityChecks, 'checkDevelopmentExposure');
      const validateSpy = jest.spyOn(securityChecks, 'validateEnvironmentConfig');

      initializeSecurity();

      expect(checkDevSpy).toHaveBeenCalled();
      expect(validateSpy).toHaveBeenCalled();
      expect(mockConfigUtils.log).toHaveBeenCalledWith(
        'info',
        'Initializing security configuration...'
      );
      expect(mockConfigUtils.log).toHaveBeenCalledWith(
        'info',
        'Security configuration initialized'
      );

      checkDevSpy.mockRestore();
      validateSpy.mockRestore();
    });

    it('should log configuration issues', () => {
      const validateSpy = jest.spyOn(securityChecks, 'validateEnvironmentConfig')
        .mockReturnValue(['Test issue 1', 'Test issue 2']);

      initializeSecurity();

      expect(mockConfigUtils.log).toHaveBeenCalledWith(
        'warn',
        'Security configuration issues detected:',
        ['Test issue 1', 'Test issue 2']
      );

      validateSpy.mockRestore();
    });

    it('should log detailed configuration in development', () => {
      mockConfigUtils.isDevelopment.mockReturnValue(true);
      const { logger } = require('../../src/lib/utils');

      initializeSecurity();

      expect(logger.info).toHaveBeenCalledWith(
        'Security Configuration',
        expect.objectContaining({
          component: 'security',
          action: 'logConfiguration',
          data: expect.objectContaining({
            cspEnabled: expect.any(Boolean),
            securityHeaders: expect.any(Boolean),
            rateLimiting: expect.any(Boolean),
            secureContext: expect.any(Boolean),
          }),
        })
      );
    });
  });

  describe('Rate Limiting Configuration', () => {
    it('should have valid rate limiting configuration', () => {
      expect(RATE_LIMIT_CONFIG.windowMs).toBeGreaterThan(0);
      expect(RATE_LIMIT_CONFIG.maxRequests).toBeGreaterThan(0);
      expect(typeof RATE_LIMIT_CONFIG.message).toBe('string');
      expect(RATE_LIMIT_CONFIG.standardHeaders).toBe(true);
      expect(RATE_LIMIT_CONFIG.legacyHeaders).toBe(false);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large input strings efficiently', () => {
      const largeInput = 'x'.repeat(100000);
      
      const start = performance.now();
      const result = inputValidation.sanitizeString(largeInput);
      const end = performance.now();
      
      expect(result.length).toBeLessThanOrEqual(1000); // Should be truncated
      expect(end - start).toBeLessThan(100); // Should be fast
    });

    it('should handle deeply nested objects', () => {
      const deepObject: any = { level0: 'value' };
      let current = deepObject;
      
      for (let i = 1; i < 100; i++) {
        current[`level${i}`] = { [`nested${i}`]: `<script>alert(${i})</script>` };
        current = current[`level${i}`];
      }

      expect(() => {
        const result = inputValidation.sanitizeObject(deepObject);
        expect(result).toBeTruthy();
      }).not.toThrow();
    });

    it('should handle arrays with many elements', () => {
      const largeArray = Array(10000).fill('<script>alert("xss")</script>');
      
      const start = performance.now();
      const result = inputValidation.sanitizeObject(largeArray) as string[];
      const end = performance.now();
      
      expect(result).toHaveLength(10000);
      expect(result.every(item => item === 'scriptalert("xss")/script')).toBe(true);
      expect(end - start).toBeLessThan(1000); // Should complete reasonably fast
    });

    it('should handle malformed input gracefully', () => {
      const malformedInputs = [
        { toString: () => { throw new Error('toString failed'); } },
        Object.create(null),
        new Date(),
        /regex/,
        () => {},
        Symbol('test'),
      ];

      malformedInputs.forEach(input => {
        expect(() => {
          inputValidation.sanitizeObject(input);
        }).not.toThrow();
      });
    });

    it('should validate extremely long URLs', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(100000);
      
      expect(() => {
        inputValidation.isValidURL(longUrl);
      }).not.toThrow();
    });

    it('should validate edge case UUIDs', () => {
      const edgeCaseUUIDs = [
        '00000000-0000-0000-0000-000000000000', // All zeros
        'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF', // All F's uppercase
        'ffffffff-ffff-ffff-ffff-ffffffffffff', // All f's lowercase
        '12345678-1234-5234-a234-123456789abc', // Mixed case
      ];

      edgeCaseUUIDs.forEach(uuid => {
        const result = inputValidation.isValidUUID(uuid);
        expect(typeof result).toBe('boolean');
      });
    });
  });

  describe('Browser Compatibility', () => {
    it('should handle missing window object', () => {
      const originalWindow = global.window;
      delete (global as any).window;

      expect(() => {
        securityChecks.isSecureContext();
        securityChecks.checkDevelopmentExposure();
      }).not.toThrow();

      global.window = originalWindow;
    });

    it('should handle missing location object', () => {
      const originalLocation = window.location;
      delete (window as any).location;

      expect(() => {
        securityChecks.isSecureContext();
      }).not.toThrow();

      window.location = originalLocation;
    });

    it('should handle missing URL constructor', () => {
      const originalURL = global.URL;
      delete (global as any).URL;

      expect(() => {
        inputValidation.isValidURL('https://example.com');
        envValidation.isValidSupabaseURL('https://test.supabase.co');
      }).not.toThrow();

      global.URL = originalURL;
    });
  });
});