/**
 * Event-related type definitions for the Chronicle Dashboard
 */

import { EventType } from './filters';

/**
 * Base event interface
 */
export interface BaseEvent {
  /** Unique event identifier */
  id: string;
  /** Event type category */
  type: EventType;
  /** Event timestamp in ISO format */
  timestamp: string;
  /** Session ID this event belongs to */
  session_id: string;
  /** Event status */
  status: 'success' | 'error' | 'pending' | 'warning';
  /** Additional event data */
  data: Record<string, any>;
}

/**
 * Tool usage event interface
 */
export interface ToolUseEvent extends BaseEvent {
  type: 'tool_use';
  data: {
    tool_name: string;
    parameters?: Record<string, any>;
    result?: any;
    duration_ms?: number;
    error_message?: string;
  };
}

/**
 * Prompt event interface
 */
export interface PromptEvent extends BaseEvent {
  type: 'prompt';
  data: {
    prompt_type: 'user' | 'system' | 'assistant';
    content?: string;
    token_count?: number;
    model?: string;
  };
}

/**
 * Session lifecycle event interface
 */
export interface SessionEvent extends BaseEvent {
  type: 'session';
  data: {
    action: 'start' | 'end' | 'pause' | 'resume';
    project_name?: string;
    project_path?: string;
    git_branch?: string;
    duration_ms?: number;
  };
}

/**
 * Lifecycle event interface
 */
export interface LifecycleEvent extends BaseEvent {
  type: 'lifecycle';
  data: {
    event_name: string;
    component?: string;
    metadata?: Record<string, any>;
  };
}

/**
 * Error event interface
 */
export interface ErrorEvent extends BaseEvent {
  type: 'error';
  status: 'error';
  data: {
    error_type: string;
    error_message: string;
    stack_trace?: string;
    context?: Record<string, any>;
  };
}

/**
 * File operation event interface
 */
export interface FileOpEvent extends BaseEvent {
  type: 'file_op';
  data: {
    operation: 'read' | 'write' | 'edit' | 'delete' | 'create';
    file_path: string;
    file_type?: string;
    size_bytes?: number;
    diff?: string;
  };
}

/**
 * System event interface
 */
export interface SystemEvent extends BaseEvent {
  type: 'system';
  data: {
    system_event: string;
    cpu_usage?: number;
    memory_usage?: number;
    disk_usage?: number;
    network_stats?: Record<string, any>;
  };
}

/**
 * Notification event interface
 */
export interface NotificationEvent extends BaseEvent {
  type: 'notification';
  data: {
    notification_type: 'info' | 'warning' | 'error' | 'success';
    title: string;
    message: string;
    action_required?: boolean;
  };
}

/**
 * Union type for all event types
 */
export type Event = 
  | ToolUseEvent
  | PromptEvent
  | SessionEvent
  | LifecycleEvent
  | ErrorEvent
  | FileOpEvent
  | SystemEvent
  | NotificationEvent;

/**
 * Session information interface
 */
export interface Session {
  /** Unique session identifier */
  id: string;
  /** Session status */
  status: 'active' | 'idle' | 'completed' | 'error';
  /** Session start timestamp */
  started_at: string;
  /** Session end timestamp (if completed) */
  ended_at?: string;
  /** Project name associated with this session */
  project_name?: string;
  /** Project file path */
  project_path?: string;
  /** Git branch name */
  git_branch?: string;
  /** Total number of events in this session */
  event_count: number;
  /** Last activity timestamp */
  last_activity?: string;
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