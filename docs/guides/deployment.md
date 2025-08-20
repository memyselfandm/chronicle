# Chronicle Deployment Guide

> **Complete production-ready deployment guide for Chronicle observability system with comprehensive configuration, security, and monitoring setup**

## Overview

This consolidated guide covers deploying Chronicle in various environments with proper system requirements, security considerations, verification procedures, and maintenance practices. Chronicle consists of two main components:

- **Chronicle Dashboard**: Next.js web application for visualizing events and sessions
- **Chronicle Hooks**: Python system that captures Claude Code interactions

## Table of Contents

- [System Requirements](#system-requirements)
- [Environment Setup](#environment-setup)
- [Local Development Deployment](#local-development-deployment)
- [Production Deployment](#production-deployment)
- [Dashboard Production Deployment](#dashboard-production-deployment)
- [Container Deployment](#container-deployment)
- [Cloud Platform Deployments](#cloud-platform-deployments)
- [Post-Deployment Verification](#post-deployment-verification)
- [Performance Monitoring](#performance-monitoring)
- [Maintenance and Updates](#maintenance-and-updates)
- [Troubleshooting](#troubleshooting)

## System Requirements

### Minimum Requirements

**Chronicle Dashboard**:
- **Node.js**: 18.0.0 or higher
- **Memory**: 512MB RAM
- **Storage**: 1GB available space
- **Network**: Stable internet connection for Supabase

**Chronicle Hooks System**:
- **Python**: 3.8.0 or higher  
- **Memory**: 256MB RAM
- **Storage**: 500MB available space
- **Claude Code**: Latest version installed

### Recommended Requirements

**Production Dashboard**:
- **Node.js**: 20.0.0 LTS
- **Memory**: 2GB RAM
- **CPU**: 2 cores
- **Storage**: 5GB SSD
- **Network**: Low-latency connection to Supabase region

**Production Hooks**:
- **Python**: 3.11+ 
- **Memory**: 1GB RAM
- **CPU**: 1 core
- **Storage**: 2GB SSD
- **File System**: Read/write access to user directory

### Platform Compatibility

| Platform | Dashboard | Hooks | Notes |
|----------|-----------|-------|
| **macOS** | ✅ | ✅ | Intel and Apple Silicon |
| **Linux** | ✅ | ✅ | Ubuntu 20.04+, Debian 11+, RHEL 8+ |
| **Windows** | ✅ | ⚠️ | WSL2 recommended for hooks |
| **Docker** | ✅ | ✅ | Multi-platform support |

### Prerequisites

**Required Services**:
- **Supabase Project**: Production database with proper schema
- **Domain & SSL**: Custom domain with SSL certificate (production)
- **Monitoring Service**: Sentry account (recommended)

**Development Tools**:
```bash
# Check Node.js version
node --version  # Should be 18+

# Check Python version
python3 --version  # Should be 3.8+

# Check package managers
npm --version
pip --version
```

## Environment Setup

### Environment Files Structure

```bash
# Development
.env.development
.env.local              # Local overrides (not committed)

# Staging  
.env.staging

# Production
.env.production
```

### Dashboard Environment Configuration

**Production Environment Variables**:
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

### Hooks Environment Configuration

**Production Environment Variables** (apps/hooks/.env):
```env
# Supabase configuration
SUPABASE_URL=https://prod-project.supabase.co
SUPABASE_ANON_KEY=your-prod-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-prod-service-key

# Security and data protection
CLAUDE_HOOKS_SANITIZE_DATA=true
CLAUDE_HOOKS_PII_FILTERING=true
CLAUDE_HOOKS_REMOVE_API_KEYS=true
CLAUDE_HOOKS_REMOVE_FILE_PATHS=true

# Performance settings
CLAUDE_HOOKS_DB_PATH=/var/lib/chronicle/fallback.db
CLAUDE_HOOKS_LOG_LEVEL=WARNING
CLAUDE_HOOKS_MAX_INPUT_SIZE_MB=10

# Monitoring
CLAUDE_HOOKS_AUDIT_LOGGING=true
CLAUDE_HOOKS_LOG_DB_OPERATIONS=true
```

### Secret Management

**NEVER commit production secrets!** Use platform-specific secret management:

#### Vercel
```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add SENTRY_DSN production
```

#### Netlify
```bash
netlify env:set NEXT_PUBLIC_SUPABASE_URL "your-value" --scope=production
netlify env:set SUPABASE_SERVICE_ROLE_KEY "your-value" --scope=production
```

#### AWS/Azure/GCP
Use respective secret management services (AWS Secrets Manager, Azure Key Vault, Google Secret Manager).

## Local Development Deployment

### Quick Development Setup

**Single Command Installation**:
```bash
# Clone and install
git clone <repository-url>
cd chronicle
./scripts/install.sh

# Follow prompts for Supabase configuration
```

### Manual Development Setup

1. **Clone Repository**:
   ```bash
   git clone <repository-url>
   cd chronicle
   ```

2. **Configure Supabase**:
   - Follow [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)
   - Get project URL and API keys

3. **Install Dependencies**:
   ```bash
   # Dashboard
   cd apps/dashboard && npm install
   
   # Hooks
   cd ../hooks && pip install -r requirements.txt
   ```

4. **Configure Environment**:
   ```bash
   # Dashboard environment
   cp apps/dashboard/.env.example apps/dashboard/.env.local
   
   # Hooks environment
   cp apps/hooks/.env.template apps/hooks/.env
   
   # Edit files with your Supabase credentials
   ```

5. **Setup Database Schema**:
   ```bash
   cd apps/hooks
   python -c "from src.database import DatabaseManager; DatabaseManager().setup_schema()"
   ```

6. **Install Claude Code Hooks**:
   ```bash
   cd apps/hooks
   python install.py
   ```

7. **Start Development Servers**:
   ```bash
   # Terminal 1: Dashboard
   cd apps/dashboard && npm run dev
   
   # Terminal 2: Test hooks (optional)
   cd apps/hooks && python -m pytest
   ```

### Development Verification

```bash
# Check dashboard
curl http://localhost:3000

# Test hooks installation
cd apps/hooks
python install.py --validate-only

# Test database connection
python -c "from src.database import DatabaseManager; print(DatabaseManager().test_connection())"
```

## Production Deployment

### Server Preparation

**System Setup**:
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Python 3.11
sudo apt update
sudo apt install -y python3.11 python3.11-pip python3.11-venv

# Install process manager
sudo npm install -g pm2

# Create application user
sudo useradd -m -s /bin/bash chronicle
sudo usermod -aG sudo chronicle
```

**Security Setup**:
```bash
# Configure firewall
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable

# Setup SSL (using Let's Encrypt)
sudo apt install certbot nginx
sudo certbot --nginx -d your-domain.com
```

### Application Deployment

**Clone and Build**:
```bash
# Switch to application user
sudo -u chronicle -i

# Clone repository
git clone <repository-url> /home/chronicle/chronicle
cd /home/chronicle/chronicle

# Build dashboard
cd apps/dashboard
npm ci --production
npm run build

# Install hooks
cd ../hooks
python3.11 -m pip install -r requirements.txt
python3.11 install.py --production
```

### Process Management

**PM2 Configuration** (`ecosystem.config.js`):
```javascript
module.exports = {
  apps: [{
    name: 'chronicle-dashboard',
    script: 'npm',
    args: 'start',
    cwd: '/home/chronicle/chronicle/apps/dashboard',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    instances: 2,
    exec_mode: 'cluster',
    max_memory_restart: '1G',
    error_file: '/var/log/chronicle/dashboard-error.log',
    out_file: '/var/log/chronicle/dashboard-out.log',
    log_file: '/var/log/chronicle/dashboard.log'
  }]
}
```

**Start Services**:
```bash
# Create log directory
sudo mkdir -p /var/log/chronicle
sudo chown chronicle:chronicle /var/log/chronicle

# Start dashboard with PM2
cd /home/chronicle/chronicle
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow instructions to enable auto-start
```

### Reverse Proxy Configuration

**Nginx Configuration** (`/etc/nginx/sites-available/chronicle`):
```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # Strong SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20:!aNULL:!MD5:!DSS;
    ssl_prefer_server_ciphers off;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Enable gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript 
               application/javascript application/xml+rss 
               application/json application/xml;
}
```

**Enable Site**:
```bash
sudo ln -s /etc/nginx/sites-available/chronicle /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Dashboard Production Deployment

### Platform-Specific Deployment

#### Vercel (Recommended)

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
   vercel env add SUPABASE_SERVICE_ROLE_KEY
   vercel env add SENTRY_DSN
   ```

#### Netlify

1. **Build Configuration** (`netlify.toml`):
   ```toml
   [build]
     command = "npm run build"
     publish = ".next"
   
   [build.environment]
     NODE_VERSION = "20"
   
   [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200
   ```

2. **Deploy**:
   ```bash
   netlify deploy --prod --dir=.next
   ```

#### Docker (Self-hosted)

1. **Dockerfile**:
   ```dockerfile
   FROM node:20-alpine AS base
   
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

## Container Deployment

### Docker Compose Setup

**docker-compose.yml**:
```yaml
version: '3.8'

services:
  dashboard:
    build: ./apps/dashboard
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - SENTRY_DSN=${SENTRY_DSN}
    restart: unless-stopped
    depends_on:
      - hooks

  hooks:
    build: ./apps/hooks
    volumes:
      - ~/.claude:/root/.claude:ro
      - ./data:/app/data
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - CLAUDE_HOOKS_DB_PATH=/app/data/fallback.db
      - CLAUDE_HOOKS_SANITIZE_DATA=true
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/ssl:ro
    depends_on:
      - dashboard
    restart: unless-stopped

volumes:
  data:
```

**Environment File** (.env):
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project
```

**Deploy**:
```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Update deployment
docker-compose pull
docker-compose up -d --force-recreate
```

## Cloud Platform Deployments

### AWS Deployment

#### AWS Amplify (Dashboard)
```yaml
# amplify.yml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - cd apps/dashboard
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: apps/dashboard/.next
    files:
      - '**/*'
```

#### ECS with Fargate
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
    }],
    "environment": [
      {
        "name": "NODE_ENV",
        "value": "production"
      }
    ],
    "secrets": [
      {
        "name": "SUPABASE_SERVICE_ROLE_KEY",
        "valueFrom": "arn:aws:secretsmanager:region:account:secret:chronicle/supabase/service-role-key"
      }
    ]
  }]
}
```

### Railway Deployment

**railway.json**:
```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "cd apps/dashboard && npm start",
    "healthcheckPath": "/",
    "healthcheckTimeout": 100
  }
}
```

### DigitalOcean App Platform

**app.yaml**:
```yaml
name: chronicle
services:
- name: dashboard
  source_dir: apps/dashboard
  github:
    repo: your-repo/chronicle
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: NEXT_PUBLIC_SUPABASE_URL
    value: ${SUPABASE_URL}
  - key: NEXT_PUBLIC_SUPABASE_ANON_KEY
    value: ${SUPABASE_ANON_KEY}
  - key: SUPABASE_SERVICE_ROLE_KEY
    value: ${SUPABASE_SERVICE_ROLE_KEY}
```

## Post-Deployment Verification

### Automated Verification Script

```bash
#!/bin/bash
# verify-deployment.sh

echo "🔍 Verifying Chronicle deployment..."

# Check dashboard health
DASHBOARD_URL="https://your-domain.com"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $DASHBOARD_URL)
if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Dashboard accessible"
else
    echo "❌ Dashboard not accessible (HTTP $HTTP_STATUS)"
    exit 1
fi

# Check health endpoint
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$DASHBOARD_URL/api/health")
if [ "$HEALTH_STATUS" = "200" ]; then
    echo "✅ Health endpoint responding"
else
    echo "❌ Health endpoint not responding (HTTP $HEALTH_STATUS)"
    exit 1
fi

# Check Supabase connection
python3 -c "
from apps.hooks.src.database import DatabaseManager
dm = DatabaseManager()
if dm.test_connection():
    print('✅ Database connection successful')
else:
    print('❌ Database connection failed')
    exit(1)
"

# Test hooks installation (if applicable)
if [ -d "apps/hooks" ]; then
    cd apps/hooks
    if python install.py --validate-only; then
        echo "✅ Hooks installation valid"
    else
        echo "❌ Hooks installation failed"
        exit 1
    fi
fi

# Security verification
echo "🔒 Checking security headers..."
SEC_HEADERS=$(curl -I -s "$DASHBOARD_URL" | grep -c "X-Frame-Options\|X-Content-Type-Options\|Strict-Transport-Security")
if [ "$SEC_HEADERS" -ge "2" ]; then
    echo "✅ Security headers present"
else
    echo "⚠️ Some security headers missing"
fi

echo "✅ Deployment verification complete!"
```

### Health Check Endpoints

Create `/api/health` in dashboard:
```javascript
// pages/api/health.js or app/api/health/route.js
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
    
    // Test database connection
    const { data, error } = await supabase
      .from('sessions')
      .select('count')
      .limit(1)
    
    if (error) throw error
    
    res.status(200).json({
      status: 'healthy',
      database: 'connected',
      environment: process.env.NEXT_PUBLIC_ENVIRONMENT,
      version: '1.0.0',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
}
```

### Load Testing

```bash
# Install Apache Bench
sudo apt install apache2-utils

# Basic load test
ab -n 1000 -c 10 https://your-domain.com/

# Health endpoint test
ab -n 100 -c 5 https://your-domain.com/api/health

# Advanced load testing with Artillery
npx artillery quick --count 10 --num 5 https://your-domain.com
```

## Performance Monitoring

### Application Metrics

**PM2 Monitoring**:
```bash
# View real-time metrics
pm2 monit

# View logs
pm2 logs chronicle-dashboard

# Performance metrics
pm2 show chronicle-dashboard

# Restart with zero downtime
pm2 reload chronicle-dashboard
```

**Custom Metrics** (add to dashboard):
```javascript
// lib/metrics.js
export const trackMetric = (name, value, tags = {}) => {
  if (process.env.NODE_ENV === 'production') {
    // Send to your monitoring service (Sentry, DataDog, etc.)
    console.log(`Metric: ${name}=${value}`, tags)
  }
}

// Usage
import { trackMetric } from '../lib/metrics'
trackMetric('page_load_time', performance.now())
trackMetric('api_response_time', responseTime, { endpoint: '/api/events' })
```

### Database Performance

Monitor these Supabase metrics:
- Connection count and pool utilization
- Query performance and slow queries
- Storage usage and growth rate
- Real-time connections and subscriptions
- Row Level Security policy performance

### System Resource Monitoring

```bash
# Install system monitoring tools
sudo apt install htop iotop nethogs

# Monitor resources
htop              # CPU and memory
iotop             # Disk I/O
nethogs           # Network usage
df -h             # Disk space
free -h           # Memory usage

# Setup log rotation
sudo logrotate -f /etc/logrotate.d/chronicle
```

## Maintenance and Updates

### Automated Deployment Pipeline

Set up CI/CD pipeline:

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      
      - name: Install dependencies
        run: |
          cd apps/dashboard && npm ci
          cd ../hooks && pip install -r requirements.txt
      
      - name: Run tests
        run: |
          cd apps/dashboard && npm test
          cd ../hooks && python -m pytest
      
      - name: Security audit
        run: |
          cd apps/dashboard && npm audit --audit-level high
          cd ../hooks && pip-audit
  
  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build dashboard
        run: cd apps/dashboard && npm ci && npm run build
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          vercel-args: '--prod'
```

### Regular Updates

```bash
# Update dependencies
cd apps/dashboard && npm update
cd ../hooks && pip install -r requirements.txt --upgrade

# Update system
sudo apt update && sudo apt upgrade -y

# Restart services
pm2 restart all
sudo systemctl reload nginx
```

### Database Migrations

Handle database schema updates:

```bash
# Run Supabase migration
supabase migration up

# Verify migration
supabase db diff

# Test application with new schema
npm run test
python -m pytest
```

### Backup Procedures

```bash
# Backup configuration files
tar -czf chronicle-config-$(date +%Y%m%d).tar.gz \
    apps/dashboard/.env.production \
    apps/hooks/.env \
    ecosystem.config.js \
    nginx.conf

# Backup logs
tar -czf chronicle-logs-$(date +%Y%m%d).tar.gz /var/log/chronicle/

# Supabase automatic backups
# Configure in Supabase dashboard:
# 1. Go to Settings > Database
# 2. Enable Point-in-Time Recovery
# 3. Set backup retention period
```

### Monitoring and Alerting

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
  
  - name: "Memory Usage High"
    condition: "memory_usage > 80%"
    notification: "email"
```

Monitor these key metrics:
- Application response times
- Error rates and exceptions
- Memory and CPU usage
- Database connection health
- Real-time connection stability
- SSL certificate expiration

## Troubleshooting

### Common Deployment Issues

1. **Port Conflicts**: 
   ```bash
   # Check port usage
   sudo netstat -tulpn | grep :3000
   sudo lsof -i :3000
   
   # Kill process using port
   sudo fuser -k 3000/tcp
   ```

2. **Permission Errors**: 
   ```bash
   # Fix file permissions
   chmod 600 .env*
   chmod 755 scripts/*
   chown -R chronicle:chronicle /home/chronicle/chronicle
   ```

3. **Memory Issues**: 
   ```bash
   # Check memory usage
   free -h
   ps aux --sort=-%mem | head -10
   
   # Increase swap if needed
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```

4. **Network Issues**: 
   ```bash
   # Check DNS resolution
   nslookup your-supabase-project.supabase.co
   
   # Test connectivity
   curl -I https://your-supabase-project.supabase.co
   
   # Check firewall
   sudo ufw status
   ```

5. **SSL Certificate Issues**: 
   ```bash
   # Check certificate status
   openssl x509 -in /etc/letsencrypt/live/your-domain.com/fullchain.pem -text -noout -dates
   
   # Renew certificate
   sudo certbot renew --dry-run
   sudo certbot renew
   ```

### Application-Specific Issues

1. **Environment variables not loading**:
   ```bash
   # Verify environment
   node -e "console.log(process.env.NEXT_PUBLIC_ENVIRONMENT)"
   python -c "import os; print(os.environ.get('SUPABASE_URL'))"
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
   // Check WebSocket connection in browser console
   console.log(supabase.realtime.channels)
   
   // Test real-time subscription
   const channel = supabase.channel('test')
   channel.subscribe(console.log)
   ```

4. **Performance issues**:
   ```bash
   # Analyze bundle size
   cd apps/dashboard && npm run build -- --analyze
   
   # Check database performance
   # Review slow queries in Supabase dashboard
   ```

### Rollback Procedures

```bash
# Quick rollback with PM2
pm2 reload ecosystem.config.js --update-env

# Git-based rollback
git log --oneline -10  # Find last good commit
git checkout <last-good-commit>
npm ci && npm run build
pm2 restart all

# Vercel rollback
vercel rollback --url=your-domain.com

# Docker rollback
docker tag chronicle-dashboard:latest chronicle-dashboard:backup
docker pull chronicle-dashboard:previous-stable
docker-compose up -d --force-recreate
```

### Support Resources

- **Chronicle Documentation**: Project README and docs/
- **Supabase Documentation**: https://supabase.com/docs
- **Next.js Documentation**: https://nextjs.org/docs
- **Sentry Documentation**: https://docs.sentry.io
- **Platform-specific guides**: Vercel, Netlify, AWS documentation

## Security Considerations

For comprehensive security information, see the [Security Guide](./security.md). Key deployment security requirements:

- [ ] HTTPS enforced with strong TLS configuration
- [ ] Security headers properly configured
- [ ] Environment variables secured (not in version control)
- [ ] Database Row Level Security enabled
- [ ] Input validation and sanitization enabled
- [ ] Rate limiting configured
- [ ] Error tracking configured
- [ ] Regular security updates scheduled

## Conclusion

This comprehensive deployment guide covers all aspects of deploying Chronicle in production environments. Following these procedures ensures a secure, performant, and maintainable deployment.

### Key Success Factors:

1. **Proper Planning**: Understand requirements and choose appropriate deployment strategy
2. **Security First**: Implement security measures from the beginning
3. **Comprehensive Testing**: Verify all functionality before going live
4. **Monitoring**: Set up proper monitoring and alerting
5. **Documentation**: Keep deployment documentation current
6. **Backup Strategy**: Implement and test backup procedures

**Chronicle is now ready for production use. Monitor performance and maintain security through regular updates and reviews.**

---
*This guide consolidates deployment information from multiple Chronicle components and should be updated as deployment procedures evolve.*