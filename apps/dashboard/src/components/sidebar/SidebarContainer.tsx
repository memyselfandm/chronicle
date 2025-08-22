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
  
  // Debug: sessions from store

  // Group sessions by git repo (if exists) or by folder
  const sessionsByProject = React.useMemo(() => {
    const filtered = getFilteredSessions();
    // Check if filtering is the issue
    if (filtered.length === 0 && sessions.length > 0) {
      // Sessions exist but filtered to 0. Using raw sessions instead.
    }
    
    // Use raw sessions if filtering returns empty
    const sessionsToUse = filtered.length > 0 ? filtered : sessions;
    const grouped = new Map<string, typeof sessionsToUse>();
    
    sessionsToUse.forEach(session => {
      // Group by git repo name if it exists, otherwise by folder name
      let groupKey: string;
      let groupName: string;
      
      if (session.gitRepoName) {
        // Git repo exists - group by repo name
        groupKey = `git:${session.gitRepoName}`;
        groupName = session.gitRepoName;
      } else {
        // No git - group by folder name
        const folderName = session.projectPath.split('/').pop() || 'Unknown';
        groupKey = `folder:${folderName}`;
        groupName = folderName;
      }
      
      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, []);
      }
      grouped.get(groupKey)!.push(session);
    });

    // Sort projects - those with awaiting sessions first
    return Array.from(grouped.entries())
      .map(([groupKey, sessions]) => {
        // Sort sessions within project - awaiting first, then by last activity
        const sortedSessions = [...sessions].sort((a, b) => {
          // Awaiting sessions first
          if (a.isAwaiting && !b.isAwaiting) return -1;
          if (!a.isAwaiting && b.isAwaiting) return 1;
          
          // Then by last activity time
          return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
        });

        const awaitingCount = sortedSessions.filter(session => session.isAwaiting === true).length;

        // Extract the group name from the key
        const [type, name] = groupKey.split(':');
        const isGitRepo = type === 'git';
        
        return {
          projectKey: groupKey,
          projectName: name, // Just the repo or folder name
          projectPath: sortedSessions[0]?.projectPath || '',
          gitBranch: isGitRepo ? sortedSessions[0]?.gitBranch : undefined,
          isGitRepo,
          sessions: sortedSessions,
          awaitingCount,
          totalCount: sortedSessions.length
        };
      })
      .sort((a, b) => {
        // Projects with awaiting sessions first
        if (a.awaitingCount > 0 && b.awaitingCount === 0) return -1;
        if (a.awaitingCount === 0 && b.awaitingCount > 0) return 1;
        // Then git repos before folders
        if (a.isGitRepo && !b.isGitRepo) return -1;
        if (!a.isGitRepo && b.isGitRepo) return 1;
        // Then by total session count
        return b.totalCount - a.totalCount;
      });
  }, [getFilteredSessions, sessions, events]);

  // Get sessions currently awaiting input for the priority section
  const awaitingSessions = React.useMemo(() => {
    const filtered = getFilteredSessions();
    // If filtering returns empty but we have sessions, use raw sessions
    const sessionsToCheck = filtered.length > 0 ? filtered : sessions;
    return sessionsToCheck.filter(session => session.isAwaiting === true);
  }, [getFilteredSessions, sessions]);

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
    <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col h-full">
      {/* Header with toggle */}
      <div className="flex items-center justify-between p-3 border-b border-gray-800">
        <h2 className="text-sm font-medium text-gray-300">Sessions</h2>
        <div className="flex items-center gap-2">
          {/* Clear Selection button */}
          <button 
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded transition-colors"
            onClick={() => {
              // Clear selection logic here
            }}
          >
            <span className="material-icons text-base">clear</span>
            <span>Clear Selection</span>
          </button>
          <SidebarToggle />
        </div>
      </div>

      {/* Search box */}
      <div className="p-3 border-b border-gray-800">
        <div className="relative">
          <span className="material-icons absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-base">
            search
          </span>
          <input
            type="text"
            placeholder="Search sessions..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-800 text-gray-300 placeholder-gray-500 rounded border border-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20"
          />
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto bg-gray-950">
        {/* Awaiting Input Section - Fixed at top */}
        {awaitingSessions.length > 0 && (
          <AwaitingInputSection 
            sessions={awaitingSessions}
            onClick={(session) => {
              // Handle session click
            }}
          />
        )}

        {/* Project Folders */}
        <div className="py-2">
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
      {/* Temporarily commented out per requirements
      <div className="border-t border-gray-700">
        <PresetFilters />
      </div>
      */}
    </div>
  );
}