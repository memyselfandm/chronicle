'use client';

import React from 'react';
import { SessionData } from '@/stores/dashboardStore';
import { CompactSessionItem } from './SessionItem';

interface AwaitingInputSectionProps {
  sessions: SessionData[];
  onClick?: (session: SessionData) => void;
}

/**
 * Priority section showing sessions that require user input
 * Fixed at top of sidebar with yellow accent and dynamic height
 */
export function AwaitingInputSection({ sessions, onClick }: AwaitingInputSectionProps) {
  if (sessions.length === 0) return null;

  return (
    <div className="border-b border-gray-800 mb-2">
      {/* Section header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10">
        <span className="material-icons text-yellow-500 text-sm">
          pending
        </span>
        <span className="text-[13px] font-medium text-gray-300 flex-1">
          Awaiting Input
        </span>
        <span className="text-[11px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full font-medium">
          {sessions.length}
        </span>
      </div>

      {/* Sessions list */}
      <div className="bg-gray-900/50">
        {sessions.map((session) => (
          <CompactSessionItem
            key={session.id}
            session={session}
            onClick={onClick}
            className="border-l-yellow-500"
          />
        ))}
      </div>
    </div>
  );
}