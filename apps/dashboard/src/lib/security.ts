/**
 * Chronicle Dashboard Security Configuration
 * Handles security headers, CSP, rate limiting, and input validation
 */

import { config, configUtils } from './config';
import { logger } from './utils';

/**
 * Content Security Policy configuration
 */
export const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-inline'", // Next.js requires this for development
    "'unsafe-eval'", // Required for development mode
    'https://vercel.live',
    'https://*.supabase.co',
  ],
  'style-src': [
    "'self'",
    "'unsafe-inline'", // Required for styled-components and Tailwind
    'https://fonts.googleapis.com',
  ],
  'img-src': [
    "'self'",
    'data:',
    'blob:',
    'https://*.supabase.co',
    'https://vercel.com',
  ],
  'font-src': [
    "'self'",
    'https://fonts.gstatic.com',
  ],
  'connect-src': [
    "'self'",
    'https://*.supabase.co',
    'wss://*.supabase.co',
    'https://vercel.live',
    ...(configUtils.isDevelopment() ? ['ws://localhost:*', 'http://localhost:*'] : []),
    ...(config.monitoring.sentry?.dsn ? ['https://sentry.io', 'https://*.sentry.io'] : []),
  ],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'upgrade-insecure-requests': configUtils.isProduction() ? [] : undefined,
} as const;

/**
 * Generate CSP header value
 */
export function generateCSPHeader(): string {
  if (!config.security.enableCSP) {
    return '';
  }
  
  const directives = Object.entries(CSP_DIRECTIVES)
    .filter(([_, value]) => value !== undefined)
    .map(([key, values]) => {
      if (Array.isArray(values) && values.length > 0) {
        return `${key} ${values.join(' ')}`;
      } else if (!Array.isArray(values)) {
        return key; // For directives like 'upgrade-insecure-requests'
      }
      return '';
    })
    .filter(Boolean)
    .join('; ');
  
  return directives;
}

/**
 * Security headers configuration
 */
export const SECURITY_HEADERS = {
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',
  
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // XSS protection
  'X-XSS-Protection': '1; mode=block',
  
  // Referrer policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Permissions policy
  'Permissions-Policy': [
    'accelerometer=()',
    'camera=()',
    'geolocation=()',
    'gyroscope=()',
    'magnetometer=()',
    'microphone=()',
    'payment=()',
    'usb=()',
  ].join(', '),
  
  // Strict Transport Security (HTTPS only)
  ...(configUtils.isProduction() ? {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  } : {}),
} as const;

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message: string;
  standardHeaders: boolean;
  legacyHeaders: boolean;
}

export const RATE_LIMIT_CONFIG: RateLimitConfig = {
  windowMs: config.security.rateLimiting.windowMs,
  maxRequests: config.security.rateLimiting.maxRequests,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
};

/**
 * Input validation utilities
 */
export const inputValidation = {
  /**
   * Sanitize string input to prevent XSS
   */
  sanitizeString(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }
    
    return input
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim()
      .slice(0, 1000); // Limit length
  },
  
  /**
   * Validate email format
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },
  
  /**
   * Validate UUID format
   */
  isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  },
  
  /**
   * Validate URL format
   */
  isValidURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },
  
  /**
   * Sanitize object for safe JSON serialization
   */
  sanitizeObject(obj: unknown): unknown {
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }
    
    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }
    
    if (typeof obj === 'object') {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = this.sanitizeString(key);
        if (sanitizedKey) {
          sanitized[sanitizedKey] = this.sanitizeObject(value);
        }
      }
      return sanitized;
    }
    
    return obj;
  },
};

/**
 * Environment variable validation
 */
export const envValidation = {
  /**
   * Validate Supabase URL format
   */
  isValidSupabaseURL(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.hostname.endsWith('.supabase.co') || 
             parsed.hostname === 'localhost' ||
             configUtils.isDevelopment();
    } catch {
      return false;
    }
  },
  
  /**
   * Validate Supabase key format (basic check)
   */
  isValidSupabaseKey(key: string): boolean {
    // Basic format check for JWT-like structure
    return typeof key === 'string' && 
           key.length > 100 && 
           key.includes('.') &&
           !key.includes(' ');
  },
  
  /**
   * Validate Sentry DSN format
   */
  isValidSentryDSN(dsn: string): boolean {
    try {
      const parsed = new URL(dsn);
      return parsed.hostname.includes('sentry.io') ||
             parsed.hostname.includes('ingest.sentry.io');
    } catch {
      return false;
    }
  },
};

/**
 * Security middleware configuration for Next.js
 */
export function getSecurityMiddleware() {
  return {
    headers: config.security.enableSecurityHeaders ? SECURITY_HEADERS : {},
    csp: config.security.enableCSP ? generateCSPHeader() : '',
    rateLimiting: config.security.rateLimiting.enabled ? RATE_LIMIT_CONFIG : null,
  };
}

/**
 * Runtime security checks
 */
export const securityChecks = {
  /**
   * Check if running in secure context
   */
  isSecureContext(): boolean {
    if (typeof window === 'undefined') {
      return true; // Server-side is considered secure
    }
    
    return window.isSecureContext || window.location.protocol === 'https:';
  },
  
  /**
   * Check for development environment exposure
   */
  checkDevelopmentExposure(): void {
    if (configUtils.isProduction() && typeof window !== 'undefined') {
      // Check for exposed development tools
      if ((window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        configUtils.log('warn', 'React DevTools detected in production');
      }
      
      // Check for debug flags
      if (config.debug.enabled) {
        configUtils.log('warn', 'Debug mode enabled in production');
      }
      
      // Check for development environment variables
      if (config.debug.showDevTools) {
        configUtils.log('warn', 'Development tools enabled in production');
      }
    }
  },
  
  /**
   * Validate environment configuration
   */
  validateEnvironmentConfig(): string[] {
    const issues: string[] = [];
    
    if (!envValidation.isValidSupabaseURL(config.supabase.url)) {
      issues.push('Invalid Supabase URL format');
    }
    
    if (!envValidation.isValidSupabaseKey(config.supabase.anonKey)) {
      issues.push('Invalid Supabase anonymous key format');
    }
    
    if (config.monitoring.sentry?.dsn && !envValidation.isValidSentryDSN(config.monitoring.sentry.dsn)) {
      issues.push('Invalid Sentry DSN format');
    }
    
    if (configUtils.isProduction()) {
      if (config.debug.enabled) {
        issues.push('Debug mode should be disabled in production');
      }
      
      if (!config.security.enableCSP) {
        issues.push('CSP should be enabled in production');
      }
      
      if (!config.security.enableSecurityHeaders) {
        issues.push('Security headers should be enabled in production');
      }
    }
    
    return issues;
  },
};

/**
 * Initialize security checks
 */
export function initializeSecurity(): void {
  configUtils.log('info', 'Initializing security configuration...');
  
  // Run security checks
  securityChecks.checkDevelopmentExposure();
  
  const configIssues = securityChecks.validateEnvironmentConfig();
  if (configIssues.length > 0) {
    configUtils.log('warn', 'Security configuration issues detected:', configIssues);
  }
  
  // Log security status
  if (configUtils.isDevelopment()) {
    logger.info('Security Configuration', {
      component: 'security',
      action: 'logConfiguration', 
      data: {
        cspEnabled: config.security.enableCSP,
        securityHeaders: config.security.enableSecurityHeaders,
        rateLimiting: config.security.rateLimiting.enabled,
        secureContext: securityChecks.isSecureContext()
      }
    });
    
    if (configIssues.length > 0) {
      logger.warn('Security configuration issues detected', {
        component: 'security',
        action: 'logConfiguration',
        data: { issues: configIssues }
      });
    }
  }
  
  configUtils.log('info', 'Security configuration initialized');
}

export default {
  CSP_DIRECTIVES,
  SECURITY_HEADERS,
  RATE_LIMIT_CONFIG,
  generateCSPHeader,
  inputValidation,
  envValidation,
  securityChecks,
  getSecurityMiddleware,
  initializeSecurity,
};