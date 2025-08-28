/**
 * Chronicle Dashboard Configuration Management
 * Handles environment-specific configuration with proper validation and defaults
 */

import { MONITORING_INTERVALS } from './constants';

/**
 * Environment types supported by the application
 */
export type Environment = 'development' | 'staging' | 'production';

/**
 * Backend mode types supported by Chronicle
 */
export type BackendMode = 'local' | 'supabase';

/**
 * Log levels for the application
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/**
 * Theme options for the application
 */
export type Theme = 'light' | 'dark';

/**
 * Configuration interface with all possible environment variables
 */
export interface AppConfig {
  // Environment identification
  environment: Environment;
  nodeEnv: string;
  appTitle: string;
  
  // Backend mode and configuration
  backend: {
    mode: BackendMode;
    local?: {
      serverUrl: string;
    };
    supabase?: {
      url: string;
      anonKey: string;
      serviceRoleKey?: string;
    };
  };
  
  // Monitoring and error tracking
  monitoring: {
    sentry?: {
      dsn?: string;
      environment: string;
      debug: boolean;
      sampleRate: number;
      tracesSampleRate: number;
    };
    analytics?: {
      id?: string;
      trackingEnabled: boolean;
    };
  };
  
  // Feature flags
  features: {
    enableRealtime: boolean;
    enableAnalytics: boolean;
    enableExport: boolean;
    enableExperimental: boolean;
  };
  
  // Performance settings
  performance: {
    maxEventsDisplay: number;
    pollingInterval: number;
    batchSize: number;
    realtimeHeartbeat: number;
    realtimeTimeout: number;
  };
  
  // Development and debugging
  debug: {
    enabled: boolean;
    logLevel: LogLevel;
    enableProfiler: boolean;
    showDevTools: boolean;
    showEnvironmentBadge: boolean;
  };
  
  // UI customization
  ui: {
    defaultTheme: Theme;
  };
  
  // Security settings
  security: {
    enableCSP: boolean;
    enableSecurityHeaders: boolean;
    rateLimiting: {
      enabled: boolean;
      maxRequests: number;
      windowMs: number;
    };
  };
}

/**
 * Validates required environment variables based on backend mode
 */
function validateEnvironment(): void {
  // Skip validation on client-side - Next.js populates env vars after initial load
  if (typeof window !== 'undefined') {
    return;
  }
  
  const mode = process.env.NEXT_PUBLIC_CHRONICLE_MODE || 'local';
  let required: string[] = [];
  
  if (mode === 'supabase') {
    required = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY'
    ];
  } else if (mode === 'local') {
    // Local mode is more flexible - server URL has a default
    required = [];
  } else {
    console.warn(`Unknown backend mode "${mode}", defaulting to local mode`);
  }
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    const errorMessage = `Missing required environment variables for ${mode} mode: ${missing.join(', ')}\n` +
      `Please check your .env.local file and configure it for ${mode} backend.`;
    
    // In development, warn but don't throw
    if (process.env.NODE_ENV === 'development') {
      console.warn(errorMessage);
    } else {
      throw new Error(errorMessage);
    }
  }
}

/**
 * Safely gets an environment variable with a default value
 */
function getEnvVar(key: string, defaultValue: string): string;
function getEnvVar(key: string, defaultValue: number): number;
function getEnvVar(key: string, defaultValue: boolean): boolean;
function getEnvVar(key: string, defaultValue: string | number | boolean): string | number | boolean {
  const value = process.env[key];
  
  if (value === undefined) {
    return defaultValue;
  }
  
  if (typeof defaultValue === 'boolean') {
    return value.toLowerCase() === 'true';
  }
  
  if (typeof defaultValue === 'number') {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  
  return value;
}

/**
 * Gets the current environment with validation
 */
function getCurrentEnvironment(): Environment {
  const env = getEnvVar('NEXT_PUBLIC_ENVIRONMENT', 'development') as string;
  
  if (!['development', 'staging', 'production'].includes(env)) {
    console.warn(`Invalid environment "${env}", defaulting to development`);
    return 'development';
  }
  
  return env as Environment;
}

/**
 * Gets the backend mode with validation
 */
function getBackendMode(): BackendMode {
  const mode = getEnvVar('NEXT_PUBLIC_CHRONICLE_MODE', 'local') as string;
  
  if (!['local', 'supabase'].includes(mode)) {
    console.warn(`Invalid backend mode "${mode}", defaulting to local`);
    return 'local';
  }
  
  return mode as BackendMode;
}

/**
 * Creates the application configuration based on environment variables
 */
function createConfig(): AppConfig {
  // Validate required environment variables first
  validateEnvironment();
  
  const environment = getCurrentEnvironment();
  const backendMode = getBackendMode();
  const isProduction = environment === 'production';
  const isDevelopment = environment === 'development';
  
  // Build backend configuration based on mode
  const backendConfig: AppConfig['backend'] = {
    mode: backendMode,
  };
  
  if (backendMode === 'local') {
    backendConfig.local = {
      serverUrl: getEnvVar('NEXT_PUBLIC_LOCAL_SERVER_URL', 'http://localhost:8510'),
    };
  } else {
    backendConfig.supabase = {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    };
  }
  
  return {
    // Environment identification
    environment,
    nodeEnv: getEnvVar('NODE_ENV', 'development'),
    appTitle: getEnvVar('NEXT_PUBLIC_APP_TITLE', 'Chronicle Observability'),
    
    // Backend configuration
    backend: backendConfig,
    
    // Monitoring and error tracking
    monitoring: {
      sentry: process.env.SENTRY_DSN ? {
        dsn: process.env.SENTRY_DSN,
        environment,
        debug: getEnvVar('SENTRY_DEBUG', false),
        sampleRate: parseFloat(getEnvVar('SENTRY_SAMPLE_RATE', '1.0') as string),
        tracesSampleRate: parseFloat(getEnvVar('SENTRY_TRACES_SAMPLE_RATE', '0.1') as string),
      } : undefined,
      analytics: process.env.NEXT_PUBLIC_ANALYTICS_ID ? {
        id: process.env.NEXT_PUBLIC_ANALYTICS_ID,
        trackingEnabled: getEnvVar('NEXT_PUBLIC_ENABLE_ANALYTICS_TRACKING', false),
      } : undefined,
    },
    
    // Feature flags
    features: {
      enableRealtime: getEnvVar('NEXT_PUBLIC_ENABLE_REALTIME', true),
      enableAnalytics: getEnvVar('NEXT_PUBLIC_ENABLE_ANALYTICS', true),
      enableExport: getEnvVar('NEXT_PUBLIC_ENABLE_EXPORT', true),
      enableExperimental: getEnvVar('NEXT_PUBLIC_ENABLE_EXPERIMENTAL_FEATURES', !isProduction),
    },
    
    // Performance settings
    performance: {
      maxEventsDisplay: getEnvVar('NEXT_PUBLIC_MAX_EVENTS_DISPLAY', 1000),
      pollingInterval: getEnvVar('NEXT_PUBLIC_POLLING_INTERVAL', 5000),
      batchSize: getEnvVar('NEXT_PUBLIC_BATCH_SIZE', 50),
      realtimeHeartbeat: getEnvVar('NEXT_PUBLIC_REALTIME_HEARTBEAT_INTERVAL', MONITORING_INTERVALS.REALTIME_HEARTBEAT_INTERVAL),
      realtimeTimeout: getEnvVar('NEXT_PUBLIC_REALTIME_TIMEOUT', 10000),
    },
    
    // Development and debugging
    debug: {
      enabled: getEnvVar('NEXT_PUBLIC_DEBUG', isDevelopment),
      logLevel: getEnvVar('NEXT_PUBLIC_LOG_LEVEL', isDevelopment ? 'debug' : 'error') as LogLevel,
      enableProfiler: getEnvVar('NEXT_PUBLIC_ENABLE_PROFILER', isDevelopment),
      showDevTools: getEnvVar('NEXT_PUBLIC_SHOW_DEV_TOOLS', isDevelopment),
      showEnvironmentBadge: getEnvVar('NEXT_PUBLIC_SHOW_ENVIRONMENT_BADGE', !isProduction),
    },
    
    // UI customization
    ui: {
      defaultTheme: getEnvVar('NEXT_PUBLIC_DEFAULT_THEME', 'dark') as Theme,
    },
    
    // Security settings
    security: {
      enableCSP: getEnvVar('NEXT_PUBLIC_ENABLE_CSP', isProduction),
      enableSecurityHeaders: getEnvVar('NEXT_PUBLIC_ENABLE_SECURITY_HEADERS', isProduction),
      rateLimiting: {
        enabled: getEnvVar('NEXT_PUBLIC_ENABLE_RATE_LIMITING', isProduction),
        maxRequests: getEnvVar('NEXT_PUBLIC_RATE_LIMIT_REQUESTS', 1000),
        windowMs: getEnvVar('NEXT_PUBLIC_RATE_LIMIT_WINDOW', 900) * 1000, // Convert to ms
      },
    },
  };
}

// Create and export the configuration
export const config = createConfig();

/**
 * Development-only configuration validation
 */
if (config.environment === 'development' && typeof window !== 'undefined') {
  console.group('🔧 Chronicle Configuration');
  console.log('Environment:', config.environment);
  console.log('Backend Mode:', config.backend.mode);
  console.log('Debug enabled:', config.debug.enabled);
  console.log('Features:', config.features);
  if (config.backend.mode === 'local') {
    console.log('Local Server URL:', config.backend.local?.serverUrl);
  } else {
    console.log('Supabase URL:', config.backend.supabase?.url);
  }
  console.groupEnd();
}

/**
 * Utility functions for common configuration checks
 */
export const configUtils = {
  /**
   * Check if we're in development mode
   */
  isDevelopment: (): boolean => config.environment === 'development',
  
  /**
   * Check if we're in production mode
   */
  isProduction: (): boolean => config.environment === 'production',
  
  /**
   * Check if we're in staging mode
   */
  isStaging: (): boolean => config.environment === 'staging',
  
  /**
   * Check if debugging is enabled
   */
  isDebugEnabled: (): boolean => config.debug.enabled,
  
  /**
   * Check if a feature is enabled
   */
  isFeatureEnabled: (feature: keyof AppConfig['features']): boolean => {
    return config.features[feature];
  },
  
  /**
   * Check if backend is in local mode
   */
  isLocalMode: (): boolean => config.backend.mode === 'local',
  
  /**
   * Check if backend is in Supabase mode
   */
  isSupabaseMode: (): boolean => config.backend.mode === 'supabase',
  
  /**
   * Get backend configuration
   */
  getBackendConfig: () => config.backend,
  
  /**
   * Get Supabase configuration (legacy helper)
   */
  getSupabaseConfig: () => config.backend.supabase,
  
  /**
   * Get local backend configuration
   */
  getLocalConfig: () => config.backend.local,
  
  /**
   * Get monitoring configuration
   */
  getMonitoringConfig: () => config.monitoring,
  
  /**
   * Log a message based on the current log level
   */
  log: (level: LogLevel, message: string, ...args: unknown[]): void => {
    const levels: LogLevel[] = ['error', 'warn', 'info', 'debug'];
    const currentLevelIndex = levels.indexOf(config.debug.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    
    if (messageLevelIndex <= currentLevelIndex) {
      const logFn = level === 'error' ? console.error : 
                   level === 'warn' ? console.warn : 
                   level === 'info' ? console.info : console.debug;
      
      logFn(`[Chronicle:${level.toUpperCase()}]`, message, ...args);
    }
  },
};

/**
 * Backend configuration interface for factory pattern
 */
export interface BackendConfig {
  mode: BackendMode;
  serverUrl?: string;
  url?: string;
  anonKey?: string;
  serviceRoleKey?: string;
}

/**
 * Gets backend configuration in a unified format for factory pattern
 */
export function getBackendConfig(): BackendConfig {
  const backendConfig = config.backend;
  
  if (backendConfig.mode === 'local') {
    return {
      mode: 'local',
      serverUrl: backendConfig.local?.serverUrl || 'http://localhost:8510',
    };
  } else {
    return {
      mode: 'supabase',
      url: backendConfig.supabase?.url || '',
      anonKey: backendConfig.supabase?.anonKey || '',
      serviceRoleKey: backendConfig.supabase?.serviceRoleKey,
    };
  }
}

/**
 * Backend factory function placeholder
 * This will be implemented by Agent-6's backend abstraction
 */
export function createBackend(): unknown {
  const backendConfig = getBackendConfig();
  
  if (backendConfig.mode === 'local') {
    // TODO: Implement LocalBackend when Agent-6 creates it
    console.info('🏠 Chronicle: Using local backend at', backendConfig.serverUrl);
    return null; // Placeholder
  } else {
    // TODO: Implement SupabaseBackend when Agent-6 creates it
    console.info('☁️ Chronicle: Using Supabase backend at', backendConfig.url);
    return null; // Placeholder
  }
}

export default config;