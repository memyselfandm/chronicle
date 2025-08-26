/**
 * EventRow - Dense 22px row component with semantic color coding
 * 
 * Features:
 * - Exactly 22px height for maximum density (per V5 reference)
 * - Semantic color coding per V3 design (0.08 opacity backgrounds)
 * - Fixed column layout (Time 85px, Icon 36px, Event Type 160px, Session 140px, Details flex)
 * - Sub-agent indentation (20px left padding)
 * - React.memo optimization
 * - Material icons per V5 specification
 */

'use client';

import React, { memo } from 'react';
import { Event, Session } from '@/types/events';
import { cn } from '@/lib/utils';

export interface EventRowProps {
  /** Event data to display */
  event: Event;
  /** Session context for display */
  session?: Session;
  /** Row index for styling */
  index: number;
  /** Style prop from react-window for positioning */
  style?: React.CSSProperties;
}

/**
 * Get semantic color classes for event type matching V3 reference design
 */
const getEventColorClasses = (eventType: string) => {
  switch (eventType) {
    case 'user_prompt_submit':
      return {
        border: 'border-l-[#8b5cf6]',
        background: 'rgba(139, 92, 246, 0.08)' // V3 spec: 0.08 opacity
      };
    case 'pre_tool_use':
      return {
        border: 'border-l-[#3b82f6]',
        background: 'rgba(59, 130, 246, 0.08)' // V3 spec: 0.08 opacity
      };
    case 'post_tool_use':
      return {
        border: 'border-l-[#4ade80]',
        background: 'rgba(74, 222, 128, 0.08)' // V3 spec: 0.08 opacity
      };
    case 'notification':
      return {
        border: 'border-l-[#fbbf24]',
        background: 'rgba(251, 191, 36, 0.08)' // V3 spec: 0.08 opacity
      };
    case 'error':
      return {
        border: 'border-l-[#ef4444]',
        background: 'rgba(239, 68, 68, 0.08)' // V3 spec: 0.08 opacity
      };
    case 'stop':
    case 'subagent_stop':
    case 'session_start':
    case 'pre_compact':
    default:
      return {
        border: 'border-l-[#6b7280]',
        background: 'rgba(107, 114, 128, 0.08)' // V3 spec: 0.08 opacity
      };
  }
};

/**
 * Get Material icon for event type (V5 specification)
 */
const getEventIcon = (eventType: string) => {
  switch (eventType) {
    case 'session_start':
      return 'play_circle';
    case 'user_prompt_submit':
      return 'chat';
    case 'pre_tool_use':
      return 'build';
    case 'post_tool_use':
      return 'check_circle';
    case 'notification':
      return 'notification_important';
    case 'error':
      return 'error';
    case 'stop':
      return 'stop';
    case 'subagent_stop':
      return 'stop_circle';
    case 'pre_compact':
      return 'compress';
    default:
      return 'radio_button_unchecked';
  }
};

/**
 * Format session display as folder/branch
 */
const formatSessionDisplay = (session?: Session) => {
  if (!session) return 'Unknown';
  
  // Extract just the folder name from the project path
  const folder = session.project_path 
    ? session.project_path.split('/').pop() || 'unknown'
    : 'unknown';
  
  // Clean up the branch name (remove 'no git' or use main as default)
  const branch = session.git_branch && session.git_branch !== 'no git'
    ? session.git_branch 
    : 'main';
  
  // Return in a more compact format
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
      const toolName = event.tool_name || 
                       event.metadata?.tool_name || 
                       event.metadata?.tool_input?.tool_name || 
                       'Unknown Tool';
      return `Starting ${toolName}`;
    case 'post_tool_use':
      const postToolName = event.tool_name || 
                           event.metadata?.tool_name || 
                           event.metadata?.tool_input?.tool_name || 
                           'Unknown Tool';
      const success = event.metadata?.tool_response?.success !== false;
      const result = success ? 'completed successfully' : 'failed';
      return `${postToolName} ${result}`;
    case 'notification':
      // Display the full message which includes tool name
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
 * Dense 22px event row with semantic color coding
 */
export const EventRow = memo<EventRowProps>(({ event, session, style }) => {
  const colorClasses = getEventColorClasses(event.event_type);
  const isSubAgent = isSubAgentEvent(event);
  const icon = getEventIcon(event.event_type);

  return (
    <div
      className={cn(
        // V5 column layout: Time 85px, Icon 36px, Event Type 160px, Session 140px, Details flex
        'grid grid-cols-[85px_36px_160px_280px_1fr] gap-2 items-center',
        'h-[22px] min-h-[22px] max-h-[22px]', // Exactly 22px height per V5 reference
        'text-xs leading-tight', // 12px font with tight line height (1.2)
        
        // Tight padding for 22px height (3px vertical per V5)
        'py-[3px]',
        isSubAgent ? 'pl-8 pr-4' : 'px-4', // Horizontal padding matching --spacing-lg
        
        // Color coding with 3px border per V3
        'border-l-[3px]',
        colorClasses.border,
        
        // Hover effects
        'hover:bg-black/10 transition-colors duration-150',
        
        // Remove alternating backgrounds for cleaner look per V3
      )}
      style={{
        ...style, // Apply react-window positioning
        backgroundColor: colorClasses.background,
        fontSize: '12px', // 12px for main content per V5
        lineHeight: '1.2' // Tight line height for density
      }}
      data-testid="event-row-v2"
      data-event-type={event.event_type}
    >
      {/* Time column (85px) - 11px font per V5 */}
      <div className="text-text-muted font-mono" style={{ fontSize: '11px' }}>
        {formatTime(event.timestamp)}
      </div>

      {/* Icon column (36px) - separate from event type per V5 */}
      <div className="flex items-center justify-center">
        <span className="material-icons" style={{ fontSize: '16px' }} title={event.event_type}>
          {icon}
        </span>
      </div>

      {/* Event Type column (160px) */}
      <div className="text-text-secondary truncate">
        {event.event_type.replace(/_/g, ' ')}
        {event.tool_name && ` (${event.tool_name})`}
      </div>

      {/* Session column (280px) */}
      <div className="text-text-secondary truncate" title={formatSessionDisplay(session)}>
        {formatSessionDisplay(session)}
      </div>

      {/* Details column (flex) - includes duration if present */}
      <div className="text-text-secondary truncate flex items-center gap-2" title={getEventDetails(event)}>
        <span className="truncate">{getEventDetails(event)}</span>
        {event.duration_ms && (
          <span className="text-text-muted" style={{ fontSize: '11px' }}>
            {formatDuration(event.duration_ms)}
          </span>
        )}
      </div>
    </div>
  );
});

EventRow.displayName = 'memo(EventRow)';