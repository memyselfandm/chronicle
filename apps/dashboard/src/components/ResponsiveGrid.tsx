/**
 * ResponsiveGrid - Dynamic CSS Grid layout component for responsive design
 * 
 * Features:
 * - CSS Grid with named areas for semantic layout
 * - Responsive breakpoints: mobile (<768px), tablet (768-1024px), desktop (>1024px)  
 * - Dynamic sidebar width handling (220px expanded, 48px collapsed)
 * - Fixed header height (40px)
 * - Flexible main content area
 * - Touch-friendly interactions for mobile
 * - Overflow handling for small screens
 */

'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export interface ResponsiveGridProps {
  /** Whether the sidebar is collapsed */
  sidebarCollapsed: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Whether the layout is loading */
  loading?: boolean;
  /** Children components */
  children: React.ReactNode;
}

/**
 * Responsive grid layout component with dynamic breakpoints
 */
export function ResponsiveGrid({
  sidebarCollapsed,
  className,
  loading = false,
  children
}: ResponsiveGridProps) {
  const [breakpoint, setBreakpoint] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  const [isMounted, setIsMounted] = useState(false);

  // Track viewport size and set breakpoint
  useEffect(() => {
    setIsMounted(true);
    
    const updateBreakpoint = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setBreakpoint('mobile');
      } else if (width < 1024) {
        setBreakpoint('tablet');
      } else {
        setBreakpoint('desktop');
      }
    };

    // Set initial breakpoint
    updateBreakpoint();

    // Listen for viewport changes
    window.addEventListener('resize', updateBreakpoint);
    
    return () => window.removeEventListener('resize', updateBreakpoint);
  }, []);

  // Prevent hydration mismatch by not rendering until mounted
  if (!isMounted) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-accent-blue border-t-transparent rounded-full" />
      </div>
    );
  }

  // Calculate sidebar width based on collapsed state and breakpoint
  const getSidebarWidth = () => {
    if (breakpoint === 'mobile') {
      return sidebarCollapsed ? '0px' : '280px'; // Full width overlay on mobile
    }
    return sidebarCollapsed ? '48px' : '220px';
  };

  // Grid template areas for different layouts
  const getGridTemplate = () => {
    switch (breakpoint) {
      case 'mobile':
        if (sidebarCollapsed) {
          return {
            gridTemplateAreas: `
              "header"
              "main"
            `,
            gridTemplateColumns: '1fr',
            gridTemplateRows: '40px 1fr'
          };
        } else {
          // Mobile with sidebar open - overlay style
          return {
            gridTemplateAreas: `
              "header"
              "main"
            `,
            gridTemplateColumns: '1fr',
            gridTemplateRows: '40px 1fr'
          };
        }
      
      case 'tablet':
        return {
          gridTemplateAreas: `
            "header header"
            "sidebar main"
          `,
          gridTemplateColumns: `${getSidebarWidth()} 1fr`,
          gridTemplateRows: '40px 1fr'
        };
      
      case 'desktop':
      default:
        return {
          gridTemplateAreas: `
            "header header"
            "sidebar main"
          `,
          gridTemplateColumns: `${getSidebarWidth()} 1fr`,
          gridTemplateRows: '40px 1fr'
        };
    }
  };

  const gridStyle = getGridTemplate();

  return (
    <div
      className={cn(
        'responsive-grid',
        'relative min-h-screen',
        breakpoint === 'mobile' && 'touch-pan-y', // Enable touch scrolling on mobile
        loading && 'pointer-events-none',
        className
      )}
      style={{
        display: 'grid',
        ...gridStyle,
        transition: 'all 300ms ease-in-out',
      }}
      data-testid="responsive-grid"
      data-breakpoint={breakpoint}
      data-sidebar-collapsed={sidebarCollapsed}
    >
      {/* Mobile sidebar overlay */}
      {breakpoint === 'mobile' && !sidebarCollapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => {
            // Trigger sidebar collapse on overlay click
            const event = new CustomEvent('sidebar-toggle');
            window.dispatchEvent(event);
          }}
          data-testid="mobile-overlay"
        />
      )}

      {/* Grid children */}
      {children}

      {/* Responsive grid debug info (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed top-16 left-4 bg-bg-secondary/90 border border-border-primary rounded px-2 py-1 text-xs font-mono text-text-muted z-50">
          <div>Breakpoint: {breakpoint}</div>
          <div>Sidebar: {sidebarCollapsed ? 'collapsed' : 'expanded'}</div>
          <div>Width: {getSidebarWidth()}</div>
        </div>
      )}
    </div>
  );
}

ResponsiveGrid.displayName = 'ResponsiveGrid';

/**
 * Hook to get current breakpoint
 */
export function useBreakpoint() {
  const [breakpoint, setBreakpoint] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setBreakpoint('mobile');
      } else if (width < 1024) {
        setBreakpoint('tablet');
      } else {
        setBreakpoint('desktop');
      }
    };

    updateBreakpoint();
    window.addEventListener('resize', updateBreakpoint);
    
    return () => window.removeEventListener('resize', updateBreakpoint);
  }, []);

  return breakpoint;
}

/**
 * Hook to check if viewport is mobile
 */
export function useIsMobile() {
  const breakpoint = useBreakpoint();
  return breakpoint === 'mobile';
}

/**
 * Hook to check if viewport is tablet or smaller
 */
export function useIsTabletOrSmaller() {
  const breakpoint = useBreakpoint();
  return breakpoint === 'mobile' || breakpoint === 'tablet';
}