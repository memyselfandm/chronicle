# Chronicle Configuration Guide

> **Comprehensive configuration guide for Chronicle observability system across all environments**

## Overview

Chronicle uses environment variables for configuration management across both the dashboard and hooks components. This guide provides comprehensive configuration examples for different deployment scenarios.

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

## Quick Configuration

### Minimal Setup (Development)

**Dashboard** (.env.local):
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**Hooks** (.env):
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
CLAUDE_HOOKS_DB_PATH=~/.chronicle/fallback.db
```

## Environment-Specific Configurations

### Development Environment

**Dashboard Configuration** (apps/dashboard/.env.local):
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

**Hooks Configuration** (apps/hooks/.env):
```env
# Database Configuration
SUPABASE_URL=https://dev-project.supabase.co
SUPABASE_ANON_KEY=your-dev-anon-key
CLAUDE_HOOKS_DB_PATH=~/.chronicle/dev_fallback.db

# Development Settings
CLAUDE_HOOKS_LOG_LEVEL=DEBUG
CLAUDE_HOOKS_DEBUG=true
CLAUDE_HOOKS_DEV_MODE=true
CLAUDE_HOOKS_VERBOSE=true

# Relaxed Security for Development
CLAUDE_HOOKS_SANITIZE_DATA=false
CLAUDE_HOOKS_MAX_INPUT_SIZE_MB=50

# Performance Settings
CLAUDE_HOOKS_EXECUTION_TIMEOUT_MS=200
```

### Testing Environment

**Dashboard Configuration**:
```env
# Chronicle Dashboard - Testing Environment  
NODE_ENV=production
NEXT_PUBLIC_ENVIRONMENT=testing
NEXT_PUBLIC_APP_TITLE=Chronicle Observability (Testing)

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://test-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-test-anon-key

# Testing Settings
NEXT_PUBLIC_DEBUG=false
NEXT_PUBLIC_LOG_LEVEL=info
NEXT_PUBLIC_ENABLE_PROFILER=false
```

**Hooks Configuration**:
```env
# Database Configuration
SUPABASE_URL=https://test-project.supabase.co
SUPABASE_ANON_KEY=your-test-anon-key
CLAUDE_HOOKS_DB_PATH=/tmp/chronicle_test.db

# Testing Settings
CLAUDE_HOOKS_LOG_LEVEL=ERROR
CLAUDE_HOOKS_MOCK_DB=true
CLAUDE_HOOKS_TEST_DB_PATH=./test_hooks.db

# Fast Testing Configuration
CLAUDE_HOOKS_EXECUTION_TIMEOUT_MS=50
CLAUDE_HOOKS_MAX_BATCH_SIZE=10
```

### Staging Environment

**Dashboard Configuration**:
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

### Production Environment

**Dashboard Configuration**:
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

# Performance Optimization
NEXT_PUBLIC_MAX_EVENTS_DISPLAY=500
NEXT_PUBLIC_POLLING_INTERVAL=10000
```

**Hooks Configuration**:
```env
# Database Configuration
SUPABASE_URL=https://prod-project.supabase.co
SUPABASE_ANON_KEY=your-prod-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-prod-service-key
CLAUDE_HOOKS_DB_PATH=/var/lib/chronicle/fallback.db

# Production Security
CLAUDE_HOOKS_LOG_LEVEL=WARNING
CLAUDE_HOOKS_SANITIZE_DATA=true
CLAUDE_HOOKS_PII_FILTERING=true
CLAUDE_HOOKS_REMOVE_API_KEYS=true

# Performance Optimization
CLAUDE_HOOKS_EXECUTION_TIMEOUT_MS=50
CLAUDE_HOOKS_ASYNC_OPERATIONS=true
CLAUDE_HOOKS_MAX_BATCH_SIZE=200

# Monitoring
CLAUDE_HOOKS_PERFORMANCE_MONITORING=true
CLAUDE_HOOKS_ERROR_THRESHOLD=5
CLAUDE_HOOKS_MEMORY_THRESHOLD=75
```

## Configuration Management

Chronicle uses a sophisticated configuration management system that ensures proper separation of concerns, security, and ease of deployment across different environments.

## Dashboard Configuration System

### Type-Safe Configuration

The configuration system provides type-safe configuration management:

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

### Environment Detection

Chronicle automatically detects the current environment and applies appropriate configuration defaults:

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

## Performance Tuning

Chronicle configuration includes comprehensive performance optimization settings for both dashboard and hooks components:

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

## Complete Environment Variables Reference

### Core Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_PROJECT_DIR` | Current directory | Root directory of your project |
| `CLAUDE_SESSION_ID` | Auto-generated | Claude Code session identifier |
| `CLAUDE_HOOKS_ENABLED` | true | Enable/disable the entire hooks system |

### Database Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SUPABASE_URL` | None | Supabase project URL (primary database) |
| `SUPABASE_ANON_KEY` | None | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | None | Supabase service role key (admin operations) |
| `CLAUDE_HOOKS_DB_PATH` | ~/.claude/hooks_data.db | SQLite fallback database path |
| `CLAUDE_HOOKS_DB_TIMEOUT` | 30 | Database connection timeout (seconds) |
| `CLAUDE_HOOKS_DB_RETRY_ATTEMPTS` | 3 | Number of retry attempts for failed connections |
| `CLAUDE_HOOKS_DB_RETRY_DELAY` | 1.0 | Delay between retry attempts (seconds) |
| `CLAUDE_HOOKS_SQLITE_FALLBACK` | true | Enable SQLite fallback when Supabase unavailable |

### Dashboard Environment Variables

#### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | `https://abc123.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJ...` |

#### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_ENVIRONMENT` | `development` | Environment name |
| `NEXT_PUBLIC_APP_TITLE` | `Chronicle Observability` | Application title |
| `NEXT_PUBLIC_DEBUG` | `true` (dev), `false` (prod) | Enable debug logging |
| `NEXT_PUBLIC_ENABLE_REALTIME` | `true` | Enable real-time updates |
| `NEXT_PUBLIC_MAX_EVENTS_DISPLAY` | `1000` | Maximum events to display |
| `NEXT_PUBLIC_POLLING_INTERVAL` | `5000` | Polling interval in ms |

#### Advanced Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SUPABASE_SERVICE_ROLE_KEY` | - | Service role key for admin operations |
| `SENTRY_DSN` | - | Sentry DSN for error tracking |
| `NEXT_PUBLIC_ANALYTICS_ID` | - | Analytics tracking ID |
| `NEXT_PUBLIC_ENABLE_CSP` | `false` (dev), `true` (prod) | Content Security Policy |

### Logging Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_HOOKS_LOG_LEVEL` | INFO | Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL) |
| `CLAUDE_HOOKS_SILENT_MODE` | false | Suppress all non-error output |
| `CLAUDE_HOOKS_LOG_TO_FILE` | true | Enable/disable file logging |
| `CLAUDE_HOOKS_LOG_FILE` | ~/.claude/hooks.log | Log file path |
| `CLAUDE_HOOKS_MAX_LOG_SIZE_MB` | 10 | Maximum log file size before rotation |
| `CLAUDE_HOOKS_LOG_ROTATION_COUNT` | 3 | Number of rotated log files to keep |
| `CLAUDE_HOOKS_LOG_ERRORS_ONLY` | false | Log only errors (ignore info/debug) |
| `CLAUDE_HOOKS_VERBOSE` | false | Enable verbose output for debugging |

### Performance Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_HOOKS_EXECUTION_TIMEOUT_MS` | 100 | Hook execution timeout (milliseconds) |
| `CLAUDE_HOOKS_MAX_MEMORY_MB` | 50 | Maximum memory usage per hook |
| `CLAUDE_HOOKS_MAX_BATCH_SIZE` | 100 | Maximum batch size for database operations |
| `CLAUDE_HOOKS_ASYNC_OPERATIONS` | true | Enable asynchronous operations |

### Security Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_HOOKS_SANITIZE_DATA` | true | Enable data sanitization |
| `CLAUDE_HOOKS_REMOVE_API_KEYS` | true | Remove API keys from logged data |
| `CLAUDE_HOOKS_REMOVE_FILE_PATHS` | false | Remove file paths from logged data |
| `CLAUDE_HOOKS_PII_FILTERING` | true | Enable PII detection and filtering |
| `CLAUDE_HOOKS_MAX_INPUT_SIZE_MB` | 10 | Maximum input size for processing |
| `CLAUDE_HOOKS_ALLOWED_EXTENSIONS` | .py,.js,.ts,.json,.md,.txt,.yml,.yaml | Allowed file extensions (comma-separated) |

### Session Management

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_HOOKS_SESSION_TIMEOUT_HOURS` | 24 | Session timeout duration |
| `CLAUDE_HOOKS_AUTO_CLEANUP` | true | Enable automatic cleanup of old sessions |
| `CLAUDE_HOOKS_MAX_EVENTS_PER_SESSION` | 10000 | Maximum events per session |
| `CLAUDE_HOOKS_DATA_RETENTION_DAYS` | 90 | Data retention period in days |

### Development and Testing

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_HOOKS_DEV_MODE` | false | Enable development mode features |
| `CLAUDE_HOOKS_DEBUG` | false | Enable debug mode |
| `CLAUDE_HOOKS_TEST_DB_PATH` | ./test_hooks.db | Test database path |
| `CLAUDE_HOOKS_MOCK_DB` | false | Use mock database for testing |

### Monitoring and Alerting

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_HOOKS_PERFORMANCE_MONITORING` | true | Enable performance monitoring |
| `CLAUDE_HOOKS_ERROR_THRESHOLD` | 10 | Error alert threshold (errors per hour) |
| `CLAUDE_HOOKS_MEMORY_THRESHOLD` | 80 | Memory usage alert threshold (percentage) |
| `CLAUDE_HOOKS_DISK_THRESHOLD` | 90 | Disk usage alert threshold (percentage) |
| `CLAUDE_HOOKS_WEBHOOK_URL` | None | Webhook URL for notifications |
| `CLAUDE_HOOKS_SLACK_WEBHOOK` | None | Slack webhook URL for alerts |

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

### Docker Deployment

**docker-compose.yml**:
```yaml
version: '3.8'
services:
  chronicle-dashboard:
    build: ./apps/dashboard
    environment:
      - NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
    ports:
      - "3000:3000"
    
  chronicle-hooks:
    build: ./apps/hooks
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
    volumes:
      - ~/.claude:/root/.claude
      - ./data:/data
```

**Environment file** (.env):
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

### Kubernetes Deployment

**ConfigMap**:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: chronicle-config
data:
  CLAUDE_HOOKS_LOG_LEVEL: "INFO"
  CLAUDE_HOOKS_PERFORMANCE_MONITORING: "true"
  CLAUDE_HOOKS_AUTO_CLEANUP: "true"
```

**Secret**:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: chronicle-secrets
type: Opaque
stringData:
  SUPABASE_URL: "https://your-project.supabase.co"
  SUPABASE_ANON_KEY: "your-anon-key"
  SUPABASE_SERVICE_ROLE_KEY: "your-service-key"
```

## Configuration Validation

### Runtime Validation

```typescript
const configIssues = securityChecks.validateEnvironmentConfig();
if (configIssues.length > 0) {
  configUtils.log('warn', 'Configuration issues detected:', configIssues);
}
```

### Validation Scripts

**Test Dashboard Configuration**:
```bash
cd apps/dashboard
npm run build  # Validates Next.js configuration
```

**Test Hooks Configuration**:
```bash
cd apps/hooks
python -c "from src.database import DatabaseManager; print(DatabaseManager().test_connection())"
```

**Validate All Settings**:
```bash
python apps/hooks/install.py --validate-only
```

### Common Validation Errors

1. **Invalid Supabase URL**: Must match `https://xxx.supabase.co` format
2. **Missing API Key**: Required for database connection
3. **Permission Issues**: Check file permissions for SQLite fallback
4. **Network Issues**: Test Supabase connectivity

## Troubleshooting Configuration

### Environment Variables Not Loading

**Check file locations**:
```bash
# Dashboard environment
ls -la apps/dashboard/.env.local

# Hooks environment  
ls -la apps/hooks/.env

# Check syntax
cat apps/hooks/.env | grep -v '^#' | grep '='
```

### Database Connection Issues

**Test Supabase connection**:
```bash
curl -H "apikey: $SUPABASE_ANON_KEY" "$SUPABASE_URL/rest/v1/"
```

**Check SQLite fallback**:
```bash
ls -la ~/.chronicle/
sqlite3 ~/.chronicle/fallback.db ".tables"
```

### Permission Problems

**Fix file permissions**:
```bash
chmod 600 apps/dashboard/.env.local
chmod 600 apps/hooks/.env
chmod -R 755 ~/.claude/
```

## Configuration Templates

### Minimal Configuration (apps/hooks/.env.minimal)
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
CLAUDE_HOOKS_DB_PATH=~/.chronicle/fallback.db
```

### Development Configuration (apps/hooks/.env.development)
```env
SUPABASE_URL=https://dev-project.supabase.co
SUPABASE_ANON_KEY=your-dev-key
CLAUDE_HOOKS_DB_PATH=~/.chronicle/dev_fallback.db
CLAUDE_HOOKS_LOG_LEVEL=DEBUG
CLAUDE_HOOKS_DEBUG=true
CLAUDE_HOOKS_SANITIZE_DATA=false
```

### Production Configuration (apps/hooks/.env.production)
```env
SUPABASE_URL=https://prod-project.supabase.co
SUPABASE_ANON_KEY=your-prod-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
CLAUDE_HOOKS_DB_PATH=/var/lib/chronicle/fallback.db
CLAUDE_HOOKS_LOG_LEVEL=WARNING
CLAUDE_HOOKS_SANITIZE_DATA=true
CLAUDE_HOOKS_PII_FILTERING=true
CLAUDE_HOOKS_PERFORMANCE_MONITORING=true
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

## Next Steps

1. **Choose Configuration**: Select appropriate template for your environment
2. **Configure Supabase**: Set up database and get API keys
3. **Test Configuration**: Validate settings before deployment
4. **Deploy**: Use configuration with deployment method
5. **Monitor**: Set up alerts and monitoring

---

**For environment-specific deployment guides, see the [Installation Guide](../setup/installation.md)**