/**
 * Event-related type definitions for the Chronicle Dashboard
 * Updated to match database schema exactly
 */

import { EventType } from './filters';

/**
 * Base event interface matching database schema
 */
export interface BaseEvent {
  /** Unique event identifier (UUID) */
  id: string;
  /** Session ID this event belongs to (UUID) */
  session_id: string;
  /** Event type category */
  event_type: EventType;
  /** Event timestamp (TIMESTAMPTZ) */
  timestamp: string;
  /** Event metadata (JSONB) */
  metadata: Record<string, any>;
  /** Tool name for tool-related events */
  tool_name?: string;
  /** Duration in milliseconds for tool events */
  duration_ms?: number;
  /** When record was created */
  created_at: string;
}

/**
 * Session start event interface
 */
export interface SessionStartEvent extends BaseEvent {
  event_type: 'session_start';
}

/**
 * Pre-tool use event interface
 */
export interface PreToolUseEvent extends BaseEvent {
  event_type: 'pre_tool_use';
  tool_name: string;
}

/**
 * Post-tool use event interface
 */
export interface PostToolUseEvent extends BaseEvent {
  event_type: 'post_tool_use';
  tool_name: string;
  duration_ms?: number;
}

/**
 * User prompt submit event interface
 */
export interface UserPromptSubmitEvent extends BaseEvent {
  event_type: 'user_prompt_submit';
}

/**
 * Stop event interface
 */
export interface StopEvent extends BaseEvent {
  event_type: 'stop';
}

/**
 * Subagent stop event interface
 */
export interface SubagentStopEvent extends BaseEvent {
  event_type: 'subagent_stop';
}

/**
 * Pre-compact event interface
 */
export interface PreCompactEvent extends BaseEvent {
  event_type: 'pre_compact';
}

/**
 * Notification event interface
 */
export interface NotificationEvent extends BaseEvent {
  event_type: 'notification';
}

/**
 * Error event interface
 */
export interface ErrorEvent extends BaseEvent {
  event_type: 'error';
}

/**
 * Union type for all event types
 */
export type Event = 
  | SessionStartEvent
  | PreToolUseEvent
  | PostToolUseEvent
  | UserPromptSubmitEvent
  | StopEvent
  | SubagentStopEvent
  | PreCompactEvent
  | NotificationEvent
  | ErrorEvent;

/**
 * Session information interface matching database schema
 */
export interface Session {
  /** Unique session identifier (UUID) */
  id: string;
  /** Claude session identifier */
  claude_session_id: string;
  /** Project file path */
  project_path?: string;
  /** Git branch name */
  git_branch?: string;
  /** Session start timestamp */
  start_time: string;
  /** Session end timestamp (if completed) */
  end_time?: string;
  /** Session metadata (JSONB) */
  metadata: Record<string, any>;
  /** When record was created */
  created_at: string;
}

/**
 * Event summary for dashboard display
 */
export interface EventSummary {
  /** Total number of events */
  total: number;
  /** Events by type */
  byType: Record<EventType, number>;
  /** Events by status */
  byStatus: Record<string, number>;
  /** Time range of events */
  timeRange: {
    earliest: string;
    latest: string;
  };
}