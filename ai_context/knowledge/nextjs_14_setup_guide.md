# Next.js 14+ Setup Guide for Real-Time Dashboards

## Overview
This guide covers setting up Next.js 14+ with App Router, TypeScript, and essential dependencies for building real-time observability dashboards like Chronicle MVP.

## Initial Project Setup

### Create Next.js 14+ Project
```bash
# Recommended command for Chronicle MVP setup
npx create-next-app@latest chronicle-dashboard \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

cd chronicle-dashboard
```

### Essential Dependencies Installation

#### Core Dependencies
```bash
# State management and data fetching
npm install zustand swr

# Charts and visualization
npm install recharts

# UI components and styling
npm install @tailwindcss/typography @tailwindcss/forms
npm install lucide-react clsx tailwind-merge

# Supabase integration
npm install @supabase/supabase-js @supabase/ssr

# Development dependencies
npm install -D @types/node @tailwindcss/postcss
```

#### Optional Performance Dependencies
```bash
# Date handling
npm install date-fns

# Form handling
npm install react-hook-form @hookform/resolvers zod

# Animation
npm install framer-motion

# Virtual scrolling for large lists
npm install @tanstack/react-virtual
```

## Project Structure

### Recommended Directory Layout
```
src/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx
│   ├── dashboard/
│   │   ├── page.tsx
│   │   ├── events/
│   │   ├── sessions/
│   │   └── analytics/
│   └── api/
│       └── supabase/
├── components/
│   ├── ui/
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── modal.tsx
│   │   └── index.ts
│   ├── dashboard/
│   │   ├── event-stream.tsx
│   │   ├── activity-pulse.tsx
│   │   └── session-sidebar.tsx
│   └── layout/
│       ├── header.tsx
│       ├── sidebar.tsx
│       └── main-content.tsx
├── lib/
│   ├── supabase.ts
│   ├── utils.ts
│   └── stores/
│       ├── dashboard-store.ts
│       └── ui-store.ts
├── hooks/
│   ├── use-realtime-events.ts
│   ├── use-session-data.ts
│   └── use-filters.ts
└── types/
    ├── dashboard.ts
    ├── events.ts
    └── sessions.ts
```

## TypeScript Configuration

### Enhanced tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "ES6"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/hooks/*": ["./src/hooks/*"],
      "@/types/*": ["./src/types/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

## Tailwind CSS Configuration

### tailwind.config.js for Dashboard
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'pulse-dot': 'pulseDot 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        pulseDot: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.2)', opacity: '0.7' },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography'), require('@tailwindcss/forms')],
}
```

## App Router Layout Setup

### Root Layout (app/layout.tsx)
```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Chronicle Dashboard',
  description: 'Real-time observability dashboard for Claude Code',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

### Global CSS (app/globals.css)
```css
@import 'tailwindcss';

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 47.4% 11.2%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}

/* Custom scrollbar for dashboard */
.dashboard-scroll::-webkit-scrollbar {
  width: 6px;
}

.dashboard-scroll::-webkit-scrollbar-track {
  @apply bg-muted;
}

.dashboard-scroll::-webkit-scrollbar-thumb {
  @apply bg-muted-foreground/30 rounded-full;
}

.dashboard-scroll::-webkit-scrollbar-thumb:hover {
  @apply bg-muted-foreground/50;
}
```

## State Management Setup (Zustand)

### Dashboard Store
```typescript
// lib/stores/dashboard-store.ts
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface Event {
  id: string
  type: string
  timestamp: string
  session_id: string
  data: Record<string, any>
}

interface Session {
  id: string
  status: 'active' | 'idle' | 'completed'
  started_at: string
  last_activity: string
  project_name?: string
}

interface Filters {
  eventTypes: string[]
  sessionIds: string[]
  dateRange: { start: Date; end: Date } | null
  searchQuery: string
}

interface DashboardState {
  // Data
  events: Event[]
  sessions: Session[]
  
  // UI State
  selectedEventId: string | null
  selectedSessionId: string | null
  isRealTimeActive: boolean
  filters: Filters
  
  // Actions
  addEvent: (event: Event) => void
  updateSession: (session: Session) => void
  setSelectedEvent: (id: string | null) => void
  setSelectedSession: (id: string | null) => void
  toggleRealTime: () => void
  updateFilters: (filters: Partial<Filters>) => void
  clearFilters: () => void
}

export const useDashboardStore = create<DashboardState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        events: [],
        sessions: [],
        selectedEventId: null,
        selectedSessionId: null,
        isRealTimeActive: true,
        filters: {
          eventTypes: [],
          sessionIds: [],
          dateRange: null,
          searchQuery: '',
        },
        
        // Actions
        addEvent: (event) =>
          set((state) => ({
            events: [event, ...state.events].slice(0, 1000), // Keep last 1000 events
          })),
          
        updateSession: (session) =>
          set((state) => ({
            sessions: state.sessions.map((s) =>
              s.id === session.id ? session : s
            ),
          })),
          
        setSelectedEvent: (id) => set({ selectedEventId: id }),
        setSelectedSession: (id) => set({ selectedSessionId: id }),
        toggleRealTime: () =>
          set((state) => ({ isRealTimeActive: !state.isRealTimeActive })),
          
        updateFilters: (newFilters) =>
          set((state) => ({
            filters: { ...state.filters, ...newFilters },
          })),
          
        clearFilters: () =>
          set({
            filters: {
              eventTypes: [],
              sessionIds: [],
              dateRange: null,
              searchQuery: '',
            },
          }),
      }),
      {
        name: 'chronicle-dashboard',
        partialize: (state) => ({
          filters: state.filters,
          isRealTimeActive: state.isRealTimeActive,
        }),
      }
    )
  )
)
```

## SWR Data Fetching Setup

### API Client Configuration
```typescript
// lib/api-client.ts
import useSWR from 'swr'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Generic fetcher for SWR
export const fetcher = async (query: string) => {
  const { data, error } = await supabase.from(query).select('*')
  if (error) throw error
  return data
}

// Custom hooks for data fetching
export function useEvents(filters?: any) {
  const { data, error, mutate } = useSWR(
    ['events', filters],
    () => fetchEvents(filters),
    {
      refreshInterval: 5000, // Refresh every 5 seconds
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  )

  return {
    events: data || [],
    isLoading: !error && !data,
    isError: error,
    mutate,
  }
}

async function fetchEvents(filters?: any) {
  let query = supabase.from('events').select('*').order('timestamp', { ascending: false })
  
  if (filters?.eventTypes?.length) {
    query = query.in('type', filters.eventTypes)
  }
  
  if (filters?.sessionIds?.length) {
    query = query.in('session_id', filters.sessionIds)
  }
  
  const { data, error } = await query.limit(100)
  if (error) throw error
  return data
}
```

## Build Optimization

### next.config.js
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Enable App Router
    appDir: true,
  },
  // Optimize for dashboard performance
  swcMinify: true,
  poweredByHeader: false,
  reactStrictMode: true,
  
  // Bundle analyzer for optimization
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Optimize for real-time updates
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: 10,
            reuseExistingChunk: true,
          },
          common: {
            name: 'common',
            minChunks: 2,
            priority: 5,
            reuseExistingChunk: true,
          },
        },
      }
    }
    
    return config
  },
  
  // Environment variables
  env: {
    CUSTOM_KEY: 'value',
  },
  
  // Headers for performance
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
```

## Performance Considerations

### Real-Time Optimization
- Use SWR's `refreshInterval` for periodic updates
- Implement virtual scrolling for large event lists
- Use React.memo for expensive components
- Debounce search and filter operations
- Implement proper loading states and error boundaries

### Bundle Optimization
- Enable SWC minification
- Use dynamic imports for code splitting
- Optimize images with Next.js Image component
- Implement proper caching strategies

### Accessibility Features
- Ensure proper ARIA labels for dashboard components
- Implement keyboard navigation
- Provide color contrast compliance
- Add screen reader support for real-time updates

## Getting Started Checklist

1. ✅ Create Next.js 14+ project with TypeScript and Tailwind
2. ✅ Install core dependencies (Zustand, SWR, Recharts)
3. ✅ Configure TypeScript with path aliases
4. ✅ Set up Tailwind with dark mode support
5. ✅ Create project structure with components, lib, hooks, types
6. ✅ Configure Zustand store for state management
7. ✅ Set up SWR for data fetching
8. ✅ Implement root layout with theme provider
9. ✅ Configure build optimization settings
10. ✅ Set up development environment with linting and formatting

This setup provides a solid foundation for building the Chronicle MVP dashboard with real-time capabilities, dark theme support, and optimal performance for observability interfaces.