/**
 * SubAgentRow - Specialized row component for sub-agent events
 * 
 * Features:
 * - 20px left indentation for hierarchy
 * - Visual connection lines to parent
 * - Specialized sub-agent event handling
 * - Collapsible sub-agent groups
 * - Performance optimized with React.memo
 */

'use client';

import React, { memo } from 'react';
import { Event, Session } from '@/types/events';
import { EventRow } from './EventRow';
import { cn } from '@/lib/utils';

export interface SubAgentRowProps {
  /** Sub-agent event to display */
  event: Event;
  /** Session context */
  session?: Session;
  /** Row index */
  index: number;
  /** Nesting level (0 = main agent, 1 = first sub-agent, etc.) */
  level: number;
  /** Whether this is the last event in the sub-agent group */
  isLastInGroup?: boolean;
  /** Whether this is the first event in the sub-agent group */
  isFirstInGroup?: boolean;
  /** Parent event that spawned this sub-agent */
  parentEvent?: Event;
  /** Whether the sub-agent group is collapsed */
  collapsed?: boolean;
  /** Callback when collapse state changes */
  onToggleCollapse?: (parentEventId: string, collapsed: boolean) => void;
}

/**
 * Get indentation for nesting level
 */
const getIndentationClass = (level: number) => {
  // 20px per level as specified in PRD
  const indentPx = level * 20;
  return `pl-[${indentPx + 12}px]`; // Base 12px + level indentation
};

/**
 * Get connection line styling for hierarchy visualization
 */
const getConnectionLineClass = (level: number, isFirstInGroup: boolean, isLastInGroup: boolean) => {
  if (level === 0) return '';
  
  const baseClasses = 'relative before:absolute before:border-l before:border-border-primary';
  
  if (isFirstInGroup && isLastInGroup) {
    // Single event - just a corner
    return `${baseClasses} before:left-[${(level - 1) * 20 + 6}px] before:top-0 before:h-3 before:border-b before:w-3`;
  } else if (isFirstInGroup) {
    // First in group - corner with line down
    return `${baseClasses} before:left-[${(level - 1) * 20 + 6}px] before:top-0 before:h-full before:border-b before:w-3`;
  } else if (isLastInGroup) {
    // Last in group - line up with corner
    return `${baseClasses} before:left-[${(level - 1) * 20 + 6}px] before:top-0 before:h-3 before:border-b before:w-3`;
  } else {
    // Middle event - vertical line
    return `${baseClasses} before:left-[${(level - 1) * 20 + 6}px] before:top-0 before:h-full`;
  }
};

/**
 * Collapse/expand toggle for sub-agent groups
 */
const CollapseToggle = memo<{
  collapsed: boolean;
  onClick: () => void;
  eventCount: number;
}>(({ collapsed, onClick, eventCount }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'inline-flex items-center gap-1 px-1 py-0.5 rounded text-xs',
      'text-text-muted hover:text-text-secondary',
      'hover:bg-bg-tertiary transition-colors',
      'focus:outline-none focus:ring-1 focus:ring-accent-blue'
    )}
    aria-label={collapsed ? `Expand ${eventCount} sub-agent events` : 'Collapse sub-agent events'}
  >
    <span className="material-icons text-sm">
      {collapsed ? 'expand_more' : 'expand_less'}
    </span>
    {collapsed && (
      <span className="font-mono">
        {eventCount} event{eventCount !== 1 ? 's' : ''}
      </span>
    )}
  </button>
));

CollapseToggle.displayName = 'CollapseToggle';

/**
 * Sub-agent header row showing the Task tool that spawned the sub-agent
 */
const SubAgentHeader = memo<{
  parentEvent: Event;
  session?: Session;
  index: number;
  level: number;
  collapsed: boolean;
  eventCount: number;
  onToggleCollapse: () => void;
}>(({ parentEvent, session, index, level, collapsed, eventCount, onToggleCollapse }) => (
  <div
    className={cn(
      'grid grid-cols-[85px_140px_110px_90px_1fr] gap-3 items-center h-6',
      'text-xs font-mono py-2 pr-3',
      getIndentationClass(level),
      getConnectionLineClass(level, true, collapsed),
      'bg-bg-secondary/30 border-l-4 border-l-accent-blue/50',
      'hover:bg-bg-tertiary/30 transition-colors'
    )}
    data-testid="subagent-header"
  >
    {/* Time */}
    <div className="text-text-muted font-mono text-xs">
      {new Date(parentEvent.timestamp).toLocaleTimeString('en-US', { hour12: false })}
    </div>

    {/* Session */}
    <div className="text-text-secondary font-medium truncate">
      {session ? `${session.project_path?.split('/').pop()}/${session.git_branch}` : 'Unknown'}
    </div>

    {/* Type with collapse toggle */}
    <div className="flex items-center gap-1.5">
      <span className="material-icons text-sm text-accent-blue">
        assignment
      </span>
      <span className="px-2 py-1 rounded-md text-xs font-medium bg-accent-blue/10 text-accent-blue">
        Sub-agent
      </span>
    </div>

    {/* Tool */}
    <div className="flex items-center gap-1.5">
      <span className="material-icons text-sm text-text-muted">
        assignment
      </span>
      <span className="text-text-primary font-medium">
        Task
      </span>
    </div>

    {/* Details with collapse toggle */}
    <div className="flex items-center justify-between">
      <span className="text-text-secondary truncate">
        {parentEvent.metadata?.tool_input?.task_description || 'Sub-agent task'}
      </span>
      <CollapseToggle
        collapsed={collapsed}
        onClick={onToggleCollapse}
        eventCount={eventCount}
      />
    </div>
  </div>
));

SubAgentHeader.displayName = 'SubAgentHeader';

/**
 * Sub-agent row component with hierarchical indentation and connection lines
 */
export const SubAgentRow = memo<SubAgentRowProps>(({
  event,
  session,
  index,
  level,
  isLastInGroup = false,
  isFirstInGroup = false,
  parentEvent,
  collapsed = false,
  onToggleCollapse
}) => {
  // Handle collapse toggle
  const handleToggleCollapse = () => {
    if (parentEvent && onToggleCollapse) {
      onToggleCollapse(parentEvent.id, !collapsed);
    }
  };

  // If this is a Task tool event (sub-agent spawner), show the header
  if (event.tool_name === 'Task' && event.event_type === 'pre_tool_use') {
    return (
      <SubAgentHeader
        parentEvent={event}
        session={session}
        index={index}
        level={level}
        collapsed={collapsed}
        eventCount={1} // This would be calculated by parent component
        onToggleCollapse={handleToggleCollapse}
      />
    );
  }

  // Don't render if parent group is collapsed
  if (collapsed && level > 0) {
    return null;
  }

  return (
    <div
      className={cn(
        getConnectionLineClass(level, isFirstInGroup, isLastInGroup),
        'relative'
      )}
      data-testid="subagent-row"
      data-level={level}
    >
      <EventRow
        event={{
          ...event,
          // Mark as sub-agent for styling
          metadata: {
            ...event.metadata,
            is_subagent: true,
            nesting_level: level
          }
        }}
        session={session}
        index={index}
      />
    </div>
  );
});

SubAgentRow.displayName = 'memo(SubAgentRow)';