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
  
  console.log('📊 SidebarContainer - sessions from store:', sessions?.length, sessions);

  // Group sessions by project path and branch
  const sessionsByProject = React.useMemo(() => {
    const filtered = getFilteredSessions();
    console.log('🔍 SidebarContainer - filtered sessions:', filtered.length, filtered);
    const grouped = new Map<string, typeof filtered>();
    
    filtered.forEach(session => {
      // Use project path and git branch as the grouping key
      const projectPath = session.projectPath || 'Unknown';
      const gitBranch = session.gitBranch || 'main';
      const projectKey = `${projectPath}:${gitBranch}`;
      
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
          // Awaiting sessions first
          if (a.isAwaiting && !b.isAwaiting) return -1;
          if (!a.isAwaiting && b.isAwaiting) return 1;
          
          // Then by last activity time
          return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
        });

        const awaitingCount = sortedSessions.filter(session => session.isAwaiting === true).length;

        // Extract folder name and branch from the key
        const [projectPath, gitBranch] = projectKey.split(':');
        const folderName = projectPath.split('/').pop() || projectPath;
        
        return {
          projectKey,
          projectName: `${folderName} / ${gitBranch}`,
          projectPath,
          gitBranch,
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
    return getFilteredSessions().filter(session => session.isAwaiting === true);
  }, [getFilteredSessions]);

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