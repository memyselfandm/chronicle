/**
 * EventRowV2 - Dense 24px row component with semantic color coding
 * 
 * Features:
 * - Exactly 24px height for maximum density
 * - Semantic color coding per variant_3 design
 * - Fixed column layout (Time 85px, Session 140px, Type 110px, Tool 90px, Details flex)
 * - Sub-agent indentation (20px left padding)
 * - React.memo optimization
 * - Material icons throughout
 */

'use client';

import React, { memo } from 'react';
import { Event, Session } from '@/types/events';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';

export interface EventRowV2Props {
  /** Event data to display */
  event: Event;
  /** Session context for display */
  session?: Session;
  /** Row index for styling */
  index: number;
}

/**
 * Get semantic color classes for event type matching I4V2-V3 reference design
 */
const getEventColorClasses = (eventType: string) => {
  switch (eventType) {
    case 'user_prompt_submit':
      return {
        border: 'border-l-[#8b5cf6]',
        background: 'rgba(139, 92, 246, 0.08)' // Purple for user prompts
      };
    case 'pre_tool_use':
      return {
        border: 'border-l-[#3b82f6]',
        background: 'rgba(59, 130, 246, 0.08)' // Blue for tool use
      };
    case 'post_tool_use':
      return {
        border: 'border-l-[#4ade80]',
        background: 'rgba(74, 222, 128, 0.08)' // Green for completions
      };
    case 'notification':
      return {
        border: 'border-l-[#fbbf24]',
        background: 'rgba(251, 191, 36, 0.08)' // Yellow for notifications/awaiting
      };
    case 'error':
      return {
        border: 'border-l-[#ef4444]',
        background: 'rgba(239, 68, 68, 0.08)' // Red for errors only
      };
    case 'stop':
    case 'subagent_stop':
    case 'session_start':
    case 'pre_compact':
    default:
      return {
        border: 'border-l-[#6b7280]',
        background: 'rgba(107, 114, 128, 0.08)' // Gray for system events
      };
  }
};

/**
 * Get Material icon for event type
 */
const getEventIcon = (eventType: string, toolName?: string) => {
  switch (eventType) {
    case 'user_prompt_submit':
      return 'chat';
    case 'pre_tool_use':
      return getToolIcon(toolName, 'play_arrow');
    case 'post_tool_use':
      return getToolIcon(toolName, 'check_circle');
    case 'notification':
      return 'notifications';
    case 'error':
      return 'error';
    case 'stop':
      return 'stop';
    case 'subagent_stop':
      return 'stop_circle';
    case 'session_start':
      return 'play_circle';
    case 'pre_compact':
      return 'compress';
    default:
      return 'radio_button_unchecked';
  }
};

/**
 * Get Material icon for tool
 */
const getToolIcon = (toolName?: string, defaultIcon = 'build') => {
  if (!toolName) return defaultIcon;
  
  switch (toolName.toLowerCase()) {
    case 'read':
      return 'description';
    case 'write':
    case 'edit':
    case 'multiedit':
      return 'edit';
    case 'bash':
      return 'terminal';
    case 'glob':
    case 'grep':
      return 'search';
    case 'ls':
      return 'folder';
    case 'task':
      return 'assignment';
    case 'webfetch':
    case 'websearch':
      return 'public';
    case 'notebookread':
    case 'notebookedit':
      return 'book';
    case 'todoread':
    case 'todowrite':
      return 'checklist';
    default:
      return defaultIcon;
  }
};

/**
 * Format session display as folder/branch
 */
const formatSessionDisplay = (session?: Session) => {
  if (!session) return 'Unknown session';
  
  const folder = session.project_path 
    ? session.project_path.split('/').pop() || 'unknown'
    : 'unknown';
  const branch = session.git_branch || 'unknown';
  
  return `${folder}/${branch}`;
};

/**
 * Format timestamp as HH:mm:ss
 */
const formatTime = (timestamp: string) => {
  try {
    const date = new Date(timestamp);
    // Use UTC to ensure consistent formatting in tests
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    const seconds = date.getUTCSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  } catch {
    return '--:--:--';
  }
};

/**
 * Format duration in milliseconds
 */
const formatDuration = (durationMs?: number) => {
  if (!durationMs) return '';
  
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }
  
  return `${(durationMs / 1000).toFixed(2)}s`;
};

/**
 * Check if event is from sub-agent
 */
const isSubAgentEvent = (event: Event) => {
  return event.tool_name === 'Task' || 
         event.metadata?.is_subagent === true ||
         event.event_type === 'subagent_stop';
};

/**
 * Get event details text
 */
const getEventDetails = (event: Event) => {
  switch (event.event_type) {
    case 'user_prompt_submit':
      return event.metadata?.prompt || 'User prompt submitted';
    case 'pre_tool_use':
      return `Starting ${event.tool_name}`;
    case 'post_tool_use':
      const success = event.metadata?.tool_response?.success;
      const result = success ? 'completed successfully' : 'failed';
      return `${event.tool_name} ${result}`;
    case 'notification':
      return event.metadata?.message || 'Notification';
    case 'error':
      return event.metadata?.error_message || 'Error occurred';
    case 'stop':
      return 'Session stopped';
    case 'subagent_stop':
      return 'Sub-agent completed';
    case 'session_start':
      return 'Session started';
    case 'pre_compact':
      return 'Context compaction started';
    default:
      return event.event_type;
  }
};

/**
 * Dense 24px event row with semantic color coding
 */
export const EventRowV2 = memo<EventRowV2Props>(({ event, session, index }) => {
  const colorClasses = getEventColorClasses(event.event_type);
  const isSubAgent = isSubAgentEvent(event);
  const icon = getEventIcon(event.event_type, event.tool_name);
  const toolIcon = event.tool_name ? getToolIcon(event.tool_name) : null;

  return (
    <div
      className={cn(
        // Base layout and sizing - dense 24px height matching I4V2-V5
        'grid grid-cols-[85px_140px_110px_90px_1fr] gap-3 items-center',
        'h-6 min-h-[24px] max-h-[24px]', // Exactly 24px height
        'text-xs leading-tight font-mono', // Dense typography matching V5
        
        // Padding for 24px height - tighter than before
        'py-1',
        isSubAgent ? 'pl-8 pr-3' : 'px-3', // 20px extra left padding for sub-agents
        
        // Color coding with 3px border per I4V2-V3
        'border-l-[3px]',
        colorClasses.border,
        
        // Hover effects
        'hover:bg-black/10 transition-colors duration-150',
        
        // Remove alternating backgrounds for cleaner look per V3
      )}
      style={{
        backgroundColor: colorClasses.background,
        fontSize: '12px', // Explicit font size matching V5
        lineHeight: '1.2' // Tight line height for density
      }}
      data-testid="event-row-v2"
      data-event-type={event.event_type}
    >
      {/* Time column (85px) */}
      <div className="text-text-muted font-mono text-xs">
        {formatTime(event.timestamp)}
      </div>

      {/* Session column (140px) */}
      <div className="text-text-secondary font-medium truncate" title={formatSessionDisplay(session)}>
        {formatSessionDisplay(session)}
      </div>

      {/* Type column (110px) */}
      <div className="flex items-center gap-1.5">
        <span className="material-icons text-sm text-text-muted">
          {icon}
        </span>
        <span 
          className={cn(
            'px-2 py-1 rounded-md text-xs font-medium truncate',
            'bg-bg-tertiary text-text-secondary'
          )}
          title={event.event_type}
        >
          {event.event_type.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Tool column (90px) */}
      <div className="flex items-center gap-1.5">
        {event.tool_name && toolIcon && (
          <>
            <span className="material-icons text-sm text-text-muted">
              {toolIcon}
            </span>
            <span 
              className="text-text-primary font-medium truncate"
              title={event.tool_name}
            >
              {event.tool_name}
            </span>
          </>
        )}
        {event.duration_ms && (
          <span className="text-text-muted text-xs ml-auto">
            {formatDuration(event.duration_ms)}
          </span>
        )}
      </div>

      {/* Details column (flex) */}
      <div className="text-text-secondary truncate" title={getEventDetails(event)}>
        {getEventDetails(event)}
      </div>
    </div>
  );
});

EventRowV2.displayName = 'memo(EventRowV2)';