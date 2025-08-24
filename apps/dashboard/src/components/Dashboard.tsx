/**
 * Dashboard - Main layout component with responsive grid system
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
import { EventFeed } from '@/components/eventfeed/EventFeed';
import { AutoSizeWrapper } from '@/components/eventfeed/AutoSizeWrapper';
import { ResponsiveGrid } from './ResponsiveGrid';

export interface DashboardProps {
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
export function Dashboard({
  className,
  persistLayout = true,
  enableKeyboardShortcuts = true,
  children
}: DashboardProps) {
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

  // Update store when data changes from Supabase
  useEffect(() => {
    if (sessions && sessions.length > 0) {
      // Helper to extract git repo name from project path
      const extractGitRepoName = (projectPath: string): string | undefined => {
        // Look for common repo patterns in the path
        const parts = projectPath.split('/').filter(Boolean);
        
        // Check for known patterns where the git repo is likely located
        // For chronicle project, look for "chronicle" in the path
        const chronicleIndex = parts.findIndex(p => p === 'chronicle' || p.startsWith('chr-'));
        if (chronicleIndex !== -1) {
          return parts[chronicleIndex];
        }
        
        // Check for ai-workspace pattern (common dev folder structure)
        const aiWorkspaceIndex = parts.findIndex(p => p === 'ai-workspace');
        if (aiWorkspaceIndex !== -1 && aiWorkspaceIndex < parts.length - 1) {
          // Return the folder after ai-workspace
          return parts[aiWorkspaceIndex + 1];
        }
        
        // Check for common code/projects folder patterns
        const codeIndex = parts.findIndex(p => ['code', 'projects', 'repos', 'dev', 'src'].includes(p.toLowerCase()));
        if (codeIndex !== -1 && codeIndex < parts.length - 1) {
          // Return the folder after the code folder
          return parts[codeIndex + 1];
        }
        
        // Fallback: if path contains more than 3 parts from home, 
        // assume the repo is 2-3 levels deep from home
        if (parts.length > 3 && parts[0] === 'Users') {
          // Skip Users/username and take the next meaningful folder
          // that's not a common subfolder name
          const commonSubfolders = ['Documents', 'Desktop', 'Downloads', 'workspace', 'dev', 'code'];
          for (let i = 2; i < Math.min(parts.length - 1, 4); i++) {
            if (!commonSubfolders.includes(parts[i])) {
              return parts[i];
            }
          }
        }
        
        // Last resort: return the last part that isn't a common subfolder
        const ignoreFolders = ['src', 'apps', 'packages', 'lib', 'components', 'pages', 'dashboard'];
        for (let i = parts.length - 1; i >= 0; i--) {
          if (!ignoreFolders.includes(parts[i])) {
            return parts[i];
          }
        }
        
        // Ultimate fallback
        return parts[parts.length - 1];
      };

      // Helper to compute display titles with clash detection
      const computeDisplayTitles = (sessions: SessionData[]) => {
        const titleCounts = new Map<string, number>();
        const sessionTitles = new Map<string, { title: string; subtitle: string }>();

        // First pass: count how many times each title appears
        sessions.forEach(s => {
          let baseTitle: string;
          
          // If git branch exists, use it as title; otherwise use folder name
          if (s.git_branch && s.git_branch !== 'no git') {
            baseTitle = s.git_branch;
          } else {
            const folderName = extractGitRepoName(s.project_path || '') || 'Unknown';
            baseTitle = folderName;
          }

          const count = titleCounts.get(baseTitle) || 0;
          titleCounts.set(baseTitle, count + 1);
        });

        // Second pass: add suffixes for clashes
        const titleUsage = new Map<string, number>();
        
        sessions.forEach(s => {
          let baseTitle: string;
          
          if (s.git_branch && s.git_branch !== 'no git') {
            baseTitle = s.git_branch;
          } else {
            const folderName = extractGitRepoName(s.project_path || '') || 'Unknown';
            baseTitle = folderName;
          }

          let displayTitle = baseTitle;
          
          // If there are multiple sessions with the same title, add suffix
          if ((titleCounts.get(baseTitle) || 0) > 1) {
            const usageCount = titleUsage.get(baseTitle) || 0;
            if (usageCount > 0) {
              // Add last 4 chars of session ID as suffix
              const suffix = s.id.slice(-4);
              displayTitle = `${baseTitle}-${suffix}`;
            }
            titleUsage.set(baseTitle, usageCount + 1);
          }

          sessionTitles.set(s.id, {
            title: displayTitle,
            subtitle: displayTitle // Duplicate for now as requested
          });
        });

        return sessionTitles;
      };

      const displayTitles = computeDisplayTitles(sessions);

      // Convert sessions to store format with enhanced fields
      const storeSessions = sessions.map(s => {
        // Determine status based on last event time and type
        let status: 'active' | 'idle' | 'completed' | 'error' = 'active';
        
        if (s.end_time) {
          status = 'completed';
        } else if (s.is_awaiting) {
          // Keep awaiting status separate - don't mark as idle
          status = 'active'; // Awaiting sessions are still active, just waiting for input
        } else if (s.minutes_since_last_event && s.minutes_since_last_event > 30) {
          status = 'idle'; // Only mark idle after 30 minutes of inactivity
        }
        

        const titles = displayTitles.get(s.id) || { title: 'Unknown', subtitle: 'Unknown' };
        const gitRepoName = s.git_branch && s.git_branch !== 'no git' 
          ? extractGitRepoName(s.project_path || '')
          : undefined;
        
        return {
          id: s.id,
          status,
          projectPath: s.project_path || 'Unknown Project',
          gitBranch: s.git_branch || 'main',
          gitRepoName,
          displayTitle: titles.title,
          displaySubtitle: titles.subtitle,
          startTime: new Date(s.start_time),
          endTime: s.end_time ? new Date(s.end_time) : undefined,
          lastActivity: s.last_event_time ? new Date(s.last_event_time) : new Date(s.start_time),
          minutesSinceLastEvent: s.minutes_since_last_event || 0,
          // Use actual awaiting status from the session data
          isAwaiting: s.is_awaiting || false,
          lastEventType: s.last_event_type || null,
          toolsUsed: 0, // Will be populated from events
          eventsCount: 0, // Will be populated from events
        };
      });
      setSessions(storeSessions);
      console.log('✅ Updated store with', storeSessions.length, 'sessions');
    }
  }, [sessions, setSessions]);

  useEffect(() => {
    if (events) {
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
    } else {
      console.log('⚠️ No events received from useEvents hook');
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
            <div className="flex-1 overflow-hidden h-full">
              <AutoSizeWrapper className="w-full h-full">
                {({ width, height }) => (
                  <EventFeed
                    sessions={sessions}
                    initialEvents={events || []}
                    height={height}
                    width={width}
                    className="w-full h-full"
                    enableBatching={true}
                    maxEvents={1000}
                    defaultAutoScroll={true}
                  />
                )}
              </AutoSizeWrapper>
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

Dashboard.displayName = 'Dashboard';