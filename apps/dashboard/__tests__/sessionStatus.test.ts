import {
  determineSessionStatus,
  batchDetermineSessionStatus,
  filterSessionsByStatus,
  getActiveSessions,
  getSessionsRequiringAttention,
  createSessionStatusSummary,
  SESSION_STATUS_CONFIG,
  SessionStatus,
} from '../src/lib/sessionStatus';
import { Event, Session } from '../src/types/events';

// Mock logger
jest.mock('../src/lib/utils', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('sessionStatus', () => {
  const mockSession: Session = {
    id: 'session-1',
    claude_session_id: 'claude-session-1',
    project_path: '/test/project',
    git_branch: 'main',
    start_time: new Date('2024-01-01T10:00:00Z').toISOString(),
    end_time: null,
    metadata: {},
    created_at: new Date('2024-01-01T10:00:00Z').toISOString(),
  };

  const mockEvents: Event[] = [
    {
      id: 'event-1',
      session_id: 'session-1',
      event_type: 'session_start',
      timestamp: new Date('2024-01-01T10:00:00Z').toISOString(),
      metadata: {},
      created_at: new Date('2024-01-01T10:00:00Z').toISOString(),
    },
    {
      id: 'event-2',
      session_id: 'session-1',
      event_type: 'user_prompt_submit',
      timestamp: new Date('2024-01-01T10:01:00Z').toISOString(),
      metadata: { message: 'test prompt' },
      created_at: new Date('2024-01-01T10:01:00Z').toISOString(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock current time to be consistent
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-01-01T10:05:00Z').getTime());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('determineSessionStatus', () => {
    it('should return idle status for session with no events', () => {
      const activity = determineSessionStatus(mockSession, []);
      
      expect(activity.status).toBe('idle');
      expect(activity.lastActivity).toBeNull();
      expect(activity.idleTimeMs).toBeGreaterThan(0);
    });

    it('should return active status for recently started session with no events', () => {
      const recentSession = {
        ...mockSession,
        start_time: new Date('2024-01-01T10:04:50Z').toISOString(), // 10 seconds ago
      };
      
      const activity = determineSessionStatus(recentSession, []);
      
      expect(activity.status).toBe('active');
      expect(activity.idleTimeMs).toBeLessThan(SESSION_STATUS_CONFIG.IDLE_TIMEOUT_MS);
    });

    it('should return active status for session with recent activity', () => {
      const recentEvents = [
        {
          ...mockEvents[1],
          timestamp: new Date('2024-01-01T10:04:50Z').toISOString(), // 10 seconds ago
        }
      ];
      
      const activity = determineSessionStatus(mockSession, recentEvents);
      
      expect(activity.status).toBe('active');
      expect(activity.lastActivity).toBeDefined();
      expect(activity.idleTimeMs).toBeLessThan(SESSION_STATUS_CONFIG.IDLE_TIMEOUT_MS);
    });

    it('should return idle status for session with old activity', () => {
      const oldEvents = [
        {
          ...mockEvents[1],
          timestamp: new Date('2024-01-01T10:03:00Z').toISOString(), // 2 minutes ago
        }
      ];
      
      const activity = determineSessionStatus(mockSession, oldEvents);
      
      expect(activity.status).toBe('idle');
      expect(activity.idleTimeMs).toBeGreaterThan(SESSION_STATUS_CONFIG.IDLE_TIMEOUT_MS);
    });

    it('should return completed status for session with stop event', () => {
      const eventsWithStop = [
        ...mockEvents,
        {
          id: 'event-3',
          session_id: 'session-1',
          event_type: 'stop',
          timestamp: new Date('2024-01-01T10:02:00Z').toISOString(),
          metadata: {},
          created_at: new Date('2024-01-01T10:02:00Z').toISOString(),
        }
      ];
      
      const activity = determineSessionStatus(mockSession, eventsWithStop);
      
      expect(activity.status).toBe('completed');
    });

    it('should return completed status for session with end_time', () => {
      const completedSession = {
        ...mockSession,
        end_time: new Date('2024-01-01T10:03:00Z').toISOString(),
      };
      
      const activity = determineSessionStatus(completedSession, mockEvents);
      
      expect(activity.status).toBe('completed');
    });

    it('should return error status for session with too many errors', () => {
      const errorEvents = Array.from({ length: 4 }, (_, i) => ({
        id: `error-event-${i}`,
        session_id: 'session-1',
        event_type: 'error' as const,
        timestamp: new Date(`2024-01-01T10:0${i}:00Z`).toISOString(),
        metadata: { error: `Error ${i}` },
        created_at: new Date(`2024-01-01T10:0${i}:00Z`).toISOString(),
      }));
      
      const activity = determineSessionStatus(mockSession, errorEvents);
      
      expect(activity.status).toBe('error');
      expect(activity.errorCount).toBeGreaterThanOrEqual(SESSION_STATUS_CONFIG.MAX_ERROR_THRESHOLD);
    });

    it('should return awaiting status for session with notification requiring response', () => {
      const notificationEvents = [
        ...mockEvents,
        {
          id: 'notification-1',
          session_id: 'session-1',
          event_type: 'notification' as const,
          timestamp: new Date('2024-01-01T10:04:00Z').toISOString(),
          metadata: { requires_response: true },
          created_at: new Date('2024-01-01T10:04:00Z').toISOString(),
        }
      ];
      
      const activity = determineSessionStatus(mockSession, notificationEvents);
      
      expect(activity.status).toBe('awaiting');
      expect(activity.requiresResponse).toBe(true);
      expect(activity.hasNotification).toBe(true);
    });

    it('should detect sub-agent sessions', () => {
      const subAgentEvents = [
        ...mockEvents,
        {
          id: 'subagent-stop-1',
          session_id: 'session-1',
          event_type: 'subagent_stop' as const,
          timestamp: new Date('2024-01-01T10:03:00Z').toISOString(),
          metadata: {},
          created_at: new Date('2024-01-01T10:03:00Z').toISOString(),
        }
      ];
      
      const activity = determineSessionStatus(mockSession, subAgentEvents);
      
      expect(activity.isSubAgent).toBe(true);
    });

    it('should detect sub-agent sessions from metadata', () => {
      const subAgentSession = {
        ...mockSession,
        metadata: { isSubAgent: true },
      };
      
      const activity = determineSessionStatus(subAgentSession, mockEvents);
      
      expect(activity.isSubAgent).toBe(true);
    });

    it('should count tools in progress', () => {
      const toolEvents = [
        ...mockEvents,
        {
          id: 'pre-tool-1',
          session_id: 'session-1',
          event_type: 'pre_tool_use' as const,
          tool_name: 'Read',
          timestamp: new Date('2024-01-01T10:02:00Z').toISOString(),
          metadata: {},
          created_at: new Date('2024-01-01T10:02:00Z').toISOString(),
        },
        {
          id: 'pre-tool-2',
          session_id: 'session-1',
          event_type: 'pre_tool_use' as const,
          tool_name: 'Edit',
          timestamp: new Date('2024-01-01T10:03:00Z').toISOString(),
          metadata: {},
          created_at: new Date('2024-01-01T10:03:00Z').toISOString(),
        },
        {
          id: 'post-tool-1',
          session_id: 'session-1',
          event_type: 'post_tool_use' as const,
          tool_name: 'Read',
          timestamp: new Date('2024-01-01T10:02:30Z').toISOString(),
          metadata: {},
          created_at: new Date('2024-01-01T10:02:30Z').toISOString(),
        }
      ];
      
      const activity = determineSessionStatus(mockSession, toolEvents);
      
      expect(activity.toolsInProgress).toBe(1); // Edit tool is still in progress
      expect(activity.status).toBe('active'); // Should be active due to tools in progress
    });
  });

  describe('batchDetermineSessionStatus', () => {
    it('should process multiple sessions', () => {
      const sessions = [
        mockSession,
        {
          ...mockSession,
          id: 'session-2',
          claude_session_id: 'claude-session-2',
        }
      ];
      
      const eventsBySession = new Map([
        ['session-1', mockEvents],
        ['session-2', []]
      ]);
      
      const statusMap = batchDetermineSessionStatus(sessions, eventsBySession);
      
      expect(statusMap.size).toBe(2);
      expect(statusMap.get('session-1')).toBeDefined();
      expect(statusMap.get('session-2')).toBeDefined();
    });

    it('should handle errors gracefully', () => {
      const sessions = [mockSession];
      const eventsBySession = new Map();
      
      // This should not throw
      const statusMap = batchDetermineSessionStatus(sessions, eventsBySession);
      
      expect(statusMap.size).toBe(1);
      expect(statusMap.get('session-1')?.status).toBe('idle'); // Default fallback
    });
  });

  describe('filtering functions', () => {
    const sessions = [
      mockSession,
      { ...mockSession, id: 'session-2', claude_session_id: 'claude-session-2' }
    ];
    
    const statusMap = new Map([
      ['session-1', { status: 'active' as SessionStatus, lastActivity: new Date(), hasNotification: false, requiresResponse: false, isSubAgent: false, errorCount: 0, toolsInProgress: 1, idleTimeMs: 0 }],
      ['session-2', { status: 'idle' as SessionStatus, lastActivity: null, hasNotification: false, requiresResponse: false, isSubAgent: false, errorCount: 0, toolsInProgress: 0, idleTimeMs: 60000 }]
    ]);

    it('should filter sessions by status', () => {
      const activeSessions = filterSessionsByStatus(sessions, statusMap, 'active');
      const idleSessions = filterSessionsByStatus(sessions, statusMap, 'idle');
      
      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].id).toBe('session-1');
      expect(idleSessions).toHaveLength(1);
      expect(idleSessions[0].id).toBe('session-2');
    });

    it('should get active sessions', () => {
      const activeSessions = getActiveSessions(sessions, statusMap);
      
      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].id).toBe('session-1');
    });

    it('should get sessions requiring attention', () => {
      const statusMapWithAttention = new Map([
        ['session-1', { status: 'awaiting' as SessionStatus, lastActivity: new Date(), hasNotification: true, requiresResponse: true, isSubAgent: false, errorCount: 0, toolsInProgress: 0, idleTimeMs: 0 }],
        ['session-2', { status: 'error' as SessionStatus, lastActivity: new Date(), hasNotification: false, requiresResponse: false, isSubAgent: false, errorCount: 5, toolsInProgress: 0, idleTimeMs: 0 }]
      ]);
      
      const attentionSessions = getSessionsRequiringAttention(sessions, statusMapWithAttention);
      
      expect(attentionSessions).toHaveLength(2);
    });
  });

  describe('createSessionStatusSummary', () => {
    it('should create a summary of session statuses', () => {
      const sessions = [
        mockSession,
        { ...mockSession, id: 'session-2', claude_session_id: 'claude-session-2' },
        { ...mockSession, id: 'session-3', claude_session_id: 'claude-session-3' }
      ];
      
      const statusMap = new Map([
        ['session-1', { status: 'active' as SessionStatus, lastActivity: new Date(), hasNotification: false, requiresResponse: false, isSubAgent: false, errorCount: 0, toolsInProgress: 1, idleTimeMs: 0 }],
        ['session-2', { status: 'idle' as SessionStatus, lastActivity: null, hasNotification: false, requiresResponse: false, isSubAgent: false, errorCount: 0, toolsInProgress: 0, idleTimeMs: 60000 }],
        ['session-3', { status: 'completed' as SessionStatus, lastActivity: new Date(), hasNotification: false, requiresResponse: false, isSubAgent: false, errorCount: 0, toolsInProgress: 0, idleTimeMs: 0 }]
      ]);
      
      const summary = createSessionStatusSummary(sessions, statusMap);
      
      expect(summary.active).toBe(1);
      expect(summary.idle).toBe(1);
      expect(summary.completed).toBe(1);
      expect(summary.awaiting).toBe(0);
      expect(summary.error).toBe(0);
    });
  });
});