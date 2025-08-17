# Chronicle Dashboard Configuration Management

> **Comprehensive guide for managing configuration across development, staging, and production environments**

## Overview

Chronicle Dashboard uses a sophisticated configuration management system that ensures proper separation of concerns, security, and ease of deployment across different environments.

## Configuration Architecture

```
┌─────────────────────────────────────┐
│         Environment Files          │
├─────────────────────────────────────┤
│  .env.development                   │
│  .env.staging                       │  
│  .env.production                    │
│  .env.local (local overrides)      │
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│      Configuration System          │
├─────────────────────────────────────┤
│  src/lib/config.ts                  │
│  - Environment detection            │
│  - Variable validation              │
│  - Type-safe configuration         │
│  - Default values                   │
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│      Application Modules           │
├─────────────────────────────────────┤
│  - Supabase client                  │
│  - Monitoring setup                 │
│  - Security configuration          │
│  - Performance optimization        │
└─────────────────────────────────────┘
```

## Environment Configuration Files

### Development Environment (.env.development)

```env
# Chronicle Dashboard - Development Environment
NODE_ENV=development
NEXT_PUBLIC_ENVIRONMENT=development
NEXT_PUBLIC_APP_TITLE=Chronicle Observability (Dev)

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://dev-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-dev-anon-key

# Development Features
NEXT_PUBLIC_DEBUG=true
NEXT_PUBLIC_LOG_LEVEL=debug
NEXT_PUBLIC_ENABLE_PROFILER=true
NEXT_PUBLIC_SHOW_DEV_TOOLS=true

# Performance Settings
NEXT_PUBLIC_MAX_EVENTS_DISPLAY=500
NEXT_PUBLIC_POLLING_INTERVAL=3000
```

### Staging Environment (.env.staging)

```env
# Chronicle Dashboard - Staging Environment  
NODE_ENV=production
NEXT_PUBLIC_ENVIRONMENT=staging
NEXT_PUBLIC_APP_TITLE=Chronicle Observability (Staging)

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://staging-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-staging-anon-key

# Staging Features
NEXT_PUBLIC_DEBUG=true
NEXT_PUBLIC_LOG_LEVEL=info
NEXT_PUBLIC_ENABLE_PROFILER=false

# Monitoring
SENTRY_DSN=https://staging-dsn@sentry.io/project
SENTRY_ENVIRONMENT=staging
```

### Production Environment (.env.production)

```env
# Chronicle Dashboard - Production Environment
NODE_ENV=production
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_APP_TITLE=Chronicle Observability

# Supabase Configuration (managed via platform secrets)
NEXT_PUBLIC_SUPABASE_URL=https://prod-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=production-anon-key

# Production Security
NEXT_PUBLIC_DEBUG=false
NEXT_PUBLIC_LOG_LEVEL=error
NEXT_PUBLIC_ENABLE_CSP=true
NEXT_PUBLIC_ENABLE_SECURITY_HEADERS=true
NEXT_PUBLIC_ENABLE_RATE_LIMITING=true
```

## Configuration System (src/lib/config.ts)

The configuration system provides:

### Type-Safe Configuration

```typescript
export interface AppConfig {
  environment: Environment;
  nodeEnv: string;
  appTitle: string;
  
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey?: string;
  };
  
  monitoring: {
    sentry?: SentryConfig;
    analytics?: AnalyticsConfig;
  };
  
  features: FeatureFlags;
  performance: PerformanceConfig;
  debug: DebugConfig;
  security: SecurityConfig;
}
```

### Environment Variable Validation

```typescript
function validateEnvironment(): void {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
}
```

### Smart Defaults

```typescript
function getEnvVar(key: string, defaultValue: string | number | boolean) {
  const value = process.env[key];
  
  if (value === undefined) {
    return defaultValue;
  }
  
  // Type-safe conversion based on default value type
  if (typeof defaultValue === 'boolean') {
    return value.toLowerCase() === 'true';
  }
  
  if (typeof defaultValue === 'number') {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  
  return value;
}
```

## Feature Flag Management

Chronicle includes comprehensive feature flag support:

```typescript
interface FeatureFlags {
  enableRealtime: boolean;
  enableAnalytics: boolean;
  enableExport: boolean;
  enableExperimental: boolean;
}

// Environment-aware defaults
features: {
  enableRealtime: getEnvVar('NEXT_PUBLIC_ENABLE_REALTIME', true),
  enableAnalytics: getEnvVar('NEXT_PUBLIC_ENABLE_ANALYTICS', true),
  enableExport: getEnvVar('NEXT_PUBLIC_ENABLE_EXPORT', true),
  enableExperimental: getEnvVar('NEXT_PUBLIC_ENABLE_EXPERIMENTAL_FEATURES', !isProduction),
}
```

### Feature Flag Usage

```typescript
import { config, configUtils } from '@/lib/config';

// Check if feature is enabled
if (configUtils.isFeatureEnabled('enableAnalytics')) {
  // Initialize analytics
}

// Environment-specific features
if (configUtils.isDevelopment()) {
  // Development-only features
}
```

## Performance Configuration

Environment-specific performance tuning:

```typescript
interface PerformanceConfig {
  maxEventsDisplay: number;
  pollingInterval: number;
  batchSize: number;
  realtimeHeartbeat: number;
  realtimeTimeout: number;
}

// Production-optimized defaults
performance: {
  maxEventsDisplay: getEnvVar('NEXT_PUBLIC_MAX_EVENTS_DISPLAY', 1000),
  pollingInterval: getEnvVar('NEXT_PUBLIC_POLLING_INTERVAL', 5000),
  batchSize: getEnvVar('NEXT_PUBLIC_BATCH_SIZE', 50),
  realtimeHeartbeat: getEnvVar('NEXT_PUBLIC_REALTIME_HEARTBEAT_INTERVAL', 30000),
  realtimeTimeout: getEnvVar('NEXT_PUBLIC_REALTIME_TIMEOUT', 10000),
}
```

## Monitoring Configuration

Integrated monitoring setup:

```typescript
interface MonitoringConfig {
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
}
```

### Automatic Monitoring Initialization

```typescript
// Automatic Sentry setup based on configuration
if (config.monitoring.sentry?.dsn) {
  import('@sentry/nextjs').then(({ init }) => {
    init({
      dsn: config.monitoring.sentry.dsn,
      environment: config.monitoring.sentry.environment,
      debug: config.monitoring.sentry.debug,
      sampleRate: config.monitoring.sentry.sampleRate,
      tracesSampleRate: config.monitoring.sentry.tracesSampleRate,
    });
  });
}
```

## Security Configuration

Environment-aware security settings:

```typescript
interface SecurityConfig {
  enableCSP: boolean;
  enableSecurityHeaders: boolean;
  rateLimiting: {
    enabled: boolean;
    maxRequests: number;
    windowMs: number;
  };
}

// Production security enforcement
security: {
  enableCSP: getEnvVar('NEXT_PUBLIC_ENABLE_CSP', isProduction),
  enableSecurityHeaders: getEnvVar('NEXT_PUBLIC_ENABLE_SECURITY_HEADERS', isProduction),
  rateLimiting: {
    enabled: getEnvVar('NEXT_PUBLIC_ENABLE_RATE_LIMITING', isProduction),
    maxRequests: getEnvVar('NEXT_PUBLIC_RATE_LIMIT_REQUESTS', 1000),
    windowMs: getEnvVar('NEXT_PUBLIC_RATE_LIMIT_WINDOW', 900) * 1000,
  },
}
```

## Deployment-Specific Configuration

### Vercel Configuration

```bash
# Set environment-specific variables
vercel env add NEXT_PUBLIC_ENVIRONMENT production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production

# Staging environment
vercel env add NEXT_PUBLIC_ENVIRONMENT staging --scope=preview
```

### Netlify Configuration

```toml
# netlify.toml
[build]
  command = "npm run build"
  
[build.environment]
  NEXT_PUBLIC_ENVIRONMENT = "production"
  
[context.deploy-preview]
  [context.deploy-preview.environment]
    NEXT_PUBLIC_ENVIRONMENT = "staging"
```

### Docker Configuration

```dockerfile
# Multi-stage build with environment-specific configuration
FROM node:18-alpine AS base

# Build stage
FROM base AS builder
ARG ENVIRONMENT=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
COPY .env.${ENVIRONMENT} .env.production
RUN npm run build

# Runtime stage
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
```

## Configuration Utilities

### Environment Detection

```typescript
export const configUtils = {
  isDevelopment: (): boolean => config.environment === 'development',
  isProduction: (): boolean => config.environment === 'production',
  isStaging: (): boolean => config.environment === 'staging',
  
  isDebugEnabled: (): boolean => config.debug.enabled,
  
  isFeatureEnabled: (feature: keyof AppConfig['features']): boolean => {
    return config.features[feature];
  },
  
  getSupabaseConfig: () => config.supabase,
  getMonitoringConfig: () => config.monitoring,
};
```

### Logging Utilities

```typescript
export const configUtils = {
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
```

## Configuration Validation

### Runtime Validation

```typescript
const configIssues = securityChecks.validateEnvironmentConfig();
if (configIssues.length > 0) {
  configUtils.log('warn', 'Configuration issues detected:', configIssues);
}
```

### Development Logging

```typescript
if (config.environment === 'development' && typeof window !== 'undefined') {
  console.group('🔧 Chronicle Configuration');
  console.log('Environment:', config.environment);
  console.log('Debug enabled:', config.debug.enabled);
  console.log('Features:', config.features);
  console.log('Supabase URL:', config.supabase.url);
  console.groupEnd();
}
```

## Best Practices

### 1. Environment Separation

- Use separate Supabase projects for each environment
- Different monitoring configurations per environment
- Isolated feature flag settings

### 2. Configuration Security

- Never commit production configurations to version control
- Use platform-specific management for sensitive values
- Regular rotation of configuration values

### 3. Type Safety

- Use TypeScript interfaces for all configuration
- Validate configuration at startup
- Provide meaningful error messages

### 4. Performance Optimization

- Environment-specific performance tuning
- Lazy loading of non-essential configurations
- Caching of computed configuration values

### 5. Monitoring & Debugging

- Log configuration issues clearly
- Provide debugging information in development
- Monitor configuration health in production

## Troubleshooting

### Common Configuration Issues

1. **Environment variables not loading**:
   ```typescript
   // Check if variable exists
   console.log('Env var:', process.env.NEXT_PUBLIC_ENVIRONMENT);
   
   // Verify Next.js variable naming
   // Must start with NEXT_PUBLIC_ for client-side access
   ```

2. **Type conversion issues**:
   ```typescript
   // Use helper functions for type conversion
   const getEnvVar = (key: string, defaultValue: boolean): boolean => {
     const value = process.env[key];
     return value ? value.toLowerCase() === 'true' : defaultValue;
   };
   ```

3. **Configuration validation failures**:
   ```typescript
   // Check validation messages
   const issues = securityChecks.validateEnvironmentConfig();
   console.log('Configuration issues:', issues);
   ```

## Configuration Testing

### Unit Tests

```typescript
// Test configuration loading
describe('Configuration', () => {
  it('should load development configuration', () => {
    process.env.NEXT_PUBLIC_ENVIRONMENT = 'development';
    const config = createConfig();
    
    expect(config.environment).toBe('development');
    expect(config.debug.enabled).toBe(true);
  });
  
  it('should enforce security in production', () => {
    process.env.NEXT_PUBLIC_ENVIRONMENT = 'production';
    const config = createConfig();
    
    expect(config.security.enableCSP).toBe(true);
    expect(config.debug.enabled).toBe(false);
  });
});
```

### Integration Tests

```typescript
// Test environment-specific behavior
describe('Environment Configuration', () => {
  it('should connect to correct Supabase instance', async () => {
    const client = createSupabaseClient(config.supabase);
    const { data, error } = await client.from('events').select('count');
    
    expect(error).toBeNull();
  });
});
```

## Conclusion

Chronicle Dashboard's configuration management system provides:

- **Type-safe configuration** with comprehensive validation
- **Environment-specific optimization** for development, staging, and production
- **Secure handling** of sensitive configuration data
- **Feature flag support** for controlled feature rollouts
- **Performance tuning** based on environment requirements
- **Monitoring integration** with automatic service setup

This system ensures reliable, secure, and performant deployments across all environments while maintaining developer productivity and operational efficiency.