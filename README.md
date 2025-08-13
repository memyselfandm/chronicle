# Chronicle - Observability for Claude Code

Real-time observability system for Claude Code agent activities with comprehensive event tracking and visualization.

## ✅ Sprint 1 Complete: Foundation Phase

### Current Implementation
- **Database**: Supabase PostgreSQL with SQLite fallback (`apps/hooks/config/`)
- **Dashboard**: Next.js 15 with Chronicle dark theme (`apps/dashboard/`)
- **Hook System**: Python architecture with TDD foundation (`apps/hooks/src/`)

### Components Built
- **Sessions & Events Tables**: Complete schema with real-time subscriptions
- **Chronicle UI**: Header, components, responsive design system
- **BaseHook Architecture**: Database abstraction, error handling, data sanitization
- **Test Coverage**: 42+ passing tests across all components

## Quick Start

### Dashboard
```bash
cd apps/dashboard
npm install
npm run dev
```

### Hooks System
```bash
cd apps/hooks
pip install -r requirements.txt
python -m pytest  # Run tests
```

### Database Setup
1. Create Supabase project or use local PostgreSQL
2. Run schema from `apps/hooks/config/schema.sql`
3. Configure `.env` with database credentials

## Stack
- **Frontend**: Next.js 15, TypeScript, Tailwind CSS v4
- **Database**: Supabase (PostgreSQL) + SQLite fallback
- **Hook System**: Python 3.8+ with comprehensive error handling
- **Testing**: Jest (frontend) + pytest (backend)

## Next: Sprint 2
- Real-time Supabase integration in dashboard
- Hook implementations (PreToolUse, PostToolUse, SessionStart, etc.)
- Live event streaming and visualization

## Credit
Inspired by IndieDevDan's observability concepts