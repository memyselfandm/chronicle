'use client';

import React from 'react';
import { SessionData } from '@/stores/dashboardStore';
import { SessionItem } from './SessionItem';

interface AwaitingInputSectionProps {
  sessions: SessionData[];
}

/**
 * Priority section showing sessions that require user input
 * Fixed at top of sidebar with yellow accent and dynamic height
 */
export function AwaitingInputSection({ sessions }: AwaitingInputSectionProps) {
  if (sessions.length === 0) return null;

  return (
    <div className="bg-yellow-900/20 border-b border-yellow-700/50">
      {/* Section header */}
      <div className="flex items-center justify-between p-3 border-b border-yellow-700/30">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
          <h3 className="text-sm font-medium text-yellow-200">
            Awaiting Input
          </h3>
          <span className="text-xs bg-yellow-700/50 text-yellow-200 px-2 py-0.5 rounded-full">
            {sessions.length}
          </span>
        </div>
        
        {/* Warning icon */}
        <svg
          className="w-4 h-4 text-yellow-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
      </div>

      {/* Sessions list with max height and scroll */}
      <div 
        className="max-h-[40vh] overflow-y-auto"
        style={{ 
          scrollbarWidth: 'thin',
          scrollbarColor: '#f59e0b #1f2937'
        }}
      >
        <div className="p-2 space-y-1">
          {sessions.map((session) => (
            <SessionItem
              key={session.id}
              session={session}
              isAwaiting={true}
              compact={true}
            />
          ))}
        </div>
      </div>

      {/* Scroll indicator if there are many sessions */}
      {sessions.length > 5 && (
        <div className="text-center py-1 border-t border-yellow-700/30">
          <span className="text-xs text-yellow-300/70">
            Scroll for more
          </span>
        </div>
      )}
    </div>
  );
}