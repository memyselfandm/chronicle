import { Event, Session } from '@/types/events';
import { EventType } from '@/types/filters';
import { logger } from './utils';

/**
 * Session status types
 */
export type SessionStatus = 'active' | 'idle' | 'awaiting' | 'completed' | 'error';

/**
 * Session activity information
 */
export interface SessionActivity {
  status: SessionStatus;
  lastActivity: Date | null;
  hasNotification: boolean;
  requiresResponse: boolean;
  isSubAgent: boolean;
  errorCount: number;
  toolsInProgress: number;
  idleTimeMs: number;
}

/**
 * Configuration for session status determination
 */
export const SESSION_STATUS_CONFIG = {
  IDLE_TIMEOUT_MS: 30 * 1000, // 30 seconds
  MAX_ERROR_THRESHOLD: 3,
  ACTIVITY_EVENTS: [
    'user_prompt_submit',
    'pre_tool_use',
    'post_tool_use',
    'notification'
  ] as EventType[],
  COMPLETION_EVENTS: [
    'stop',
    'subagent_stop'
  ] as EventType[],
  ERROR_EVENTS: [
    'error'
  ] as EventType[],
} as const;

/**
 * Determines session status based on recent events
 * @param session - Session information
 * @param events - Recent events for the session (sorted by timestamp desc)
 * @returns Session activity information
 */
export const determineSessionStatus = (
  session: Session,
  events: Event[]
): SessionActivity => {
  const now = new Date();
  const sessionEvents = events.filter(e => e.session_id === session.id);
  
  // Initialize activity info
  const activity: SessionActivity = {
    status: 'idle',
    lastActivity: null,
    hasNotification: false,
    requiresResponse: false,
    isSubAgent: false,
    errorCount: 0,
    toolsInProgress: 0,
    idleTimeMs: 0,
  };

  if (sessionEvents.length === 0) {
    // No events yet, consider active if recently started
    const sessionAge = now.getTime() - new Date(session.start_time).getTime();
    activity.status = sessionAge < SESSION_STATUS_CONFIG.IDLE_TIMEOUT_MS ? 'active' : 'idle';
    activity.idleTimeMs = sessionAge;
    return activity;
  }

  // Sort events by timestamp (newest first) to ensure proper analysis
  const sortedEvents = [...sessionEvents].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Find most recent activity event
  const lastActivityEvent = sortedEvents.find(e => 
    SESSION_STATUS_CONFIG.ACTIVITY_EVENTS.includes(e.event_type)
  );

  if (lastActivityEvent) {
    activity.lastActivity = new Date(lastActivityEvent.timestamp);
    activity.idleTimeMs = now.getTime() - activity.lastActivity.getTime();
  }

  // Check for completion events
  const hasCompletionEvent = sortedEvents.some(e => 
    SESSION_STATUS_CONFIG.COMPLETION_EVENTS.includes(e.event_type)
  );

  if (hasCompletionEvent || session.end_time) {
    activity.status = 'completed';
    return activity;
  }

  // Count error events
  activity.errorCount = sortedEvents.filter(e => 
    SESSION_STATUS_CONFIG.ERROR_EVENTS.includes(e.event_type)
  ).length;

  // Check if session has too many errors
  if (activity.errorCount >= SESSION_STATUS_CONFIG.MAX_ERROR_THRESHOLD) {
    activity.status = 'error';
    return activity;
  }

  // Detect sub-agent sessions
  activity.isSubAgent = sortedEvents.some(e => e.event_type === 'subagent_stop') ||
    session.metadata?.isSubAgent === true;

  // Check for tools in progress (pre_tool_use without matching post_tool_use)
  const toolEvents = sortedEvents.filter(e => 
    e.event_type === 'pre_tool_use' || e.event_type === 'post_tool_use'
  );
  
  const toolsInProgress = new Set<string>();
  for (const event of toolEvents) {
    if (event.event_type === 'pre_tool_use' && event.tool_name) {
      toolsInProgress.add(event.tool_name);
    } else if (event.event_type === 'post_tool_use' && event.tool_name) {
      toolsInProgress.delete(event.tool_name);
    }
  }
  activity.toolsInProgress = toolsInProgress.size;

  // Check for notification events requiring response
  const notificationEvents = sortedEvents.filter(e => e.event_type === 'notification');
  activity.hasNotification = notificationEvents.length > 0;
  
  // Check if any notification requires a response
  activity.requiresResponse = notificationEvents.some(e => 
    e.metadata?.requires_response === true ||
    e.metadata?.data?.requires_response === true
  );

  // Determine final status
  if (activity.requiresResponse) {
    activity.status = 'awaiting';
  } else if (activity.toolsInProgress > 0) {
    activity.status = 'active';
  } else if (activity.lastActivity) {
    // Check if session is idle based on last activity
    if (activity.idleTimeMs > SESSION_STATUS_CONFIG.IDLE_TIMEOUT_MS) {
      activity.status = 'idle';
    } else {
      activity.status = 'active';
    }
  } else {
    // No recent activity, consider idle
    activity.status = 'idle';
  }

  return activity;
};

/**
 * Batch process session statuses for multiple sessions
 * @param sessions - Array of sessions
 * @param eventsBySession - Map of session ID to events
 * @returns Map of session ID to activity info
 */
export const batchDetermineSessionStatus = (
  sessions: Session[],
  eventsBySession: Map<string, Event[]>
): Map<string, SessionActivity> => {
  const statusMap = new Map<string, SessionActivity>();
  
  for (const session of sessions) {
    try {
      const events = eventsBySession.get(session.id) || [];
      const activity = determineSessionStatus(session, events);
      statusMap.set(session.id, activity);
    } catch (error) {
      logger.error('Error determining session status', {
        component: 'sessionStatus',
        action: 'batchDetermineSessionStatus',
        data: { sessionId: session.id }
      }, error as Error);
      
      // Default to idle status on error
      statusMap.set(session.id, {
        status: 'idle',
        lastActivity: null,
        hasNotification: false,
        requiresResponse: false,
        isSubAgent: false,
        errorCount: 0,
        toolsInProgress: 0,
        idleTimeMs: 0,
      });
    }
  }
  
  return statusMap;
};

/**
 * Filters sessions by status
 * @param sessions - Array of sessions
 * @param statusMap - Map of session ID to activity info
 * @param targetStatus - Status to filter by
 * @returns Filtered sessions
 */
export const filterSessionsByStatus = (
  sessions: Session[],
  statusMap: Map<string, SessionActivity>,
  targetStatus: SessionStatus
): Session[] => {
  return sessions.filter(session => {
    const activity = statusMap.get(session.id);
    return activity?.status === targetStatus;
  });
};

/**
 * Gets active sessions (not idle, completed, or error)
 * @param sessions - Array of sessions
 * @param statusMap - Map of session ID to activity info
 * @returns Active sessions
 */
export const getActiveSessions = (
  sessions: Session[],
  statusMap: Map<string, SessionActivity>
): Session[] => {
  return sessions.filter(session => {
    const activity = statusMap.get(session.id);
    return activity?.status === 'active' || activity?.status === 'awaiting';
  });
};

/**
 * Gets sessions requiring attention (awaiting response or have errors)
 * @param sessions - Array of sessions
 * @param statusMap - Map of session ID to activity info
 * @returns Sessions needing attention
 */
export const getSessionsRequiringAttention = (
  sessions: Session[],
  statusMap: Map<string, SessionActivity>
): Session[] => {
  return sessions.filter(session => {
    const activity = statusMap.get(session.id);
    return activity?.status === 'awaiting' || 
           activity?.status === 'error' ||
           (activity?.requiresResponse === true);
  });
};

/**
 * Creates a summary of session statuses
 * @param sessions - Array of sessions
 * @param statusMap - Map of session ID to activity info
 * @returns Status summary
 */
export const createSessionStatusSummary = (
  sessions: Session[],
  statusMap: Map<string, SessionActivity>
): Record<SessionStatus, number> => {
  const summary: Record<SessionStatus, number> = {
    active: 0,
    idle: 0,
    awaiting: 0,
    completed: 0,
    error: 0,
  };

  for (const session of sessions) {
    const activity = statusMap.get(session.id);
    if (activity) {
      summary[activity.status]++;
    }
  }

  return summary;
};