# Chronicle Dashboard Setup Guide

Welcome to the Chronicle Dashboard! This guide will walk you through setting up the observability dashboard for local development and deployment.

## Prerequisites

### Required Software

- **Node.js**: Version 18.0.0 or higher (recommended: 20.x LTS)
- **npm**: Version 9.0.0 or higher (comes with Node.js)
- **Git**: For version control
- **A modern web browser**: Chrome, Firefox, Safari, or Edge

### Recommended Tools

- **VS Code**: With TypeScript and React extensions
- **Chrome DevTools**: For debugging
- **Supabase CLI**: For database management (optional but helpful)

### Supabase Account

You'll need a Supabase project with the Chronicle database schema. See the [Database Setup](#database-setup) section below.

## Quick Start

### 1. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd chronicle-dev/apps/dashboard

# Install dependencies
npm install
```

### 2. Environment Configuration

Create your environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase credentials:

```env
# Supabase Configuration (Required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Optional: Service role key for advanced features
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Environment Settings
NEXT_PUBLIC_ENVIRONMENT=development
NEXT_PUBLIC_APP_TITLE="Chronicle Observability"

# Development Features
NEXT_PUBLIC_DEBUG=true
NEXT_PUBLIC_SHOW_DEV_TOOLS=true
NEXT_PUBLIC_ENABLE_REALTIME=true
```

### 3. Validate Configuration

Run the environment validation script:

```bash
npm run validate:env
```

This script will check your configuration and report any issues.

### 4. Start Development Server

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## Database Setup

### Required Tables

Chronicle Dashboard requires these Supabase tables:

#### chronicle_sessions Table

```sql
CREATE TABLE chronicle_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_path TEXT NOT NULL,
    git_branch TEXT,
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'error')),
    event_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### chronicle_events Table

```sql
CREATE TABLE chronicle_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chronicle_sessions(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('prompt', 'tool_use', 'session_start', 'session_end')),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Required Indexes

```sql
-- Performance indexes
CREATE INDEX idx_events_session_id ON chronicle_events(session_id);
CREATE INDEX idx_events_timestamp ON chronicle_events(timestamp DESC);
CREATE INDEX idx_events_type ON chronicle_events(type);
CREATE INDEX idx_sessions_status ON chronicle_sessions(status);
CREATE INDEX idx_sessions_start_time ON chronicle_sessions(start_time DESC);
```

### Row Level Security (RLS)

Enable RLS and create policies:

```sql
-- Enable RLS
ALTER TABLE chronicle_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chronicle_events ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "Allow read access" ON chronicle_sessions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow read access" ON chronicle_events FOR SELECT USING (auth.role() = 'authenticated');

-- Allow insert for service role
CREATE POLICY "Allow insert for service role" ON chronicle_sessions FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Allow insert for service role" ON chronicle_events FOR INSERT WITH CHECK (auth.role() = 'service_role');
```

### Real-time Subscriptions

Enable real-time subscriptions for live updates:

```sql
-- Enable real-time for the tables
ALTER PUBLICATION supabase_realtime ADD TABLE chronicle_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE chronicle_events;
```

## Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | `https://abc123.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJ...` |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_ENVIRONMENT` | `development` | Environment name |
| `NEXT_PUBLIC_APP_TITLE` | `Chronicle Observability` | Application title |
| `NEXT_PUBLIC_DEBUG` | `true` (dev), `false` (prod) | Enable debug logging |
| `NEXT_PUBLIC_ENABLE_REALTIME` | `true` | Enable real-time updates |
| `NEXT_PUBLIC_MAX_EVENTS_DISPLAY` | `1000` | Maximum events to display |
| `NEXT_PUBLIC_POLLING_INTERVAL` | `5000` | Polling interval in ms |

### Advanced Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `SUPABASE_SERVICE_ROLE_KEY` | - | Service role key for admin operations |
| `SENTRY_DSN` | - | Sentry DSN for error tracking |
| `NEXT_PUBLIC_ANALYTICS_ID` | - | Analytics tracking ID |
| `NEXT_PUBLIC_ENABLE_CSP` | `false` (dev), `true` (prod) | Content Security Policy |

## Development Scripts

### Available Commands

```bash
# Development
npm run dev                    # Start development server with Turbopack
npm run build                 # Build for production
npm run start                 # Start production server
npm run lint                  # Run ESLint

# Testing
npm run test                  # Run all tests
npm run test:watch           # Run tests in watch mode

# Validation and Health Checks
npm run validate:env         # Validate environment configuration
npm run validate:config      # Full configuration validation
npm run security:check       # Security audit
npm run health:check         # Health check script

# Build Variants
npm run build:production     # Production build with optimizations
npm run build:staging        # Staging build
npm run build:analyze        # Build with bundle analyzer
```

### Development Workflow

1. **Start development**: `npm run dev`
2. **Make changes**: Edit files in `src/`
3. **Test changes**: `npm run test`
4. **Validate**: `npm run validate:config`
5. **Build**: `npm run build`

## Testing Setup

### Test Structure

```
__tests__/
├── components/           # Component tests
├── hooks/               # Hook tests  
├── integration/         # Integration tests
├── performance/         # Performance tests
└── error-handling/      # Error scenario tests
```

### Running Tests

```bash
# All tests
npm run test

# Specific test files
npm run test EventCard.test.tsx

# Watch mode for development
npm run test:watch

# Coverage report
npm run test -- --coverage
```

### Test Configuration

Tests use:
- **Jest** for test runner
- **React Testing Library** for component testing
- **jsdom** for DOM simulation
- **@testing-library/user-event** for user interactions

## IDE Setup

### VS Code Extensions

Recommended extensions for optimal development experience:

```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint",
    "bradlc.vscode-tailwindcss"
  ]
}
```

### VS Code Settings

Create `.vscode/settings.json`:

```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "eslint.autoFixOnSave": true,
  "files.exclude": {
    "node_modules": true,
    ".next": true,
    "coverage": true
  }
}
```

## Performance Optimization

### Development Performance

- **Turbopack**: Enabled by default for faster builds
- **Hot Reload**: Automatic refresh on file changes
- **Source Maps**: Enabled for debugging

### Production Optimizations

- **Code Splitting**: Automatic route-based splitting
- **Tree Shaking**: Removes unused code
- **Image Optimization**: Next.js optimized images
- **Bundle Analysis**: Use `npm run build:analyze`

## Next Steps

After successful setup:

1. **Explore the Dashboard**: Open [http://localhost:3000](http://localhost:3000)
2. **Check Real-time Features**: Monitor live event updates
3. **Review Documentation**: See `TROUBLESHOOTING.md` for common issues
4. **Run Tests**: Ensure everything works with `npm run test`
5. **Read Code Style Guide**: Check `CODESTYLE.md` for development standards

## Getting Help

- **Troubleshooting**: See `TROUBLESHOOTING.md`
- **Configuration Issues**: Run `npm run validate:env`
- **Test Failures**: Check test output and logs
- **Performance Issues**: Use Chrome DevTools and performance tests

## Security Notes

- **Never commit `.env.local`** - it contains sensitive keys
- **Use environment-specific files** for different deployments
- **Rotate keys regularly** in production environments
- **Enable RLS policies** in Supabase for data security
- **Use HTTPS** in production environments

---

Happy coding with Chronicle Dashboard! 🚀