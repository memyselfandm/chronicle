# React Component Architecture Reference

## Overview
This reference guide covers modern React component architecture patterns with TypeScript for building scalable, reusable UI libraries and design systems, specifically optimized for real-time dashboards and observability interfaces.

## Core Architecture Principles

### 1. Component Composition Patterns
- **Compound Components**: Related components that work together
- **Render Props**: Share logic between components via function props
- **Higher-Order Components (HOCs)**: Add functionality to existing components
- **Custom Hooks**: Extract and reuse stateful logic
- **Provider Pattern**: Share data across component trees

### 2. TypeScript Integration
- **Strict Type Safety**: Enable strict mode for comprehensive checking
- **Generic Components**: Create reusable components with type parameters
- **Utility Types**: Leverage TypeScript's built-in utilities
- **Interface Composition**: Build complex types from simpler ones

## Component Patterns

### Compound Components Pattern

Ideal for complex UI elements like dropdowns, tabs, and modal dialogs where multiple components need to work together.

```typescript
// components/ui/dropdown.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react'

interface DropdownContextType {
  isOpen: boolean
  toggle: () => void
  close: () => void
}

const DropdownContext = createContext<DropdownContextType | undefined>(undefined)

function useDropdown() {
  const context = useContext(DropdownContext)
  if (!context) {
    throw new Error('Dropdown components must be used within Dropdown')
  }
  return context
}

interface DropdownProps {
  children: ReactNode
  defaultOpen?: boolean
}

function Dropdown({ children, defaultOpen = false }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  
  const toggle = () => setIsOpen(!isOpen)
  const close = () => setIsOpen(false)
  
  return (
    <DropdownContext.Provider value={{ isOpen, toggle, close }}>
      <div className="relative inline-block text-left">
        {children}
      </div>
    </DropdownContext.Provider>
  )
}

function DropdownTrigger({ children, className }: { children: ReactNode; className?: string }) {
  const { toggle } = useDropdown()
  
  return (
    <button 
      onClick={toggle}
      className={`inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${className}`}
    >
      {children}
    </button>
  )
}

function DropdownContent({ children, className }: { children: ReactNode; className?: string }) {
  const { isOpen, close } = useDropdown()
  
  if (!isOpen) return null
  
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={close} />
      <div className={`absolute right-0 z-20 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none ${className}`}>
        <div className="py-1">
          {children}
        </div>
      </div>
    </>
  )
}

function DropdownItem({ children, onClick, className }: { 
  children: ReactNode
  onClick?: () => void
  className?: string 
}) {
  const { close } = useDropdown()
  
  const handleClick = () => {
    onClick?.()
    close()
  }
  
  return (
    <button
      onClick={handleClick}
      className={`block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 ${className}`}
    >
      {children}
    </button>
  )
}

// Export as compound component
Dropdown.Trigger = DropdownTrigger
Dropdown.Content = DropdownContent
Dropdown.Item = DropdownItem

export { Dropdown }

// Usage example:
// <Dropdown>
//   <Dropdown.Trigger>Options</Dropdown.Trigger>
//   <Dropdown.Content>
//     <Dropdown.Item onClick={() => console.log('Edit')}>Edit</Dropdown.Item>
//     <Dropdown.Item onClick={() => console.log('Delete')}>Delete</Dropdown.Item>
//   </Dropdown.Content>
// </Dropdown>
```

### Render Props Pattern

Share logic and data between components by passing a function as a prop.

```typescript
// components/data/data-fetcher.tsx
import { ReactNode, useState, useEffect } from 'react'

interface DataFetcherProps<T> {
  url: string
  children: (data: {
    data: T | null
    loading: boolean
    error: string | null
    refetch: () => void
  }) => ReactNode
}

export function DataFetcher<T>({ url, children }: DataFetcherProps<T>) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch')
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }
  
  useEffect(() => {
    fetchData()
  }, [url])
  
  return (
    <>
      {children({ data, loading, error, refetch: fetchData })}
    </>
  )
}

// Usage:
// <DataFetcher<User[]> url="/api/users">
//   {({ data, loading, error, refetch }) => (
//     <div>
//       {loading && <Spinner />}
//       {error && <ErrorMessage message={error} onRetry={refetch} />}
//       {data && <UserList users={data} />}
//     </div>
//   )}
// </DataFetcher>
```

### Higher-Order Components (HOCs)

Add functionality to existing components without modifying them.

```typescript
// hocs/with-loading.tsx
import React, { ComponentType } from 'react'
import { Spinner } from '@/components/ui/spinner'

interface WithLoadingProps {
  isLoading: boolean
}

export function withLoading<T extends object>(
  WrappedComponent: ComponentType<T>
) {
  return function WithLoadingComponent(props: T & WithLoadingProps) {
    const { isLoading, ...restProps } = props
    
    if (isLoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <Spinner />
        </div>
      )
    }
    
    return <WrappedComponent {...(restProps as T)} />
  }
}

// Usage:
// const LoadingUserList = withLoading(UserList)
// <LoadingUserList users={users} isLoading={loading} />
```

### Custom Hooks Pattern

Extract and reuse stateful logic across components.

```typescript
// hooks/use-realtime-data.ts
import { useState, useEffect, useCallback, useRef } from 'react'

interface UseRealtimeDataOptions {
  endpoint: string
  autoConnect?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
}

interface RealtimeData<T> {
  data: T[]
  isConnected: boolean
  isReconnecting: boolean
  error: string | null
  connect: () => void
  disconnect: () => void
  clearData: () => void
}

export function useRealtimeData<T>({
  endpoint,
  autoConnect = true,
  reconnectInterval = 5000,
  maxReconnectAttempts = 5
}: UseRealtimeDataOptions): RealtimeData<T> {
  const [data, setData] = useState<T[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    
    try {
      const ws = new WebSocket(endpoint)
      wsRef.current = ws
      
      ws.onopen = () => {
        setIsConnected(true)
        setIsReconnecting(false)
        setError(null)
        reconnectAttemptsRef.current = 0
      }
      
      ws.onmessage = (event) => {
        try {
          const newData = JSON.parse(event.data)
          setData(prev => [newData, ...prev].slice(0, 1000)) // Keep last 1000 items
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err)
        }
      }
      
      ws.onclose = () => {
        setIsConnected(false)
        
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          setIsReconnecting(true)
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++
            connect()
          }, reconnectInterval)
        } else {
          setError('Connection failed after maximum retry attempts')
          setIsReconnecting(false)
        }
      }
      
      ws.onerror = () => {
        setError('WebSocket connection error')
      }
    } catch (err) {
      setError('Failed to establish WebSocket connection')
    }
  }, [endpoint, maxReconnectAttempts, reconnectInterval])
  
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    
    setIsConnected(false)
    setIsReconnecting(false)
  }, [])
  
  const clearData = useCallback(() => {
    setData([])
  }, [])
  
  useEffect(() => {
    if (autoConnect) {
      connect()
    }
    
    return () => {
      disconnect()
    }
  }, [autoConnect, connect, disconnect])
  
  return {
    data,
    isConnected,
    isReconnecting,
    error,
    connect,
    disconnect,
    clearData
  }
}

// Usage:
// const { data: events, isConnected, error } = useRealtimeData<Event>({
//   endpoint: 'ws://localhost:3001/events'
// })
```

## UI Library Structure

### Base Component Library

```typescript
// components/ui/button.tsx
import { forwardRef, ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
```

### Dashboard-Specific Components

```typescript
// components/dashboard/event-card.tsx
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { formatDistanceToNow } from 'date-fns'

interface Event {
  id: string
  type: 'tool_use' | 'prompt' | 'session' | 'system'
  timestamp: string
  session_id: string
  status: 'success' | 'error' | 'pending'
  data: Record<string, any>
}

interface EventCardProps {
  event: Event
  onClick?: (event: Event) => void
  className?: string
}

export function EventCard({ event, onClick, className }: EventCardProps) {
  const handleClick = () => {
    onClick?.(event)
  }
  
  const getEventIcon = (type: Event['type']) => {
    switch (type) {
      case 'tool_use': return '🔧'
      case 'prompt': return '💬'
      case 'session': return '📝'
      case 'system': return '⚙️'
      default: return '📄'
    }
  }
  
  return (
    <Card 
      className={cn(
        'cursor-pointer transition-all hover:shadow-md hover:border-primary/20',
        className
      )}
      onClick={handleClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{getEventIcon(event.type)}</span>
            <Badge variant="secondary" className="text-xs">
              {event.type.replace('_', ' ')}
            </Badge>
          </div>
          <StatusIndicator status={event.status === 'success' ? 'completed' : event.status} size="sm" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Session: {event.session_id.slice(0, 8)}...
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
          </p>
          {event.data.tool_name && (
            <p className="text-sm font-medium">
              Tool: {event.data.tool_name}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

### Virtual Scrolling for Performance

```typescript
// components/dashboard/virtual-event-list.tsx
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'
import { EventCard } from './event-card'

interface VirtualEventListProps {
  events: Event[]
  onEventClick?: (event: Event) => void
  height?: number
}

export function VirtualEventList({ 
  events, 
  onEventClick, 
  height = 600 
}: VirtualEventListProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  
  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120, // Estimated height of EventCard
    overscan: 10, // Render 10 extra items outside viewport
  })
  
  return (
    <div
      ref={parentRef}
      className="overflow-auto dashboard-scroll"
      style={{ height }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const event = events[virtualRow.index]
          
          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div className="p-2">
                <EventCard 
                  event={event} 
                  onClick={onEventClick}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

## State Management Patterns

### Zustand Store with TypeScript

```typescript
// stores/dashboard-store.ts
import { create } from 'zustand'
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

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
  filteredEvents: Event[]
  
  // UI State
  selectedEventId: string | null
  selectedSessionId: string | null
  isRealTimeActive: boolean
  filters: Filters
  
  // Computed
  activeSessionsCount: number
  recentEventsCount: number
  
  // Actions
  addEvent: (event: Event) => void
  addEvents: (events: Event[]) => void
  updateSession: (session: Session) => void
  setSelectedEvent: (id: string | null) => void
  setSelectedSession: (id: string | null) => void
  toggleRealTime: () => void
  updateFilters: (filters: Partial<Filters>) => void
  clearFilters: () => void
  applyFilters: () => void
}

export const useDashboardStore = create<DashboardState>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set, get) => ({
          // Initial state
          events: [],
          sessions: [],
          filteredEvents: [],
          selectedEventId: null,
          selectedSessionId: null,
          isRealTimeActive: true,
          filters: {
            eventTypes: [],
            sessionIds: [],
            dateRange: null,
            searchQuery: '',
          },
          
          // Computed getters
          get activeSessionsCount() {
            return get().sessions.filter(s => s.status === 'active').length
          },
          
          get recentEventsCount() {
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
            return get().events.filter(e => new Date(e.timestamp) > oneHourAgo).length
          },
          
          // Actions
          addEvent: (event) =>
            set((state) => {
              state.events.unshift(event)
              if (state.events.length > 1000) {
                state.events = state.events.slice(0, 1000)
              }
              // Re-apply filters
              state.filteredEvents = applyFiltersToEvents(state.events, state.filters)
            }),
            
          addEvents: (events) =>
            set((state) => {
              state.events = [...events, ...state.events].slice(0, 1000)
              state.filteredEvents = applyFiltersToEvents(state.events, state.filters)
            }),
            
          updateSession: (session) =>
            set((state) => {
              const index = state.sessions.findIndex(s => s.id === session.id)
              if (index >= 0) {
                state.sessions[index] = session
              } else {
                state.sessions.push(session)
              }
            }),
            
          setSelectedEvent: (id) => set({ selectedEventId: id }),
          setSelectedSession: (id) => set({ selectedSessionId: id }),
          toggleRealTime: () => set((state) => ({ isRealTimeActive: !state.isRealTimeActive })),
          
          updateFilters: (newFilters) =>
            set((state) => {
              state.filters = { ...state.filters, ...newFilters }
              state.filteredEvents = applyFiltersToEvents(state.events, state.filters)
            }),
            
          clearFilters: () =>
            set((state) => {
              state.filters = {
                eventTypes: [],
                sessionIds: [],
                dateRange: null,
                searchQuery: '',
              }
              state.filteredEvents = state.events
            }),
            
          applyFilters: () =>
            set((state) => {
              state.filteredEvents = applyFiltersToEvents(state.events, state.filters)
            }),
        }))
      ),
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

// Helper function for filtering
function applyFiltersToEvents(events: Event[], filters: Filters): Event[] {
  return events.filter(event => {
    // Filter by event types
    if (filters.eventTypes.length > 0 && !filters.eventTypes.includes(event.type)) {
      return false
    }
    
    // Filter by session IDs
    if (filters.sessionIds.length > 0 && !filters.sessionIds.includes(event.session_id)) {
      return false
    }
    
    // Filter by date range
    if (filters.dateRange) {
      const eventDate = new Date(event.timestamp)
      if (eventDate < filters.dateRange.start || eventDate > filters.dateRange.end) {
        return false
      }
    }
    
    // Filter by search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase()
      const searchableText = JSON.stringify(event.data).toLowerCase()
      if (!searchableText.includes(query)) {
        return false
      }
    }
    
    return true
  })
}

// Selector hooks for optimized subscriptions
export const useEvents = () => useDashboardStore(state => state.filteredEvents)
export const useSessions = () => useDashboardStore(state => state.sessions)
export const useSelectedEvent = () => useDashboardStore(state => state.selectedEventId)
export const useFilters = () => useDashboardStore(state => state.filters)
export const useActiveSessionsCount = () => useDashboardStore(state => state.activeSessionsCount)
```

## Performance Optimization Patterns

### React.memo and Callback Optimization

```typescript
// components/dashboard/optimized-event-card.tsx
import { memo, useCallback } from 'react'
import { EventCard } from './event-card'

interface OptimizedEventCardProps {
  event: Event
  onEventClick: (event: Event) => void
}

export const OptimizedEventCard = memo<OptimizedEventCardProps>(
  ({ event, onEventClick }) => {
    const handleClick = useCallback(() => {
      onEventClick(event)
    }, [event, onEventClick])
    
    return <EventCard event={event} onClick={handleClick} />
  },
  (prevProps, nextProps) => {
    // Custom comparison function
    return (
      prevProps.event.id === nextProps.event.id &&
      prevProps.event.timestamp === nextProps.event.timestamp &&
      prevProps.onEventClick === nextProps.onEventClick
    )
  }
)

OptimizedEventCard.displayName = 'OptimizedEventCard'
```

### Error Boundary Pattern

```typescript
// components/error-boundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined })
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <Card className="w-full max-w-md mx-auto mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Something went wrong
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <Button onClick={this.handleReset} className="w-full">
              Try again
            </Button>
          </CardContent>
        </Card>
      )
    }

    return this.props.children
  }
}

// Hook version for functional components
export function useErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null)
  
  const resetError = () => setError(null)
  
  React.useEffect(() => {
    if (error) {
      throw error
    }
  }, [error])
  
  return { captureError: setError, resetError }
}
```

## Testing Patterns

### Component Testing with React Testing Library

```typescript
// __tests__/components/event-card.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { EventCard } from '@/components/dashboard/event-card'
import { Event } from '@/types/dashboard'

const mockEvent: Event = {
  id: '1',
  type: 'tool_use',
  timestamp: '2024-01-01T12:00:00Z',
  session_id: 'session-123',
  status: 'success',
  data: { tool_name: 'Read' }
}

describe('EventCard', () => {
  it('renders event information correctly', () => {
    render(<EventCard event={mockEvent} />)
    
    expect(screen.getByText('tool use')).toBeInTheDocument()
    expect(screen.getByText(/Session: session-1/)).toBeInTheDocument()
    expect(screen.getByText('Tool: Read')).toBeInTheDocument()
  })
  
  it('calls onClick when clicked', () => {
    const handleClick = jest.fn()
    render(<EventCard event={mockEvent} onClick={handleClick} />)
    
    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledWith(mockEvent)
  })
  
  it('displays correct status indicator', () => {
    render(<EventCard event={mockEvent} />)
    
    const statusIndicator = screen.getByTestId('status-indicator')
    expect(statusIndicator).toHaveClass('status-completed')
  })
})
```

This component architecture reference provides a comprehensive foundation for building scalable, maintainable, and performant React applications with TypeScript, specifically optimized for real-time dashboard and observability interface requirements.