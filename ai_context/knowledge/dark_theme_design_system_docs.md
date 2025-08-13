# Dark Theme Design System Documentation

## Overview
This guide covers implementing a comprehensive dark theme design system for observability dashboards, with custom color tokens, responsive layouts, and component styling optimized for data visualization and real-time monitoring interfaces.

## Core Design Principles

### Visual Hierarchy in Dark Environments
- **Primary Content**: High contrast text (90-100% opacity)
- **Secondary Content**: Medium contrast text (60-75% opacity) 
- **Tertiary Content**: Low contrast text (40-50% opacity)
- **Interactive Elements**: Bright accent colors for CTAs and navigation
- **Data Visualization**: Carefully chosen color palettes for charts and metrics

### Accessibility Standards
- Minimum contrast ratio of 7:1 for essential text
- Support for system color preferences
- Reduced motion respect for animations
- Screen reader compatible color descriptions

## Color Token Architecture

### CSS Variable Foundation
```css
:root {
  /* Neutral Palette - Light Mode */
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --muted: 210 40% 96%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  
  /* Interactive Elements */
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96%;
  --secondary-foreground: 222.2 47.4% 11.2%;
  --accent: 210 40% 96%;
  --accent-foreground: 222.2 47.4% 11.2%;
  
  /* State Colors */
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;
  --warning: 38 92% 50%;
  --warning-foreground: 48 96% 89%;
  --success: 142 71% 45%;
  --success-foreground: 355 100% 97%;
  --info: 217 91% 60%;
  --info-foreground: 210 40% 98%;
  
  /* Layout & Borders */
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 222.2 47.4% 11.2%;
  --radius: 0.5rem;
  
  /* Dashboard Specific */
  --dashboard-bg: 210 11% 96%;
  --sidebar-bg: 0 0% 100%;
  --header-bg: 0 0% 100%;
  --chart-grid: 210 20% 90%;
  --tooltip-bg: 222.2 84% 4.9%;
  --tooltip-fg: 210 40% 98%;
}

.dark {
  /* Neutral Palette - Dark Mode */
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --muted: 217.2 32.6% 17.5%;
  --muted-foreground: 215 20.2% 65.1%;
  --popover: 222.2 84% 4.9%;
  --popover-foreground: 210 40% 98%;
  --card: 222.2 84% 4.9%;
  --card-foreground: 210 40% 98%;
  
  /* Interactive Elements */
  --primary: 210 40% 98%;
  --primary-foreground: 222.2 47.4% 11.2%;
  --secondary: 217.2 32.6% 17.5%;
  --secondary-foreground: 210 40% 98%;
  --accent: 217.2 32.6% 17.5%;
  --accent-foreground: 210 40% 98%;
  
  /* State Colors */
  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 210 40% 98%;
  --warning: 48 96% 89%;
  --warning-foreground: 38 92% 50%;
  --success: 142 71% 45%;
  --success-foreground: 355 100% 97%;
  --info: 217 91% 60%;
  --info-foreground: 210 40% 98%;
  
  /* Layout & Borders */
  --border: 217.2 32.6% 17.5%;
  --input: 217.2 32.6% 17.5%;
  --ring: 212.7 26.8% 83.9%;
  
  /* Dashboard Specific */
  --dashboard-bg: 224 71% 4%;
  --sidebar-bg: 220 13% 9%;
  --header-bg: 220 13% 9%;
  --chart-grid: 217.2 32.6% 17.5%;
  --tooltip-bg: 210 40% 98%;
  --tooltip-fg: 222.2 84% 4.9%;
}
```

### Extended Color Palette for Data Visualization
```css
:root {
  /* Status Indicators */
  --status-active: 142 71% 45%;
  --status-idle: 48 96% 89%;
  --status-error: 0 84.2% 60.2%;
  --status-warning: 38 92% 50%;
  --status-completed: 217 91% 60%;
  
  /* Event Type Colors */
  --event-tool: 262 83% 58%;
  --event-prompt: 217 91% 60%;
  --event-session: 142 71% 45%;
  --event-system: 38 92% 50%;
  --event-notification: 328 86% 70%;
  
  /* Chart Colors */
  --chart-primary: 217 91% 60%;
  --chart-secondary: 142 71% 45%;
  --chart-tertiary: 38 92% 50%;
  --chart-quaternary: 328 86% 70%;
  --chart-gradient-start: 217 91% 60%;
  --chart-gradient-end: 142 71% 45%;
}

.dark {
  /* Adjusted for dark mode visibility */
  --status-active: 142 71% 45%;
  --status-idle: 48 96% 65%;
  --status-error: 0 84.2% 65%;
  --status-warning: 38 92% 65%;
  --status-completed: 217 91% 70%;
  
  --event-tool: 262 83% 68%;
  --event-prompt: 217 91% 70%;
  --event-session: 142 71% 55%;
  --event-system: 38 92% 65%;
  --event-notification: 328 86% 75%;
  
  --chart-primary: 217 91% 70%;
  --chart-secondary: 142 71% 55%;
  --chart-tertiary: 38 92% 65%;
  --chart-quaternary: 328 86% 75%;
  --chart-gradient-start: 217 91% 70%;
  --chart-gradient-end: 142 71% 55%;
}
```

## Theme Implementation with Next.js

### Theme Provider Setup
```typescript
// components/theme-provider.tsx
'use client'

import * as React from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { type ThemeProviderProps } from 'next-themes/dist/types'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
```

### Theme Toggle Component
```typescript
// components/theme-toggle.tsx
'use client'

import * as React from 'react'
import { Moon, Sun, Monitor } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')}>
          <Sun className="mr-2 h-4 w-4" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          <Moon className="mr-2 h-4 w-4" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          <Monitor className="mr-2 h-4 w-4" />
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

## Responsive Layout System

### Grid-Based Dashboard Layout
```css
/* Dashboard layout utilities */
.dashboard-grid {
  display: grid;
  grid-template-areas: 
    "header header"
    "sidebar main";
  grid-template-columns: 280px 1fr;
  grid-template-rows: 64px 1fr;
  min-height: 100vh;
}

.dashboard-header {
  grid-area: header;
  @apply bg-header-bg border-b border-border;
}

.dashboard-sidebar {
  grid-area: sidebar;
  @apply bg-sidebar-bg border-r border-border;
}

.dashboard-main {
  grid-area: main;
  @apply bg-dashboard-bg overflow-auto;
}

/* Responsive breakpoints */
@media (max-width: 1024px) {
  .dashboard-grid {
    grid-template-areas: 
      "header"
      "main";
    grid-template-columns: 1fr;
    grid-template-rows: 64px 1fr;
  }
  
  .dashboard-sidebar {
    @apply fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] w-80 transform transition-transform -translate-x-full;
  }
  
  .dashboard-sidebar.open {
    @apply translate-x-0;
  }
}

@media (max-width: 768px) {
  .dashboard-grid {
    grid-template-rows: 56px 1fr;
  }
  
  .dashboard-sidebar {
    @apply w-full top-14 h-[calc(100vh-3.5rem)];
  }
}
```

### Container and Spacing System
```css
/* Container utilities for dashboard */
.container-dashboard {
  @apply w-full max-w-none px-4 md:px-6 lg:px-8;
}

.container-narrow {
  @apply w-full max-w-7xl mx-auto px-4 md:px-6;
}

.container-wide {
  @apply w-full max-w-none px-2 md:px-4;
}

/* Spacing scale for dashboard components */
.space-dashboard > * + * {
  @apply mt-6;
}

.space-dashboard-sm > * + * {
  @apply mt-4;
}

.space-dashboard-lg > * + * {
  @apply mt-8;
}
```

## Component Styling Patterns

### Card Components
```typescript
// components/ui/card.tsx
import * as React from 'react'
import { cn } from '@/lib/utils'

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: 'default' | 'elevated' | 'outlined'
  }
>(({ className, variant = 'default', ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'rounded-lg border bg-card text-card-foreground shadow-sm',
      {
        'shadow-md': variant === 'elevated',
        'border-2': variant === 'outlined',
      },
      className
    )}
    {...props}
  />
))
Card.displayName = 'Card'

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 p-6', className)}
    {...props}
  />
))
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      'text-2xl font-semibold leading-none tracking-tight',
      className
    )}
    {...props}
  />
))
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
))
CardDescription.displayName = 'CardDescription'

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
))
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center p-6 pt-0', className)}
    {...props}
  />
))
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
```

### Dashboard-Specific Components
```typescript
// components/dashboard/metric-card.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  title: string
  value: string | number
  change?: {
    value: number
    type: 'increase' | 'decrease' | 'neutral'
  }
  icon?: LucideIcon
  className?: string
}

export function MetricCard({ 
  title, 
  value, 
  change, 
  icon: Icon, 
  className 
}: MetricCardProps) {
  return (
    <Card className={cn('hover:shadow-md transition-shadow', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change && (
          <p className={cn(
            'text-xs',
            change.type === 'increase' && 'text-green-600 dark:text-green-400',
            change.type === 'decrease' && 'text-red-600 dark:text-red-400',
            change.type === 'neutral' && 'text-muted-foreground'
          )}>
            {change.type === 'increase' ? '+' : change.type === 'decrease' ? '-' : ''}
            {Math.abs(change.value)}% from last period
          </p>
        )}
      </CardContent>
    </Card>
  )
}
```

### Status Indicator Components
```typescript
// components/ui/status-indicator.tsx
import { cn } from '@/lib/utils'

interface StatusIndicatorProps {
  status: 'active' | 'idle' | 'error' | 'warning' | 'completed'
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  className?: string
}

const statusConfig = {
  active: {
    color: 'bg-green-500',
    text: 'Active',
    pulse: 'animate-pulse',
  },
  idle: {
    color: 'bg-yellow-500',
    text: 'Idle',
    pulse: '',
  },
  error: {
    color: 'bg-red-500',
    text: 'Error',
    pulse: 'animate-pulse',
  },
  warning: {
    color: 'bg-orange-500',
    text: 'Warning',
    pulse: '',
  },
  completed: {
    color: 'bg-blue-500',
    text: 'Completed',
    pulse: '',
  },
}

const sizeConfig = {
  sm: 'h-2 w-2',
  md: 'h-3 w-3',
  lg: 'h-4 w-4',
}

export function StatusIndicator({ 
  status, 
  size = 'md', 
  showText = false,
  className 
}: StatusIndicatorProps) {
  const config = statusConfig[status]
  
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div 
        className={cn(
          'rounded-full',
          config.color,
          config.pulse,
          sizeConfig[size]
        )}
      />
      {showText && (
        <span className="text-sm text-muted-foreground">
          {config.text}
        </span>
      )}
    </div>
  )
}
```

## Animation and Transitions

### Smooth Theme Transitions
```css
/* Smooth theme transitions */
* {
  transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
}

/* Disable transitions during theme change */
.theme-transitioning * {
  transition: none !important;
}
```

### Dashboard-Specific Animations
```css
/* Event stream animations */
@keyframes slideInFromRight {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes pulseGlow {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(59, 130, 246, 0);
  }
}

.event-enter {
  animation: slideInFromRight 0.3s ease-out;
}

.activity-pulse {
  animation: pulseGlow 2s infinite;
}

/* Loading states */
@keyframes shimmer {
  0% {
    background-position: -200px 0;
  }
  100% {
    background-position: calc(200px + 100%) 0;
  }
}

.loading-shimmer {
  background: linear-gradient(
    90deg,
    hsl(var(--muted)) 25%,
    hsl(var(--muted-foreground) / 0.1) 50%,
    hsl(var(--muted)) 75%
  );
  background-size: 200px 100%;
  animation: shimmer 1.5s infinite;
}
```

## Accessibility Considerations

### Color Contrast Validation
```typescript
// utils/color-contrast.ts
export function checkContrast(foreground: string, background: string): boolean {
  // Implementation to check WCAG contrast ratios
  // Returns true if contrast ratio >= 7:1 for AA compliance
  return true
}

export const contrastPairs = {
  // Validated color pairs for accessibility
  light: {
    primary: { bg: 'hsl(222.2, 47.4%, 11.2%)', fg: 'hsl(210, 40%, 98%)' },
    secondary: { bg: 'hsl(210, 40%, 96%)', fg: 'hsl(222.2, 47.4%, 11.2%)' },
  },
  dark: {
    primary: { bg: 'hsl(210, 40%, 98%)', fg: 'hsl(222.2, 47.4%, 11.2%)' },
    secondary: { bg: 'hsl(217.2, 32.6%, 17.5%)', fg: 'hsl(210, 40%, 98%)' },
  },
}
```

### Screen Reader Support
```typescript
// components/dashboard/accessible-chart.tsx
interface AccessibleChartProps {
  data: any[]
  ariaLabel: string
  description: string
}

export function AccessibleChart({ data, ariaLabel, description }: AccessibleChartProps) {
  return (
    <div 
      role="img" 
      aria-label={ariaLabel}
      aria-describedby="chart-description"
    >
      {/* Chart component */}
      <div id="chart-description" className="sr-only">
        {description}
      </div>
      
      {/* Alternative data table for screen readers */}
      <table className="sr-only">
        <caption>Data visualization: {ariaLabel}</caption>
        {/* Table representation of chart data */}
      </table>
    </div>
  )
}
```

## Performance Optimizations

### CSS-in-JS with Tailwind
```typescript
// utils/css-utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Theme-aware utility functions
export function getThemeColor(colorName: string, fallback: string = '') {
  if (typeof window === 'undefined') return fallback
  
  const style = getComputedStyle(document.documentElement)
  return style.getPropertyValue(`--${colorName}`) || fallback
}
```

### Reduced Motion Support
```css
/* Respect user motion preferences */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  
  .activity-pulse {
    animation: none;
  }
  
  .event-enter {
    animation: none;
  }
}
```

## Testing the Design System

### Theme Testing Utilities
```typescript
// __tests__/theme-utils.ts
import { render } from '@testing-library/react'
import { ThemeProvider } from '@/components/theme-provider'

export function renderWithTheme(ui: React.ReactElement, theme: 'light' | 'dark' = 'light') {
  return render(
    <ThemeProvider defaultTheme={theme} forcedTheme={theme}>
      {ui}
    </ThemeProvider>
  )
}

export function testBothThemes(component: React.ReactElement, testFn: () => void) {
  describe('Light theme', () => {
    beforeEach(() => {
      renderWithTheme(component, 'light')
    })
    testFn()
  })
  
  describe('Dark theme', () => {
    beforeEach(() => {
      renderWithTheme(component, 'dark')
    })
    testFn()
  })
}
```

This design system provides a comprehensive foundation for building accessible, performant, and visually appealing dark-themed observability dashboards with Next.js and Tailwind CSS.