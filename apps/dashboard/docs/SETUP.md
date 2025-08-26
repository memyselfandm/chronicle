# Chronicle Dashboard Setup Guide

> **Get your Chronicle Dashboard running in under 30 minutes**

This guide walks you through setting up the Chronicle Dashboard from zero to production-ready. Whether you're running locally for development or deploying to production, this guide has you covered.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Configuration](#environment-configuration)
- [Supabase Setup](#supabase-setup)
- [Development Workflow](#development-workflow)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)
- [Next Steps](#next-steps)

## Prerequisites

Before you begin, ensure you have these tools installed:

### Required Software

| Tool | Minimum Version | Recommended | Installation |
|------|----------------|-------------|--------------|
| **Node.js** | 18.0.0 | 20.x LTS | [Download](https://nodejs.org/) |
| **npm** | 8.0.0 | Latest | Included with Node.js |
| **Git** | 2.0.0 | Latest | [Download](https://git-scm.com/) |

### Optional (For Production)

| Tool | Purpose | Installation |
|------|---------|--------------|
| **Docker** | Containerization | [Download](https://docker.com/) |
| **Vercel CLI** | Deployment | `npm i -g vercel` |
| **Supabase CLI** | Database management | `npm i -g supabase` |

### System Requirements

- **OS**: macOS, Windows, or Linux
- **RAM**: 4GB minimum, 8GB recommended
- **Disk**: 2GB free space for dependencies
- **Network**: Stable internet connection

## Quick Start

### 1. Clone the Repository

```bash
# Clone the Chronicle project
git clone [your-repository-url]
cd chr-25-dashboard-redesign/apps/dashboard
```

### 2. Install Dependencies

```bash
# Install all required packages
npm install

# This installs:
# - Next.js 15.4.6 with App Router
# - React 19.1.0 with TypeScript
# - Supabase client libraries
# - Tailwind CSS 4 for styling
# - Testing frameworks (Jest, React Testing Library)
# - Development tools (ESLint, TypeScript compiler)
```

**Installation time**: ~2-3 minutes on modern hardware

### 3. Environment Setup

```bash
# Create your local environment file
cp .env.example .env.local

# Open the file for editing
nano .env.local  # or use your preferred editor
```

### 4. Start Development Server

```bash
# Start with Turbopack for fastest builds
npm run dev

# Server will start on http://localhost:3000
# Hot reload enabled - changes auto-refresh
```

**Startup time**: ~10-15 seconds

### 5. Verify Installation

Open [http://localhost:3000](http://localhost:3000) in your browser. You should see:

✅ Chronicle Dashboard loading screen  
✅ Demo mode active (if no Supabase configured)  
✅ Mock event data displaying  
✅ No console errors  

## Environment Configuration

Chronicle Dashboard uses environment variables for configuration. Here's how to set them up:

### Environment File Structure

Create `.env.local` in the dashboard root directory:

```env
#################################################################
# CHRONICLE DASHBOARD ENVIRONMENT CONFIGURATION
# Copy this file to .env.local and update with your values
#################################################################

#################################
# CORE CONFIGURATION (REQUIRED)
#################################

# Supabase Configuration - Get these from your Supabase project
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Environment Identifier
NEXT_PUBLIC_ENVIRONMENT=development

#################################
# FEATURE FLAGS (OPTIONAL)
#################################

# Real-time Event Streaming
NEXT_PUBLIC_ENABLE_REALTIME=true

# Analytics and Metrics
NEXT_PUBLIC_ENABLE_ANALYTICS=true

# Data Export Features
NEXT_PUBLIC_ENABLE_EXPORT=true

# Experimental Features (disable in production)
NEXT_PUBLIC_ENABLE_EXPERIMENTAL_FEATURES=true

#################################
# DEBUGGING & DEVELOPMENT
#################################

# Debug Mode - shows detailed logs
NEXT_PUBLIC_DEBUG=true

# Log Level: error | warn | info | debug
NEXT_PUBLIC_LOG_LEVEL=debug

# Development Tools
NEXT_PUBLIC_SHOW_DEV_TOOLS=true
NEXT_PUBLIC_ENABLE_PROFILER=true
NEXT_PUBLIC_SHOW_ENVIRONMENT_BADGE=true

#################################
# PERFORMANCE TUNING
#################################

# Maximum events to display in UI
NEXT_PUBLIC_MAX_EVENTS_DISPLAY=1000

# Database polling interval (ms)
NEXT_PUBLIC_POLLING_INTERVAL=5000

# Event batch size for processing
NEXT_PUBLIC_BATCH_SIZE=50

# Real-time connection settings
NEXT_PUBLIC_REALTIME_HEARTBEAT_INTERVAL=30000
NEXT_PUBLIC_REALTIME_TIMEOUT=10000

#################################
# UI CUSTOMIZATION
#################################

# Default theme: light | dark
NEXT_PUBLIC_DEFAULT_THEME=dark

# Application title
NEXT_PUBLIC_APP_TITLE=Chronicle Observability

#################################
# PRODUCTION SETTINGS (Optional)
#################################

# Error tracking (production only)
# SENTRY_DSN=https://your-sentry-dsn@sentry.io/project

# Analytics tracking
# NEXT_PUBLIC_ANALYTICS_ID=G-XXXXXXXXXX
# NEXT_PUBLIC_ENABLE_ANALYTICS_TRACKING=false

# Security features (auto-enabled in production)
# NEXT_PUBLIC_ENABLE_CSP=true
# NEXT_PUBLIC_ENABLE_SECURITY_HEADERS=true
# NEXT_PUBLIC_ENABLE_RATE_LIMITING=true
```

### Environment Variables Reference

#### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | `https://abc123.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous access key | `eyJhbGciOiJIUzI1NiI...` |

#### Optional Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_ENVIRONMENT` | `development` | Environment identifier |
| `NEXT_PUBLIC_DEBUG` | `true` (dev), `false` (prod) | Enable debug logging |
| `NEXT_PUBLIC_ENABLE_REALTIME` | `true` | Real-time event streaming |
| `NEXT_PUBLIC_MAX_EVENTS_DISPLAY` | `1000` | UI performance limit |
| `NEXT_PUBLIC_DEFAULT_THEME` | `dark` | UI theme preference |

### Environment Validation

The dashboard includes built-in environment validation:

```bash
# Validate your configuration
npm run validate:env

# Full configuration check
npm run validate:config

# Security audit
npm run security:check
```

**Example validation output:**
```
✅ All environment validations passed!

Environment Summary:
  Environment: development
  Supabase: Configured
  Sentry: Not configured
```

## Supabase Setup

Chronicle Dashboard requires a Supabase project for data storage and real-time features.

### Option 1: Use Existing Supabase Project

If you have access to an existing Chronicle Supabase project:

1. **Get your project credentials** from the Supabase dashboard
2. **Add them to `.env.local`** (see Environment Configuration above)
3. **Test the connection**:
   ```bash
   npm run health:check
   ```

### Option 2: Create New Supabase Project

#### Step 1: Create Project

1. Go to [supabase.com](https://supabase.com) and sign up/in
2. Click "New Project"
3. Configure your project:
   - **Name**: `chronicle-dashboard` (or your preferred name)
   - **Database Password**: Generate a strong password
   - **Region**: Choose closest to your users
   - **Plan**: Free tier is sufficient for development

#### Step 2: Get Project Credentials

1. In your Supabase dashboard, go to **Settings → API**
2. Copy these values:
   - **Project URL**: `https://your-project.supabase.co`
   - **Anon public key**: `eyJhbGciOiJIUzI1NiI...`

#### Step 3: Set Up Database Schema

The dashboard needs specific database tables. You have two options:

**Option A: Automatic Schema Setup (Recommended)**

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link your project (use project reference ID from dashboard)
supabase link --project-ref your-project-id

# Apply the Chronicle schema
supabase db push
```

**Option B: Manual Schema Setup**

1. Go to your Supabase dashboard → **SQL Editor**
2. Create a new query and run this schema:

```sql
-- Chronicle Dashboard Database Schema

-- Events table for tool usage tracking
CREATE TABLE IF NOT EXISTS chronicle_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_data JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    tool_name TEXT,
    project_path TEXT,
    git_branch TEXT,
    environment TEXT DEFAULT 'development',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions table for session management
CREATE TABLE IF NOT EXISTS chronicle_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT UNIQUE NOT NULL,
    project_path TEXT,
    git_branch TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    status TEXT DEFAULT 'active',
    environment TEXT DEFAULT 'development',
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_chronicle_events_session_id ON chronicle_events(session_id);
CREATE INDEX IF NOT EXISTS idx_chronicle_events_timestamp ON chronicle_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_chronicle_events_type ON chronicle_events(event_type);
CREATE INDEX IF NOT EXISTS idx_chronicle_sessions_status ON chronicle_sessions(status);
CREATE INDEX IF NOT EXISTS idx_chronicle_sessions_started_at ON chronicle_sessions(started_at DESC);

-- Enable real-time subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE chronicle_events;
ALTER PUBLICATION supabase_realtime ADD TABLE chronicle_sessions;

-- Row Level Security (RLS) - adjust based on your needs
ALTER TABLE chronicle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE chronicle_sessions ENABLE ROW LEVEL SECURITY;

-- Public read access (adjust based on your security requirements)
CREATE POLICY "Enable read access for all users" ON chronicle_events FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON chronicle_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable read access for all users" ON chronicle_sessions FOR SELECT USING (true);
CREATE POLICY "Enable insert/update access for all users" ON chronicle_sessions FOR ALL WITH CHECK (true);
```

3. Click **Run** to execute the schema

#### Step 4: Verify Database Setup

```bash
# Check database connection
npm run health:check

# Should show:
# ✅ Supabase connection: Healthy
# ✅ Database tables: Found
# ✅ Real-time subscriptions: Active
```

### Real-time Configuration

Chronicle Dashboard uses Supabase real-time subscriptions for live event streaming. The connection is automatically configured based on your environment variables.

**Real-time Features:**
- Live event streaming as they occur
- Session status updates
- Connection health monitoring
- Automatic reconnection on network issues

## Development Workflow

### Available Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `npm run dev` | Start development server | Daily development |
| `npm run build` | Production build | Before deployment |
| `npm test` | Run test suite | Before commits |
| `npm run lint` | Code quality check | Code review |
| `npm run validate:config` | Full system validation | Setup verification |

### Development Server Options

```bash
# Standard development (recommended)
npm run dev

# Development with debug logging
NEXT_PUBLIC_DEBUG=true npm run dev

# Development with specific port
npm run dev -- --port 3001

# Development with network access (for mobile testing)
npm run dev -- --hostname 0.0.0.0
```

### Hot Reload Features

The dashboard includes advanced hot reload:

- **Component hot reload**: React components update without losing state
- **Style hot reload**: CSS/Tailwind changes apply instantly
- **Environment variable reload**: Some env vars update without restart
- **TypeScript compilation**: Type checking happens in parallel

### Build Process

```bash
# Standard production build
npm run build

# Build with bundle analysis
npm run build:analyze

# Environment-specific builds
npm run build:production  # Production optimizations
npm run build:staging     # Staging configuration
```

**Build artifacts:**
- `.next/` - Next.js build output
- `out/` - Static export (if configured)
- Bundle analysis reports in `reports/`

## Verification

### Step-by-Step Verification

Follow these steps to ensure everything is working correctly:

#### 1. Environment Validation ✅

```bash
npm run validate:env
```
**Expected result**: All validations pass, no missing variables

#### 2. Dependency Check ✅

```bash
npm ls --depth=0
```
**Expected result**: No missing or conflicting dependencies

#### 3. TypeScript Compilation ✅

```bash
npx tsc --noEmit
```
**Expected result**: No type errors

#### 4. Linting Check ✅

```bash
npm run lint
```
**Expected result**: No linting errors

#### 5. Test Suite ✅

```bash
npm test
```
**Expected result**: All tests pass

#### 6. Development Server ✅

```bash
npm run dev
```
**Expected result**: 
- Server starts on http://localhost:3000
- No console errors
- Dashboard loads within 3 seconds

#### 7. Supabase Connection ✅

```bash
npm run health:check
```
**Expected result**: 
- Database connection healthy
- Required tables present
- Real-time subscriptions active

#### 8. Feature Verification ✅

In your browser at http://localhost:3000:

**Visual Checks:**
- [ ] Dashboard loads without errors
- [ ] Header shows connection status
- [ ] Sidebar shows sessions (demo data if no real data)
- [ ] Event feed displays events
- [ ] Real-time indicator shows "Connected" or "Demo Mode"

**Interaction Checks:**
- [ ] Click on an event to see details
- [ ] Sidebar session filtering works
- [ ] Auto-scroll toggle functions
- [ ] Theme switching works (if implemented)
- [ ] Responsive design on mobile

#### 9. Performance Check ✅

```bash
npm run build
npm run start
```

**Expected metrics:**
- Build time: < 60 seconds
- Page load time: < 3 seconds
- First Contentful Paint: < 1.5 seconds
- No memory leaks during navigation

### Troubleshooting Setup Issues

If verification fails, see the [Troubleshooting](#troubleshooting) section below.

## Troubleshooting

### Common Issues and Solutions

#### Issue: "Missing environment variables"

**Symptoms:**
```
Error: Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL
```

**Solutions:**
1. Check that `.env.local` exists in the dashboard root
2. Verify variable names are exactly correct (case-sensitive)
3. Ensure no extra spaces around the `=` sign
4. Restart the development server after changes

```bash
# Debug environment loading
node -e "console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)"
```

#### Issue: "Supabase connection failed"

**Symptoms:**
- Dashboard shows "Demo Mode"
- Console errors about network requests
- Health check fails

**Solutions:**
1. **Check your Supabase URL format:**
   ```bash
   # Correct format
   NEXT_PUBLIC_SUPABASE_URL=https://abc123.supabase.co
   
   # Wrong formats
   NEXT_PUBLIC_SUPABASE_URL=abc123.supabase.co  # Missing https://
   NEXT_PUBLIC_SUPABASE_URL=https://abc123.supabase.co/  # Trailing slash
   ```

2. **Verify your anon key:**
   ```bash
   # Key should be a long JWT token starting with eyJ
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

3. **Check Supabase project status:**
   - Go to your Supabase dashboard
   - Ensure project is not paused
   - Check service health status

4. **Test direct connection:**
   ```bash
   curl -H "apikey: YOUR_ANON_KEY" "YOUR_SUPABASE_URL/rest/v1/"
   ```

#### Issue: "Build fails with TypeScript errors"

**Symptoms:**
```
Type error: Property 'xyz' does not exist on type 'ABC'
```

**Solutions:**
1. **Update TypeScript:**
   ```bash
   npm install typescript@latest
   ```

2. **Clear TypeScript cache:**
   ```bash
   rm -rf .next
   rm tsconfig.tsbuildinfo
   npm run build
   ```

3. **Check for version conflicts:**
   ```bash
   npm ls typescript
   npm ls @types/react
   ```

#### Issue: "Port 3000 already in use"

**Solutions:**
```bash
# Option 1: Use different port
npm run dev -- --port 3001

# Option 2: Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Option 3: Set default port
echo "PORT=3001" >> .env.local
```

#### Issue: "Database schema not found"

**Symptoms:**
- Events don't appear in dashboard
- Console errors about missing tables
- Health check shows "Database tables: Missing"

**Solutions:**
1. **Verify table creation:**
   - Go to Supabase Dashboard → Table Editor
   - Check that `chronicle_events` and `chronicle_sessions` tables exist

2. **Re-run schema setup:**
   ```sql
   -- In Supabase SQL Editor, run the schema from the setup section above
   ```

3. **Check table permissions:**
   ```sql
   -- Verify RLS policies
   SELECT schemaname, tablename, policyname 
   FROM pg_policies 
   WHERE tablename IN ('chronicle_events', 'chronicle_sessions');
   ```

#### Issue: "Real-time not working"

**Symptoms:**
- Events don't appear in real-time
- Manual refresh required to see new data
- Connection status shows "Connecting" indefinitely

**Solutions:**
1. **Check real-time publications:**
   ```sql
   -- In Supabase SQL Editor
   SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
   ```

2. **Verify real-time is enabled:**
   - Supabase Dashboard → Settings → API → Real-time
   - Ensure it's enabled for your tables

3. **Check browser WebSocket support:**
   - Open browser developer tools
   - Check Network tab for WebSocket connections
   - Look for connection to `wss://your-project.supabase.co/realtime/v1/websocket`

#### Issue: "Slow performance or high memory usage"

**Solutions:**
1. **Reduce event display limit:**
   ```env
   NEXT_PUBLIC_MAX_EVENTS_DISPLAY=500  # Reduce from 1000
   ```

2. **Increase polling interval:**
   ```env
   NEXT_PUBLIC_POLLING_INTERVAL=10000  # Increase from 5000ms
   ```

3. **Disable debugging in development:**
   ```env
   NEXT_PUBLIC_DEBUG=false
   NEXT_PUBLIC_ENABLE_PROFILER=false
   ```

4. **Check for memory leaks:**
   ```bash
   npm run build
   npm run start
   # Use Chrome DevTools Memory tab to monitor
   ```

#### Issue: "Permission denied errors"

**Symptoms:**
```
Error: Permission denied for table chronicle_events
```

**Solutions:**
1. **Check RLS policies:**
   ```sql
   -- View current policies
   \d+ chronicle_events
   \d+ chronicle_sessions
   ```

2. **Update policies if needed:**
   ```sql
   -- Allow public read access
   CREATE POLICY "Public read access" ON chronicle_events 
   FOR SELECT USING (true);
   ```

3. **Verify anon key permissions:**
   - Check that your anon key has the correct role
   - Ensure service role key is not required

### Getting Additional Help

If you're still experiencing issues:

1. **Check the logs:**
   ```bash
   # Development server logs
   npm run dev 2>&1 | tee debug.log
   
   # Browser console logs
   # Open DevTools → Console for client-side errors
   ```

2. **Run diagnostic script:**
   ```bash
   npm run health:check -- --verbose
   ```

3. **Validate complete setup:**
   ```bash
   npm run deployment:verify
   ```

4. **Create minimal reproduction:**
   - Start with a fresh `.env.local`
   - Test with minimal configuration
   - Add variables one by one

## Next Steps

Once you have Chronicle Dashboard running successfully:

### Development

- **Explore the codebase**: Review the [CODESTYLE.md](../CODESTYLE.md) for development patterns
- **Read the documentation**: Check out other files in the `docs/` directory
- **Run tests**: Familiarize yourself with the test suite using `npm test`
- **Try customization**: Modify the theme or add new features

### Production Deployment

- **Review security**: Follow the security guidelines
- **Set up monitoring**: Configure error tracking with Sentry
- **Performance optimization**: Enable production optimizations
- **Database backup**: Set up automated backups for your Supabase project

### Contributing

- **Read the contributing guide**: Check project-specific contribution guidelines
- **Join the community**: Connect with other Chronicle Dashboard developers
- **Report issues**: Use the issue tracker for bugs and feature requests

---

## Summary

You now have Chronicle Dashboard running! Here's what you accomplished:

✅ **Environment Setup**: Node.js, dependencies, and configuration  
✅ **Database Connection**: Supabase project with proper schema  
✅ **Development Server**: Live reload with hot module replacement  
✅ **Feature Verification**: All core features working correctly  
✅ **Troubleshooting Knowledge**: Solutions for common issues  

**Estimated total setup time**: 15-30 minutes

### Quick Reference Commands

```bash
# Daily development
npm run dev                    # Start development server
npm run validate:config        # Check configuration
npm test                       # Run tests

# Before deployment
npm run build                  # Production build
npm run deployment:verify      # Pre-deployment checks
npm run health:check           # System health

# Troubleshooting
npm run validate:env           # Environment validation
npm run security:check         # Security audit
```

Welcome to Chronicle Dashboard development! 🚀