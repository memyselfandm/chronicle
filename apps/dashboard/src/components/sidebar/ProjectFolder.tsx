'use client';

import React, { useState, useEffect } from 'react';
import { SessionData } from '@/stores/dashboardStore';
import { CompactSessionItem } from './SessionItem';

interface ProjectFolderProps {
  projectKey: string;
  projectName: string;
  sessions: SessionData[];
  awaitingCount: number;
  totalCount: number;
}

/**
 * Collapsible project folder containing grouped sessions
 * Stores expand/collapse state in localStorage
 */
export function ProjectFolder({ 
  projectKey, 
  projectName, 
  sessions, 
  awaitingCount, 
  totalCount 
}: ProjectFolderProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Load expand/collapse state from localStorage
  useEffect(() => {
    const storageKey = `sidebar-project-${projectKey}`;
    const saved = localStorage.getItem(storageKey);
    if (saved !== null) {
      setIsExpanded(saved === 'true');
    }
  }, [projectKey]);

  // Save expand/collapse state to localStorage
  const handleToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    localStorage.setItem(`sidebar-project-${projectKey}`, String(newExpanded));
  };

  // Get project icon based on folder name or use default
  const getProjectIcon = () => {
    // Material icon for folder
    return (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
        />
      </svg>
    );
  };

  return (
    <div className="mb-1">
      {/* Project header */}
      <div 
        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-800 cursor-pointer transition-colors group"
        onClick={handleToggle}
      >
        {/* Expand/collapse chevron */}
        <span className={`material-icons text-gray-500 text-sm transition-transform ${
          isExpanded ? 'rotate-90' : ''
        }`}>
          keyboard_arrow_right
        </span>

        {/* Project icon */}
        <span className="material-icons text-gray-500 text-sm">
          folder
        </span>

        {/* Project name */}
        <span className="text-[13px] font-medium text-gray-400 flex-1 truncate" title={projectName}>
          {projectName}
        </span>

        {/* Session count badge */}
        <span className="text-[11px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded-full font-medium">
          {totalCount}
        </span>
      </div>

      {/* Sessions list */}
      {isExpanded && sessions.length > 0 && (
        <div className="transition-all duration-200">
          {sessions.map((session) => (
            <CompactSessionItem
              key={session.id}
              session={session}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {isExpanded && sessions.length === 0 && (
        <div className="pl-12 py-2 text-xs text-gray-500">
          No sessions in this project
        </div>
      )}
    </div>
  );
}