# Chronicle Dashboard Production Deployment Guide

> **Complete guide for deploying Chronicle Dashboard to production with proper security, monitoring, and configuration management**

## Overview

This guide covers the complete production deployment process for Chronicle Dashboard, including environment configuration, security setup, monitoring integration, and deployment best practices.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [Security Setup](#security-setup)
4. [Monitoring & Error Tracking](#monitoring--error-tracking)
5. [Performance Optimization](#performance-optimization)
6. [Deployment Platforms](#deployment-platforms)
7. [Post-Deployment Verification](#post-deployment-verification)
8. [Maintenance & Updates](#maintenance--updates)

## Prerequisites

### Required Services

- **Supabase Project**: Production database with proper schema
- **Domain & SSL**: Custom domain with SSL certificate
- **Monitoring Service**: Sentry account (recommended)
- **Analytics Service**: Optional analytics provider

### Required Knowledge

- Next.js deployment concepts
- Environment variable management
- SSL/TLS configuration
- Database administration

## Environment Configuration

### 1. Environment Files Setup

Chronicle uses environment-specific configuration files:

```bash
# Development
.env.development

# Staging  
.env.staging

# Production
.env.production

# Local override (not committed)
.env.local
```

### 2. Production Environment Variables

Create `.env.production` with these required variables:

```env
# Environment identification
NODE_ENV=production
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_APP_TITLE=Chronicle Observability

# Supabase configuration (REQUIRED)
NEXT_PUBLIC_SUPABASE_URL=https://your-prod-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-production-service-role-key

# Security settings
NEXT_PUBLIC_ENABLE_CSP=true
NEXT_PUBLIC_ENABLE_SECURITY_HEADERS=true
NEXT_PUBLIC_ENABLE_RATE_LIMITING=true

# Performance optimization
NEXT_PUBLIC_MAX_EVENTS_DISPLAY=1000
NEXT_PUBLIC_POLLING_INTERVAL=10000
NEXT_PUBLIC_BATCH_SIZE=50

# Monitoring & error tracking
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_ENVIRONMENT=production
SENTRY_SAMPLE_RATE=0.1
SENTRY_TRACES_SAMPLE_RATE=0.01

# UI settings
NEXT_PUBLIC_DEBUG=false
NEXT_PUBLIC_SHOW_ENVIRONMENT_BADGE=false
```

### 3. Secret Management

**NEVER commit production secrets!** Use your platform's secret management:

#### Vercel
```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add SENTRY_DSN
```

#### Netlify
```bash
netlify env:set NEXT_PUBLIC_SUPABASE_URL "your-value"
netlify env:set NEXT_PUBLIC_SUPABASE_ANON_KEY "your-value"
```

#### AWS/Azure/GCP
Use respective secret management services (AWS Secrets Manager, Azure Key Vault, Google Secret Manager).

## Security Setup

### 1. Content Security Policy (CSP)

Chronicle automatically configures CSP for production. The configuration includes:

```typescript
// Automatically configured in src/lib/security.ts
const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "https://*.supabase.co"],
  'connect-src': ["'self'", "https://*.supabase.co", "wss://*.supabase.co"],
  // ... more directives
};
```

### 2. Security Headers

Production deployments automatically include:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (HTTPS only)
- `Referrer-Policy: strict-origin-when-cross-origin`

### 3. Rate Limiting

Configure rate limiting for production:

```env
NEXT_PUBLIC_ENABLE_RATE_LIMITING=true
NEXT_PUBLIC_RATE_LIMIT_REQUESTS=1000
NEXT_PUBLIC_RATE_LIMIT_WINDOW=900
```

### 4. Input Validation

Chronicle includes automatic input validation and sanitization. All user inputs are validated using the security utilities in `src/lib/security.ts`.

## Monitoring & Error Tracking

### 1. Sentry Setup

1. **Create Sentry Project**:
   ```bash
   # Install Sentry CLI
   npm install -g @sentry/cli
   
   # Login to Sentry
   sentry-cli login
   
   # Create new project
   sentry-cli projects create YOUR_ORG chronicle-dashboard
   ```

2. **Configure Sentry**:
   ```env
   SENTRY_DSN=https://your-dsn@sentry.io/project-id
   SENTRY_ENVIRONMENT=production
   SENTRY_DEBUG=false
   SENTRY_SAMPLE_RATE=0.1
   SENTRY_TRACES_SAMPLE_RATE=0.01
   ```

3. **Sentry Integration**:
   ```bash
   # Install Sentry
   npm install @sentry/nextjs
   ```

### 2. Performance Monitoring

Chronicle includes built-in performance monitoring:

```typescript
// Automatically tracks:
// - Page load times
// - Real-time connection quality
// - API response times
// - Memory usage
// - Core Web Vitals
```

### 3. Analytics Setup (Optional)

Configure analytics tracking:

```env
NEXT_PUBLIC_ANALYTICS_ID=your-analytics-id
NEXT_PUBLIC_ENABLE_ANALYTICS_TRACKING=true
```

## Performance Optimization

### 1. Build Configuration

Chronicle is optimized for production builds:

```typescript
// Automatic optimizations in next.config.ts:
// - Bundle splitting
// - Compression
// - Image optimization
// - Console log removal
// - CSS optimization
```

### 2. Database Optimization

Ensure your Supabase instance is properly configured:

```sql
-- Create indexes for performance
CREATE INDEX idx_events_timestamp ON events(timestamp DESC);
CREATE INDEX idx_events_session_id ON events(session_id);
CREATE INDEX idx_sessions_start_time ON sessions(start_time DESC);
```

### 3. Real-time Configuration

Production real-time settings:

```env
NEXT_PUBLIC_REALTIME_HEARTBEAT_INTERVAL=30000
NEXT_PUBLIC_REALTIME_TIMEOUT=10000
```

## Deployment Platforms

### Vercel (Recommended)

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Deploy**:
   ```bash
   # From the dashboard directory
   cd apps/dashboard
   vercel --prod
   ```

3. **Configure Environment**:
   ```bash
   vercel env add NEXT_PUBLIC_ENVIRONMENT production
   vercel env add NEXT_PUBLIC_SUPABASE_URL
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
   # ... add all required variables
   ```

### Netlify

1. **Build Configuration** (`netlify.toml`):
   ```toml
   [build]
     command = "npm run build"
     publish = ".next"
   
   [build.environment]
     NODE_VERSION = "18"
   
   [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200
   ```

2. **Deploy**:
   ```bash
   netlify deploy --prod --dir=.next
   ```

### Docker (Self-hosted)

1. **Dockerfile**:
   ```dockerfile
   FROM node:18-alpine AS base
   
   # Install dependencies
   FROM base AS deps
   WORKDIR /app
   COPY package.json package-lock.json ./
   RUN npm ci --only=production
   
   # Build application
   FROM base AS builder
   WORKDIR /app
   COPY . .
   RUN npm run build
   
   # Production image
   FROM base AS runner
   WORKDIR /app
   ENV NODE_ENV production
   
   COPY --from=builder /app/.next/standalone ./
   COPY --from=builder /app/.next/static ./.next/static
   
   EXPOSE 3000
   CMD ["node", "server.js"]
   ```

2. **Build and Run**:
   ```bash
   docker build -t chronicle-dashboard .
   docker run -p 3000:3000 chronicle-dashboard
   ```

### AWS (Amplify/ECS)

1. **AWS Amplify**:
   ```yaml
   # amplify.yml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - npm ci
       build:
         commands:
           - npm run build
     artifacts:
       baseDirectory: .next
       files:
         - '**/*'
   ```

2. **ECS with Fargate**:
   ```json
   {
     "family": "chronicle-dashboard",
     "networkMode": "awsvpc",
     "requiresCompatibilities": ["FARGATE"],
     "cpu": "256",
     "memory": "512",
     "containerDefinitions": [{
       "name": "dashboard",
       "image": "your-account.dkr.ecr.region.amazonaws.com/chronicle-dashboard",
       "portMappings": [{
         "containerPort": 3000,
         "protocol": "tcp"
       }]
     }]
   }
   ```

## Post-Deployment Verification

### 1. Health Checks

Chronicle includes built-in health checks:

```bash
# Check application health
curl https://your-domain.com/api/health

# Expected response
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "environment": "production",
  "version": "1.0.0"
}
```

### 2. Security Verification

Verify security headers:

```bash
# Check security headers
curl -I https://your-domain.com

# Verify CSP
curl -H "Content-Security-Policy" https://your-domain.com
```

### 3. Performance Testing

```bash
# Lighthouse CI
npm install -g @lhci/cli
lhci autorun --upload.target=temporary-public-storage

# Load testing
npx artillery quick --count 10 --num 5 https://your-domain.com
```

### 4. Real-time Connection

Test real-time connectivity:

```javascript
// Test in browser console
const testConnection = async () => {
  const response = await fetch('/api/supabase/connection-test');
  console.log(await response.json());
};
testConnection();
```

## Maintenance & Updates

### 1. Automated Deployment

Set up CI/CD pipeline:

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Build application
        run: npm run build
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          vercel-args: '--prod'
```

### 2. Database Migrations

Handle database schema updates:

```bash
# Run migration
supabase migration up

# Verify migration
supabase db diff
```

### 3. Monitoring & Alerts

Set up monitoring alerts:

```yaml
# Sentry alerts configuration
alerts:
  - name: "High Error Rate"
    condition: "error_rate > 5%"
    notification: "email"
  
  - name: "Performance Degradation"
    condition: "avg_response_time > 2000ms"
    notification: "slack"
```

### 4. Backup Strategy

```bash
# Automated Supabase backups
# Configure in Supabase dashboard:
# 1. Go to Settings > Database
# 2. Enable Point-in-Time Recovery
# 3. Set backup retention period
```

## Security Checklist

Before going live, verify:

- [ ] All environment variables are properly secured
- [ ] HTTPS is enforced
- [ ] Security headers are configured
- [ ] CSP is properly set up
- [ ] Rate limiting is enabled
- [ ] Input validation is working
- [ ] Error tracking is configured
- [ ] Performance monitoring is active
- [ ] Database access is restricted
- [ ] Admin routes are protected

## Performance Checklist

- [ ] Bundle size is optimized
- [ ] Images are optimized
- [ ] Real-time connections are stable
- [ ] Database queries are indexed
- [ ] CDN is configured
- [ ] Caching strategies are implemented
- [ ] Core Web Vitals are acceptable

## Troubleshooting

### Common Issues

1. **Environment variables not loading**:
   ```bash
   # Verify environment
   console.log(process.env.NEXT_PUBLIC_ENVIRONMENT)
   ```

2. **Supabase connection errors**:
   ```bash
   # Test connection
   curl -X POST 'https://your-project.supabase.co/rest/v1/events' \
        -H 'apikey: your-anon-key' \
        -H 'Content-Type: application/json'
   ```

3. **Real-time issues**:
   ```javascript
   // Check WebSocket connection
   console.log(supabase.realtime.channels)
   ```

4. **Performance issues**:
   ```bash
   # Analyze bundle
   npm run build -- --analyze
   ```

### Support Resources

- **Chronicle Documentation**: Check project README files
- **Supabase Docs**: https://supabase.com/docs
- **Next.js Docs**: https://nextjs.org/docs
- **Sentry Docs**: https://docs.sentry.io

## Conclusion

Following this guide ensures a secure, performant, and maintainable production deployment of Chronicle Dashboard. Regular monitoring and maintenance will keep your observability platform running smoothly.

For questions or issues, refer to the troubleshooting section or create an issue in the project repository.