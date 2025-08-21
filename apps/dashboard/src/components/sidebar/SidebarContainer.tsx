'use client';

import React, { useEffect, useCallback } from 'react';
import { useDashboardStore } from '@/stores/dashboardStore';
import { AwaitingInputSection } from './AwaitingInputSection';
import { ProjectFolder } from './ProjectFolder';
import { PresetFilters } from './PresetFilters';
import { SidebarToggle } from './SidebarToggle';

/**
 * Main sidebar container that provides project-based session navigation
 * and filtering capabilities for the Chronicle dashboard.
 * 
 * Features:
 * - Project-based grouping of sessions using project_path
 * - Dynamic ordering with awaiting sessions bubbling to top
 * - Collapsible state with localStorage persistence
 * - Real-time updates for session status changes
 * - Keyboard shortcuts for navigation
 */
export function SidebarContainer() {
  const {
    ui: { sidebarCollapsed },
    setSidebarCollapsed,
    sessions,
    events,
    getFilteredSessions,
  } = useDashboardStore();

  // Group sessions by project path
  const sessionsByProject = React.useMemo(() => {
    const filtered = getFilteredSessions();
    const grouped = new Map<string, typeof filtered>();
    
    filtered.forEach(session => {
      const projectKey = session.id; // Using session ID for now, will need to update when we have project_path
      const projectName = `Project ${session.id.slice(0, 8)}`; // Placeholder until we have real project data
      
      if (!grouped.has(projectKey)) {
        grouped.set(projectKey, []);
      }
      grouped.get(projectKey)!.push(session);
    });

    // Sort projects - those with awaiting sessions first
    return Array.from(grouped.entries())
      .map(([projectKey, sessions]) => {
        // Sort sessions within project - awaiting first, then by last activity
        const sortedSessions = [...sessions].sort((a, b) => {
          // Get last event for each session to determine if awaiting
          const aLastEvent = events
            .filter(e => e.sessionId === a.id)
            .sort((x, y) => new Date(y.timestamp).getTime() - new Date(x.timestamp).getTime())[0];
          const bLastEvent = events
            .filter(e => e.sessionId === b.id)
            .sort((x, y) => new Date(y.timestamp).getTime() - new Date(x.timestamp).getTime())[0];
          
          const aAwaiting = aLastEvent?.type === 'notification' && 
            aLastEvent?.metadata?.requires_response === true;
          const bAwaiting = bLastEvent?.type === 'notification' && 
            bLastEvent?.metadata?.requires_response === true;
          
          if (aAwaiting && !bAwaiting) return -1;
          if (!aAwaiting && bAwaiting) return 1;
          
          // Then by last activity time
          return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
        });

        const awaitingCount = sortedSessions.filter(session => {
          const lastEvent = events
            .filter(e => e.sessionId === session.id)
            .sort((x, y) => new Date(y.timestamp).getTime() - new Date(x.timestamp).getTime())[0];
          return lastEvent?.type === 'notification' && 
            lastEvent?.metadata?.requires_response === true;
        }).length;

        return {
          projectKey,
          projectName: `Project ${projectKey.slice(0, 8)}`,
          sessions: sortedSessions,
          awaitingCount,
          totalCount: sortedSessions.length
        };
      })
      .sort((a, b) => {
        // Projects with awaiting sessions first
        if (a.awaitingCount > 0 && b.awaitingCount === 0) return -1;
        if (a.awaitingCount === 0 && b.awaitingCount > 0) return 1;
        // Then by total session count
        return b.totalCount - a.totalCount;
      });
  }, [getFilteredSessions, events]);

  // Get sessions currently awaiting input for the priority section
  const awaitingSessions = React.useMemo(() => {
    return getFilteredSessions().filter(session => {
      const lastEvent = events
        .filter(e => e.sessionId === session.id)
        .sort((x, y) => new Date(y.timestamp).getTime() - new Date(x.timestamp).getTime())[0];
      return lastEvent?.type === 'notification' && 
        lastEvent?.metadata?.requires_response === true;
    });
  }, [getFilteredSessions, events]);

  // Keyboard shortcut for Cmd+B to toggle sidebar
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'b') {
      event.preventDefault();
      setSidebarCollapsed(!sidebarCollapsed);
    }
  }, [sidebarCollapsed, setSidebarCollapsed]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (sidebarCollapsed) {
    return (
      <div className="w-12 bg-gray-900 border-r border-gray-700 flex flex-col">
        <SidebarToggle />
      </div>
    );
  }

  return (
    <div className="w-64 bg-gray-900 border-r border-gray-700 flex flex-col h-full">
      {/* Header with toggle */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <h2 className="text-sm font-medium text-gray-200">Sessions</h2>
        <SidebarToggle />
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto">
        {/* Awaiting Input Section - Fixed at top */}
        {awaitingSessions.length > 0 && (
          <AwaitingInputSection sessions={awaitingSessions} />
        )}

        {/* Project Folders */}
        <div className="p-2 space-y-1">
          {sessionsByProject.map(({ projectKey, projectName, sessions, awaitingCount, totalCount }) => (
            <ProjectFolder
              key={projectKey}
              projectKey={projectKey}
              projectName={projectName}
              sessions={sessions}
              awaitingCount={awaitingCount}
              totalCount={totalCount}
            />
          ))}
          
          {sessionsByProject.length === 0 && (
            <div className="p-4 text-center text-gray-500 text-sm">
              No sessions found
            </div>
          )}
        </div>
      </div>

      {/* Preset Filters - Fixed at bottom */}
      <div className="border-t border-gray-700">
        <PresetFilters />
      </div>
    </div>
  );
}