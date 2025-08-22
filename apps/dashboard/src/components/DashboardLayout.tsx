/**
 * DashboardLayout - Main layout component with responsive grid system
 * 
 * Features:
 * - CSS Grid responsive layout system
 * - Collapsible sidebar (220px expanded, 48px collapsed)
 * - Fixed header (40px height)
 * - Flexible event feed area
 * - Mobile/tablet/desktop responsive design
 * - Component communication via Zustand store
 * - Layout persistence in localStorage
 */

'use client';

import React, { useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useEvents } from '@/hooks/useEvents';
import { useSessions } from '@/hooks/useSessions';
import { Header } from '@/components/layout/Header';
import { SidebarContainer } from '@/components/sidebar/SidebarContainer';
import { EventFeedV2 } from '@/components/eventfeed/EventFeedV2';
import { ResponsiveGrid } from './ResponsiveGrid';

export interface DashboardLayoutProps {
  /** Additional CSS classes */
  className?: string;
  /** Enable layout persistence */
  persistLayout?: boolean;
  /** Enable keyboard shortcuts */
  enableKeyboardShortcuts?: boolean;
  /** Children to render in main content area */
  children?: React.ReactNode;
}

/**
 * Main dashboard layout with responsive grid system
 */
export function DashboardLayout({
  className,
  persistLayout = true,
  enableKeyboardShortcuts = true,
  children
}: DashboardLayoutProps) {
  const {
    ui: { sidebarCollapsed, loading },
    setSidebarCollapsed,
    setSessions,
    setEvents
  } = useDashboardStore();

  // Connect to real Supabase data using working hooks
  const { 
    events, 
    loading: eventsLoading, 
    error: eventsError
  } = useEvents({ 
    limit: 100, 
    enableRealtime: true 
  });

  const { 
    sessions, 
    loading: sessionsLoading, 
    error: sessionsError 
  } = useSessions();

  // Update store when data changes
  useEffect(() => {
    if (sessions && sessions.length > 0) {
      // Convert sessions to store format
      const storeSessions = sessions.map(s => ({
        id: s.id,
        status: s.end_time ? 'completed' as const : 'active' as const,
        startTime: new Date(s.start_time),
        endTime: s.end_time ? new Date(s.end_time) : undefined,
        toolsUsed: 0, // Will be populated from events
        eventsCount: 0, // Will be populated from events
        lastActivity: new Date(s.start_time)
      }));
      setSessions(storeSessions);
      console.log('✅ Updated store with', storeSessions.length, 'sessions');
    }
  }, [sessions, setSessions]);

  useEffect(() => {
    if (events && events.length > 0) {
      // Convert events to store format
      const storeEvents = events.map(e => ({
        id: e.id,
        sessionId: e.session_id,
        type: e.event_type,
        timestamp: new Date(e.timestamp),
        metadata: e.metadata || {},
        status: 'active' as const // Default status
      }));
      setEvents(storeEvents);
      console.log('✅ Updated store with', storeEvents.length, 'events');
    }
  }, [events, setEvents]);

  // Debug: Log loading states
  useEffect(() => {
    console.log('Loading states:', { eventsLoading, sessionsLoading });
  }, [eventsLoading, sessionsLoading]);


  // Handle sidebar toggle keyboard shortcut (Cmd+B)
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enableKeyboardShortcuts) return;

    // Cmd+B or Ctrl+B to toggle sidebar
    if ((event.metaKey || event.ctrlKey) && event.key === 'b') {
      event.preventDefault();
      setSidebarCollapsed(!sidebarCollapsed);
    }
  }, [sidebarCollapsed, setSidebarCollapsed, enableKeyboardShortcuts]);

  // Set up keyboard shortcuts
  useEffect(() => {
    if (enableKeyboardShortcuts) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown, enableKeyboardShortcuts]);

  // Persist sidebar state in localStorage
  useEffect(() => {
    if (persistLayout) {
      localStorage.setItem('chronicle-sidebar-collapsed', JSON.stringify(sidebarCollapsed));
    }
  }, [sidebarCollapsed, persistLayout]);

  // Restore sidebar state from localStorage on mount
  useEffect(() => {
    if (persistLayout) {
      const saved = localStorage.getItem('chronicle-sidebar-collapsed');
      if (saved !== null) {
        try {
          const collapsed = JSON.parse(saved);
          if (typeof collapsed === 'boolean') {
            setSidebarCollapsed(collapsed);
          }
        } catch (e) {
          console.warn('Failed to restore sidebar state:', e);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount - persistLayout and setSidebarCollapsed don't need to be deps

  return (
    <div 
      className={cn(
        'min-h-screen bg-bg-primary text-text-primary',
        'dashboard-layout',
        className
      )}
      data-testid="dashboard-layout"
    >
      {/* Error boundary for layout-level errors */}
      {(eventsError || sessionsError) && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 m-4 rounded">
          <div className="flex items-center gap-2">
            <span className="material-icons text-sm">error</span>
            <span className="text-sm font-medium">Data Loading Error</span>
          </div>
          <p className="text-sm mt-1 text-red-300">
            {eventsError?.message || sessionsError?.message || 'Failed to load dashboard data'}
          </p>
        </div>
      )}

      {/* Responsive Grid Layout */}
      <ResponsiveGrid
        sidebarCollapsed={sidebarCollapsed}
        className="min-h-screen"
        loading={loading}
      >
        {/* Header - Fixed at top */}
        <div
          className="header-area"
          style={{ gridArea: 'header' }}
        >
          <Header />
        </div>

        {/* Sidebar - Collapsible */}
        <div
          className={cn(
            'sidebar-area border-r border-border-primary',
            'transition-all duration-300 ease-in-out',
            sidebarCollapsed ? 'w-12' : 'w-64'
          )}
          style={{ gridArea: 'sidebar' }}
        >
          <SidebarContainer />
        </div>

        {/* Main Content Area - Event Feed or Custom Children */}
        <div
          className="main-area flex flex-col overflow-hidden"
          style={{ gridArea: 'main' }}
        >
          {children ? (
            children
          ) : (
            <div className="flex-1 overflow-hidden">
              <EventFeedV2
                sessions={sessions}
                initialEvents={events}
                height={undefined} // Let it fill the container
                className="h-full"
                enableBatching={true}
                maxEvents={1000}
                defaultAutoScroll={true}
              />
            </div>
          )}
        </div>
      </ResponsiveGrid>

      {/* Loading overlay */}
      {(eventsLoading || sessionsLoading) && (
        <div className="fixed inset-0 bg-bg-primary/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex items-center gap-3 bg-bg-secondary border border-border-primary rounded-lg px-6 py-4">
            <div className="animate-spin h-5 w-5 border-2 border-accent-blue border-t-transparent rounded-full" />
            <span className="text-text-secondary">Loading dashboard...</span>
          </div>
        </div>
      )}

      {/* Keyboard shortcuts help overlay (development only) */}
      {process.env.NODE_ENV === 'development' && enableKeyboardShortcuts && (
        <div className="fixed bottom-4 right-4 bg-bg-secondary/90 border border-border-primary rounded-lg p-3 text-xs text-text-muted max-w-xs z-40">
          <div className="font-medium text-text-secondary mb-2">Keyboard Shortcuts</div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <kbd className="px-1 bg-bg-primary rounded">⌘+B</kbd>
              <span>Toggle sidebar</span>
            </div>
            <div className="flex justify-between">
              <kbd className="px-1 bg-bg-primary rounded">j/k</kbd>
              <span>Navigate events</span>
            </div>
            <div className="flex justify-between">
              <kbd className="px-1 bg-bg-primary rounded">1/2/3</kbd>
              <span>Filter toggles</span>
            </div>
            <div className="flex justify-between">
              <kbd className="px-1 bg-bg-primary rounded">/</kbd>
              <span>Focus search</span>
            </div>
            <div className="flex justify-between">
              <kbd className="px-1 bg-bg-primary rounded">Esc</kbd>
              <span>Clear filters</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

DashboardLayout.displayName = 'DashboardLayout';