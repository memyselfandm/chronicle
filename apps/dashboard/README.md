# Chronicle Dashboard

> **Real-time observability dashboard for Claude Code tool usage and events**

Chronicle Dashboard provides live monitoring and analysis of Claude Code tool interactions, session management, and event tracking through a modern, responsive web interface built with Next.js 14 and real-time Supabase integration.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Environment Setup](#environment-setup)
- [Project Structure](#project-structure)
- [Features](#features)
- [Development](#development)
- [Testing](#testing)
- [Documentation](#documentation)
- [Deployment](#deployment)

## Overview

Chronicle Dashboard is a production-ready observability platform that provides:

- **Real-time Event Monitoring**: Live streaming of Claude Code tool usage events
- **Session Management**: Track and analyze user sessions with detailed metrics
- **Connection Health**: Monitor Supabase connectivity with quality indicators
- **Interactive Analytics**: Drill down into events with detailed context and related data
- **Robust Error Handling**: Graceful fallbacks to demo mode when services are unavailable
- **Performance Monitoring**: Built-in health checks and connection quality tracking

### Technology Stack

- **Frontend**: Next.js 14 with App Router, React 19, TypeScript
- **Styling**: Tailwind CSS 4 with custom design system
- **Database**: Supabase with real-time subscriptions
- **Testing**: Jest with React Testing Library
- **Build Tools**: Turbopack for fast development builds
- **Deployment**: Optimized for Vercel, Netlify, and self-hosted environments

## Quick Start

### Prerequisites

- Node.js 18 or later
- npm or yarn package manager
- Supabase project (for production data)

### Installation

1. **Clone and navigate to the dashboard**:
   ```bash
   git clone [repository-url]
   cd apps/dashboard
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your Supabase credentials
   ```

4. **Run development server**:
   ```bash
   npm run dev
   ```

5. **Open dashboard**:
   Navigate to [http://localhost:3000](http://localhost:3000)

### Demo Mode

If Supabase is not configured or unavailable, the dashboard automatically falls back to demo mode with realistic mock data, allowing you to explore all features without a backend connection.

## Architecture

### Data Flow

```
Claude Code Tools → Supabase Events Table → Real-time Subscriptions → Dashboard Components
                                      ↓
                              Chronicle Sessions Table → Session Analytics
```

### Component Architecture

```
Dashboard Layout
├── Header (Navigation & Status)
├── DashboardWithFallback (Connection Management)
│   ├── ProductionEventDashboard (Live Data)
│   │   ├── ConnectionStatus (Health Monitoring)
│   │   ├── EventFeed (Real-time Events)
│   │   └── EventDetailModal (Event Analysis)
│   └── EventDashboard (Demo Mode)
└── Error Boundaries (Graceful Error Handling)
```

### Core Hooks

- **`useEvents`**: Manages real-time event streaming with pagination and filtering
- **`useSessions`**: Handles session data and analytics calculations
- **`useSupabaseConnection`**: Monitors connection health and quality

## Environment Setup

### Development Environment

Create `.env.development`:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Environment
NEXT_PUBLIC_ENVIRONMENT=development
NEXT_PUBLIC_DEBUG=true

# Features
NEXT_PUBLIC_ENABLE_REALTIME=true
NEXT_PUBLIC_ENABLE_ANALYTICS=false
```

### Production Environment

For production deployment, see [DEPLOYMENT.md](./DEPLOYMENT.md) for comprehensive setup instructions including:

- Security configuration (CSP, rate limiting)
- Monitoring setup (Sentry integration)
- Performance optimization
- Platform-specific deployment guides

### Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | - | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | - | Supabase anonymous key |
| `NEXT_PUBLIC_ENVIRONMENT` | No | `development` | Environment identifier |
| `NEXT_PUBLIC_ENABLE_REALTIME` | No | `true` | Enable real-time subscriptions |
| `NEXT_PUBLIC_DEBUG` | No | `false` | Enable debug logging |
| `NEXT_PUBLIC_MAX_EVENTS_DISPLAY` | No | `1000` | Maximum events to display |

## Project Structure

```
apps/dashboard/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx         # Root layout with global styles
│   │   └── page.tsx           # Main dashboard page
│   ├── components/            # React components
│   │   ├── layout/           # Layout components (Header)
│   │   ├── ui/               # Reusable UI components
│   │   ├── AnimatedEventCard.tsx    # Event display component
│   │   ├── ConnectionStatus.tsx     # Connection health indicator
│   │   ├── DashboardWithFallback.tsx # Main container with error handling
│   │   ├── EventDetailModal.tsx     # Event analysis modal
│   │   ├── EventFeed.tsx           # Real-time event list
│   │   ├── ProductionEventDashboard.tsx # Live data dashboard
│   │   └── ErrorBoundary.tsx       # Error handling components
│   ├── hooks/                 # Custom React hooks
│   │   ├── useEvents.ts       # Event management and real-time streaming
│   │   ├── useSessions.ts     # Session analytics and management
│   │   └── useSupabaseConnection.ts # Connection monitoring
│   ├── lib/                   # Utilities and configuration
│   │   ├── config.ts          # Environment configuration management
│   │   ├── constants.ts       # Application constants
│   │   ├── supabase.ts       # Supabase client configuration
│   │   ├── types.ts          # Shared TypeScript types
│   │   ├── utils.ts          # Utility functions
│   │   ├── security.ts       # Security utilities and validation
│   │   └── monitoring.ts     # Performance monitoring utilities
│   └── types/                 # TypeScript type definitions
│       ├── events.ts         # Event-related types
│       ├── connection.ts     # Connection status types
│       └── filters.ts        # Filter and search types
├── __tests__/                 # Test suites
├── scripts/                   # Utility scripts
│   ├── health-check.js       # Application health verification
│   └── validate-environment.js # Environment validation
├── CODESTYLE.md              # Development patterns and conventions
├── DEPLOYMENT.md             # Production deployment guide
├── SECURITY.md              # Security guidelines and best practices
└── CONFIG_MANAGEMENT.md     # Configuration management guide
```

## Features

### Real-time Event Monitoring

- **Live Event Stream**: Real-time updates via Supabase subscriptions
- **Event Categories**: Tool usage, errors, session events, and system events
- **Interactive Event Cards**: Click to view detailed event information
- **Event Filtering**: Filter by type, session, time range, and content
- **Pagination**: Efficient loading of large event datasets

### Session Analytics

- **Active Sessions**: Monitor currently running Claude Code sessions
- **Session Metrics**: Duration, success rate, tool usage statistics
- **Session Context**: Project information, git branch, and activity timeline
- **Historical Analysis**: Track session patterns and performance over time

### Connection Management

- **Health Monitoring**: Real-time connection status with quality indicators
- **Automatic Fallback**: Seamless transition to demo mode if backend unavailable
- **Reconnection Logic**: Smart retry mechanisms with exponential backoff
- **Performance Metrics**: Connection latency and reliability tracking

### User Interface

- **Responsive Design**: Optimized for desktop and mobile devices
- **Dark/Light Themes**: Configurable theme support
- **Accessibility**: WCAG 2.1 compliant with screen reader support
- **Progressive Enhancement**: Works without JavaScript for basic functionality

### Developer Experience

- **TypeScript**: Full type safety throughout the application
- **Hot Reloading**: Fast development with Turbopack
- **Error Boundaries**: Graceful error handling with helpful error messages
- **Performance Monitoring**: Built-in performance tracking and optimization

## Development

### Available Scripts

```bash
# Development
npm run dev              # Start development server with Turbopack
npm run dev:debug        # Start with debug logging enabled

# Building
npm run build            # Production build
npm run build:analyze    # Build with bundle analysis
npm run build:production # Production build with optimizations
npm run build:staging    # Staging build

# Testing
npm test                 # Run test suite
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage reports

# Quality Assurance
npm run lint             # ESLint code checking
npm run validate:env     # Validate environment configuration
npm run validate:config  # Run full configuration validation
npm run security:check   # Security audit and validation
npm run health:check     # Application health verification

# Deployment
npm run deployment:verify # Pre-deployment verification
```

### Development Workflow

1. **Start Development Server**:
   ```bash
   npm run dev
   ```

2. **Make Changes**: Edit components, hooks, or utilities

3. **Validate Changes**:
   ```bash
   npm run validate:config  # Check configuration
   npm test                 # Run tests
   npm run lint            # Check code style
   ```

4. **Build and Test**:
   ```bash
   npm run build
   npm run health:check
   ```

### Code Style

Chronicle Dashboard follows strict coding conventions documented in [CODESTYLE.md](./CODESTYLE.md), including:

- TypeScript best practices with strict type checking
- React performance patterns (useCallback, useMemo, stable references)
- Consistent error handling and logging patterns
- Shared type definitions to prevent duplication
- Debounced state management for smooth UX

## Testing

### Test Coverage

Chronicle Dashboard maintains comprehensive test coverage:

- **Unit Tests**: Component logic and utility functions
- **Integration Tests**: Component interactions and data flow
- **Performance Tests**: Render performance and memory usage
- **E2E Tests**: Complete user workflows and real-time features

### Running Tests

```bash
# Run all tests
npm test

# Watch mode for development
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run specific test suites
npm test -- --testNamePattern="ConnectionStatus"
npm test -- --testPathPattern="integration"
```

### Test Structure

```
__tests__/
├── components/           # Component tests
├── hooks/               # Hook tests
├── integration/         # Integration tests
├── performance/         # Performance benchmarks
└── error-handling/      # Error scenario tests
```

## Documentation

### Additional Documentation

- **[CODESTYLE.md](./CODESTYLE.md)**: Development patterns and coding conventions
- **[DEPLOYMENT.md](./DEPLOYMENT.md)**: Production deployment guide with platform-specific instructions
- **[SECURITY.md](./SECURITY.md)**: Security guidelines and best practices
- **[CONFIG_MANAGEMENT.md](./CONFIG_MANAGEMENT.md)**: Configuration management and environment setup

### API Documentation

The dashboard integrates with Supabase tables:

- **`chronicle_events`**: Individual tool usage events
- **`chronicle_sessions`**: User session data and metadata

For database schema and API details, refer to the Chronicle backend documentation.

## Deployment

### Quick Deploy

For most deployments, Chronicle Dashboard works out of the box:

```bash
# Vercel (recommended)
vercel --prod

# Netlify
netlify deploy --prod

# Docker
docker build -t chronicle-dashboard .
docker run -p 3000:3000 chronicle-dashboard
```

### Production Considerations

Before deploying to production:

1. **Environment Configuration**: Set up all required environment variables
2. **Security Setup**: Configure CSP, rate limiting, and security headers
3. **Monitoring**: Set up error tracking with Sentry
4. **Performance**: Enable CDN and optimize for your user base
5. **Database**: Ensure proper indexing and backup strategies

For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## Support

### Getting Help

- **Documentation**: Check the docs in this repository
- **Configuration Issues**: See [CONFIG_MANAGEMENT.md](./CONFIG_MANAGEMENT.md)
- **Security Questions**: Review [SECURITY.md](./SECURITY.md)
- **Deployment Problems**: Follow [DEPLOYMENT.md](./DEPLOYMENT.md)

### Development Support

- **Code Style**: Follow patterns in [CODESTYLE.md](./CODESTYLE.md)
- **TypeScript**: All components are fully typed
- **Testing**: Comprehensive test suite with examples
- **Performance**: Built-in monitoring and optimization guides

---

**Chronicle Dashboard** - Real-time observability for Claude Code  
Built with Next.js 14, React 19, TypeScript, and Supabase