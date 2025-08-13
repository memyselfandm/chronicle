# Chronicle Deployment Guide

> **Production-ready deployment guide for Chronicle observability system with system requirements and verification steps**

## Overview

This guide covers deploying Chronicle in various environments with proper system requirements, security considerations, and verification procedures.

## Table of Contents

- [System Requirements](#system-requirements)
- [Deployment Options](#deployment-options)
- [Local Development](#local-development)
- [Production Deployment](#production-deployment)
- [Container Deployment](#container-deployment)
- [Cloud Deployment](#cloud-deployment)
- [Verification Steps](#verification-steps)
- [Performance Monitoring](#performance-monitoring)
- [Maintenance](#maintenance)

## System Requirements

### Minimum Requirements

**Dashboard**:
- **Node.js**: 18.0.0 or higher
- **Memory**: 512MB RAM
- **Storage**: 1GB available space
- **Network**: Stable internet connection for Supabase

**Hooks System**:
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
|----------|-----------|-------|-------|
| **macOS** | ✅ | ✅ | Intel and Apple Silicon |
| **Linux** | ✅ | ✅ | Ubuntu 20.04+, Debian 11+, RHEL 8+ |
| **Windows** | ✅ | ⚠️ | WSL2 recommended for hooks |
| **Docker** | ✅ | ✅ | Multi-platform support |

## Deployment Options

### 1. Quick Development Setup

**Single Command Installation**:
```bash
# Clone and install
git clone <repository-url>
cd chronicle
./scripts/install.sh

# Follow prompts for Supabase configuration
```

### 2. Manual Development Setup

**Dashboard**:
```bash
cd apps/dashboard
npm install
cp .env.example .env.local
# Configure .env.local with Supabase credentials
npm run dev
```

**Hooks**:
```bash
cd apps/hooks
pip install -r requirements.txt
cp .env.template .env
# Configure .env with Supabase credentials
python install.py
```

### 3. Production Setup

See [Production Deployment](#production-deployment) section below.

## Local Development

### Prerequisites

```bash
# Check Node.js version
node --version  # Should be 18+

# Check Python version
python3 --version  # Should be 3.8+

# Check package managers
npm --version
pip --version
```

### Setup Process

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

### 1. Server Preparation

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

### 2. Application Deployment

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

**Environment Configuration**:
```bash
# Dashboard production environment
cat > /home/chronicle/chronicle/apps/dashboard/.env.local << EOF
NEXT_PUBLIC_SUPABASE_URL=https://prod-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-prod-anon-key
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_DEBUG=false
EOF

# Hooks production environment
cat > /home/chronicle/chronicle/apps/hooks/.env << EOF
SUPABASE_URL=https://prod-project.supabase.co
SUPABASE_ANON_KEY=your-prod-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-prod-service-key
CLAUDE_HOOKS_DB_PATH=/var/lib/chronicle/fallback.db
CLAUDE_HOOKS_LOG_LEVEL=WARNING
CLAUDE_HOOKS_SANITIZE_DATA=true
CLAUDE_HOOKS_PII_FILTERING=true
EOF

# Secure environment files
chmod 600 /home/chronicle/chronicle/apps/*/.env*
```

### 3. Process Management

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

### 4. Reverse Proxy (Nginx)

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

## Container Deployment

### 1. Docker Setup

**Dockerfile** (apps/dashboard/Dockerfile):
```dockerfile
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=base /app/node_modules ./node_modules
COPY --from=build --chown=nextjs:nodejs /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
USER nextjs
EXPOSE 3000
CMD ["npm", "start"]
```

**Dockerfile** (apps/hooks/Dockerfile):
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN adduser --disabled-password --gecos '' appuser && \
    chown -R appuser:appuser /app
USER appuser
CMD ["python", "-m", "pytest"]
```

### 2. Docker Compose

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
      - CLAUDE_HOOKS_DB_PATH=/app/data/fallback.db
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

## Cloud Deployment

### 1. Vercel Deployment (Dashboard)

**vercel.json**:
```json
{
  "framework": "nextjs",
  "buildCommand": "cd apps/dashboard && npm run build",
  "outputDirectory": "apps/dashboard/.next",
  "installCommand": "cd apps/dashboard && npm install",
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": "@supabase-url",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@supabase-anon-key"
  }
}
```

**Deploy Commands**:
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd apps/dashboard
vercel --prod

# Set environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### 2. Railway Deployment

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

### 3. DigitalOcean App Platform

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
```

## Verification Steps

### 1. Pre-Deployment Checks

```bash
# Run test suite
cd apps/dashboard && npm test
cd ../hooks && python -m pytest

# Security scan
npm audit
pip-audit

# Build verification
cd apps/dashboard && npm run build
```

### 2. Post-Deployment Verification

**Automated Verification Script**:
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

# Test hooks installation
cd apps/hooks
if python install.py --validate-only; then
    echo "✅ Hooks installation valid"
else
    echo "❌ Hooks installation failed"
    exit 1
fi

# Test real-time functionality
echo "🔄 Testing real-time functionality..."
timeout 10s python3 -c "
import asyncio
from apps.hooks.src.database import DatabaseManager

async def test_insert():
    dm = DatabaseManager()
    await dm.insert_test_event()
    print('✅ Test event inserted')

asyncio.run(test_insert())
" || echo "⚠️ Real-time test timeout (this may be normal)"

echo "✅ Deployment verification complete!"
```

### 3. Health Monitoring

**Health Check Endpoints**:

Create `/api/health` in dashboard:
```javascript
// pages/api/health.js
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
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
}
```

### 4. Load Testing

```bash
# Install Apache Bench
sudo apt install apache2-utils

# Basic load test
ab -n 1000 -c 10 https://your-domain.com/

# Health endpoint test
ab -n 100 -c 5 https://your-domain.com/api/health
```

## Performance Monitoring

### 1. Application Metrics

**PM2 Monitoring**:
```bash
# View real-time metrics
pm2 monit

# View logs
pm2 logs chronicle-dashboard

# Performance metrics
pm2 show chronicle-dashboard
```

**Custom Metrics** (add to dashboard):
```javascript
// lib/metrics.js
export const trackMetric = (name, value, tags = {}) => {
  if (process.env.NODE_ENV === 'production') {
    // Send to your monitoring service
    console.log(`Metric: ${name}=${value}`, tags)
  }
}

// Usage
import { trackMetric } from '../lib/metrics'
trackMetric('page_load_time', performance.now())
```

### 2. Database Monitoring

Monitor these Supabase metrics:
- Connection count
- Query performance
- Storage usage
- Real-time connections

### 3. System Monitoring

```bash
# Install system monitoring
sudo apt install htop iotop

# Monitor resources
htop
iotop
df -h
free -h

# Setup log rotation
sudo logrotate -f /etc/logrotate.d/chronicle
```

## Maintenance

### 1. Regular Updates

```bash
# Update dependencies
cd apps/dashboard && npm update
cd ../hooks && pip install -r requirements.txt --upgrade

# Update system
sudo apt update && sudo apt upgrade -y

# Restart services
pm2 restart all
```

### 2. Backup Procedures

```bash
# Backup configuration
tar -czf chronicle-config-$(date +%Y%m%d).tar.gz \
    apps/dashboard/.env.local \
    apps/hooks/.env \
    ecosystem.config.js

# Backup logs
tar -czf chronicle-logs-$(date +%Y%m%d).tar.gz /var/log/chronicle/
```

### 3. Monitoring Alerts

Set up alerts for:
- High memory usage (>80%)
- High CPU usage (>80%)
- Disk space low (<10% free)
- Application errors
- Database connection failures

## Troubleshooting Deployment

### Common Issues

1. **Port Conflicts**: Ensure ports 3000, 80, 443 are available
2. **Permission Errors**: Check file permissions and user ownership
3. **Memory Issues**: Ensure adequate RAM allocation
4. **Network Issues**: Verify firewall and DNS configuration
5. **SSL Certificate**: Ensure certificates are valid and renewed

### Rollback Procedures

```bash
# Quick rollback with PM2
pm2 reload ecosystem.config.js --update-env

# Full rollback
git checkout previous-stable-tag
npm ci && npm run build
pm2 restart all
```

---

**Chronicle is now deployed and ready for production use. Monitor logs and metrics to ensure optimal performance.**