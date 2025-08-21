'use client';

import React, { useState, useEffect } from 'react';
import { SessionData } from '@/stores/dashboardStore';
import { SessionItem } from './SessionItem';

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
    <div className="group">
      {/* Project header */}
      <div 
        className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-800 cursor-pointer transition-colors"
        onClick={handleToggle}
      >
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          {/* Expand/collapse chevron */}
          <svg
            className={`w-3 h-3 text-gray-400 transition-transform ${
              isExpanded ? 'rotate-90' : 'rotate-0'
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>

          {/* Project icon */}
          <div className="text-gray-400 flex-shrink-0">
            {getProjectIcon()}
          </div>

          {/* Project name */}
          <span className="text-sm text-gray-300 truncate" title={projectName}>
            {projectName}
          </span>
        </div>

        {/* Session count badge */}
        <div className="flex items-center space-x-1 flex-shrink-0">
          <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
            {totalCount}
            {awaitingCount > 0 && (
              <span className="text-yellow-400"> ({awaitingCount} awaiting)</span>
            )}
          </span>
          
          {/* Awaiting indicator dot */}
          {awaitingCount > 0 && (
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
          )}
        </div>
      </div>

      {/* Sessions list */}
      {isExpanded && sessions.length > 0 && (
        <div className="ml-4 pl-2 border-l border-gray-700 space-y-1">
          {sessions.map((session) => {
            // Check if this session is awaiting input
            const isAwaiting = false; // Will be calculated properly when we have events
            
            return (
              <SessionItem
                key={session.id}
                session={session}
                isAwaiting={isAwaiting}
                compact={false}
              />
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {isExpanded && sessions.length === 0 && (
        <div className="ml-6 p-2 text-xs text-gray-500">
          No sessions in this project
        </div>
      )}
    </div>
  );
}