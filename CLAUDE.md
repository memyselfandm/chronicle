# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development
```bash
# Start dashboard development server (http://localhost:3000)
npm run dev:dashboard

# Watch hooks tests during development
npm run dev:hooks

# Run both dashboard and hooks development
npm run dev  # Runs dashboard by default
```

### Testing
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Test specific component
npm run test:dashboard
npm run test:hooks

# Run single test file in hooks (using UV)
cd apps/hooks && uv run python -m pytest tests/test_post_tool_use.py -v

# Run specific test
cd apps/hooks && uv run python -m pytest tests/test_post_tool_use.py::TestClassName::test_method -v

# Dashboard tests with watch mode
cd apps/dashboard && npm run test:watch
```

### Code Quality
```bash
# Run linters
npm run lint

# Full validation (lint + test + coverage check)
npm run validate

# Check coverage thresholds
npm run coverage:check

# Generate coverage reports
npm run coverage:report
npm run coverage:badges
```

### Build & Production
```bash
# Build everything
npm run build

# Dashboard production build
cd apps/dashboard && npm run build:production

# Validate environment configuration
cd apps/dashboard && npm run validate:env

# Health check
./scripts/health-check.sh
```

### Installation & Setup
```bash
# Quick start (automated setup)
./scripts/quick-start.sh

# Install hooks system
cd apps/hooks && python scripts/install.py

# Validate installation
cd apps/hooks && python scripts/install.py --validate-only

# Setup database schema
cd apps/hooks && python scripts/setup_schema.py
```

## High-Level Architecture

### System Overview
Chronicle is an observability system for Claude Code agent activities, capturing tool usage, interactions, and performance metrics. It consists of two main components that communicate through a shared database:

1. **Hooks System (Python)**: Intercepts Claude Code events and stores them in database
2. **Dashboard (Next.js)**: Real-time visualization of captured events

### Data Flow Architecture
```
Claude Code Agent
       ↓
   Hook Scripts (Python)
       ↓
   Database Layer (Supabase/SQLite)
       ↓
   Real-time Subscriptions
       ↓
   Dashboard (Next.js)
```

### Database Architecture
The system uses a dual-database approach:
- **Primary**: Supabase (PostgreSQL) for production with real-time capabilities
- **Fallback**: SQLite for local development or when Supabase is unavailable

Key tables:
- `events`: Core event storage with tool usage, errors, and metadata
- `sessions`: Claude Code session tracking and lifecycle
- `tools`: Tool execution details and performance metrics

### Hook System Architecture (`apps/hooks/`)
The hooks system uses UV for dependency management and follows a modular pattern:

- **Entry Points** (`src/hooks/`): Individual hook scripts for each Claude Code event
  - `session_start.py`: Initialize session tracking
  - `pre_tool_use.py`: Capture tool invocations (pure observation, no blocking)
  - `post_tool_use.py`: Record tool results and performance
  - `user_prompt_submit.py`: Track user interactions
  - `stop.py`: Clean session closure

- **Shared Library** (`src/lib/`): 
  - `base_hook.py`: Common hook functionality and event creation
  - `database.py`: Database abstraction layer with connection pooling
  - `utils.py`: MCP tool detection, sanitization, and utilities
  - `security.py`: Data sanitization and PII filtering
  - `performance.py`: Metrics collection and optimization

- **Configuration** (`config/`):
  - `settings.py`: Environment and database configuration
  - `models.py`: Pydantic models for type safety
  - `database.py`: Database connection management

### Dashboard Architecture (`apps/dashboard/`)
Next.js 15 app with App Router and real-time updates:

- **Components** (`src/components/`):
  - `EventDashboard.tsx`: Main dashboard container
  - `EventFeed.tsx`: Real-time event stream display
  - `EventCard.tsx`: Individual event visualization
  - `ConnectionStatus.tsx`: Database connection monitoring

- **Hooks** (`src/hooks/`):
  - `useSupabaseConnection.ts`: Manages database connection and reconnection
  - `useEvents.ts`: Real-time event subscription and caching
  - `useSessions.ts`: Session management and filtering

- **Libraries** (`src/lib/`):
  - `supabase.ts`: Supabase client with real-time configuration
  - `eventProcessor.ts`: Event transformation and filtering
  - `config.ts`: Environment-aware configuration
  - `security.ts`: Client-side data sanitization

### Key Design Patterns

1. **Environment Detection**: Both components auto-detect environment (development/staging/production) and adjust behavior accordingly

2. **Graceful Degradation**: Falls back to SQLite if Supabase unavailable, demo mode if no database

3. **Performance Optimization**:
   - Connection pooling in hooks
   - Event batching in dashboard
   - Debounced real-time subscriptions
   - 100ms target latency for hooks

4. **Security First**:
   - Automatic PII filtering
   - Configurable data sanitization
   - Environment variable validation
   - No authentication required for MVP (pure observability)

## Project Management

### Linear Integration
This project uses Linear for issue tracking and project management. The MCP Linear integration is available for:

- **Creating issues**: Use issue IDs like `CHR-1`, `CHR-2` for Chronicle-related tasks
- **Viewing project status**: Check current sprint progress and backlog items
- **Updating task states**: Move issues through workflow states
- **Adding comments**: Document progress and decisions on Linear issues
- **Linking PRs**: Reference Linear issues in commit messages and PR descriptions

When working on features or fixes:
1. Check Linear for existing issues before starting work
2. Reference Linear issue IDs in commits (e.g., `fix: resolve database connection issue [CHR-123]`)
3. Update issue status as work progresses
4. Add implementation notes as comments on the Linear issue

## Important Notes

- DO NOT directly change scripts or settings in `.claude` or `~/.claude` directories - only update source code that modifies these files
- The system is designed for pure observability - hooks should never block or modify Claude Code behavior
- All hook scripts use UV's single-file script format with inline dependencies
- Coverage thresholds: Dashboard 80%, Hooks 60%, Security modules 90%
- Real-time updates use Supabase's PostgreSQL LISTEN/NOTIFY under the hood