import { Event, Session, EventType } from '../types/chronicle';
import { Connection } from '../types/connection';

export const createMockEvent = (overrides: Partial<Event> = {}): Event => ({
  id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  session_id: 'session_123',
  event_type: 'user_prompt_submit',
  timestamp: new Date().toISOString(),
  data: {
    prompt: 'Test prompt',
    tokens: 100,
  },
  metadata: {
    user_id: 'user_123',
    version: '1.0.0',
  },
  sub_agent_id: null,
  sub_agent_name: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

export const createMockSession = (overrides: Partial<Session> = {}): Session => ({
  id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  session_id: `sess_${Date.now()}`,
  start_time: new Date().toISOString(),
  end_time: null,
  status: 'active',
  total_events: 5,
  total_input_tokens: 250,
  total_output_tokens: 180,
  total_cost: 0.05,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  summary: null,
  ...overrides,
});

export const createMockConnection = (overrides: Partial<Connection> = {}): Connection => ({
  state: 'connected',
  lastUpdate: new Date(),
  lastEventReceived: new Date(),
  subscriptions: 2,
  reconnectAttempts: 0,
  error: null,
  isHealthy: true,
  ...overrides,
});

export const mockEventTypes: EventType[] = [
  'user_prompt_submit',
  'session_start',
  'tool_use',
  'tool_result',
  'session_end',
  'error',
  'notification',
  'pre_tool_use',
  'post_tool_use',
  'subagent_start',
  'subagent_stop',
  'stop',
  'pre_compact',
];

export const createMockEvents = (count: number, sessionId: string = 'session_123'): Event[] => {
  return Array.from({ length: count }, (_, index) => createMockEvent({
    id: `evt_${index}`,
    session_id: sessionId,
    event_type: mockEventTypes[index % mockEventTypes.length],
    timestamp: new Date(Date.now() - (count - index) * 1000).toISOString(),
  }));
};

export const createMockSessions = (count: number): Session[] => {
  return Array.from({ length: count }, (_, index) => createMockSession({
    id: `session_${index}`,
    session_id: `sess_${index}`,
    status: index % 3 === 0 ? 'completed' : index % 3 === 1 ? 'active' : 'awaiting_input',
    start_time: new Date(Date.now() - (count - index) * 60000).toISOString(),
    total_events: Math.floor(Math.random() * 20) + 5,
  }));
};

// Performance test data generators
export const createLargeEventDataset = (eventCount: number = 1000, sessionCount: number = 30): {
  events: Event[];
  sessions: Session[];
} => {
  const sessions = createMockSessions(sessionCount);
  const events: Event[] = [];
  
  sessions.forEach((session, sessionIndex) => {
    const eventsPerSession = Math.floor(eventCount / sessionCount);
    const sessionEvents = createMockEvents(eventsPerSession, session.session_id);
    events.push(...sessionEvents);
  });

  return { events, sessions };
};

// High-frequency event stream for performance testing
export const createHighFrequencyEventStream = (eventsPerSecond: number = 200, durationSeconds: number = 60) => {
  const totalEvents = eventsPerSecond * durationSeconds;
  const events: Event[] = [];
  
  for (let i = 0; i < totalEvents; i++) {
    const timestamp = new Date(Date.now() + (i * 1000 / eventsPerSecond));
    events.push(createMockEvent({
      id: `perf_evt_${i}`,
      timestamp: timestamp.toISOString(),
      event_type: mockEventTypes[i % mockEventTypes.length],
    }));
  }
  
  return events;
};

// Event-type specific generators
export const createMockEventsByType = {
  user_prompt_submit: (overrides: Partial<Event> = {}): Event => 
    createMockEvent({
      event_type: 'user_prompt_submit',
      data: {
        prompt: 'Help me build a React component',
        tokens: Math.floor(Math.random() * 500) + 50,
        model: 'claude-3-sonnet',
        timestamp: new Date().toISOString(),
      },
      ...overrides,
    }),

  session_start: (overrides: Partial<Event> = {}): Event =>
    createMockEvent({
      event_type: 'session_start',
      data: {
        project_id: `proj_${Math.random().toString(36).substr(2, 9)}`,
        user_agent: 'Claude Code CLI',
        platform: 'darwin',
        version: '1.0.0',
      },
      ...overrides,
    }),

  tool_use: (overrides: Partial<Event> = {}): Event =>
    createMockEvent({
      event_type: 'tool_use',
      data: {
        tool_name: ['Read', 'Write', 'Bash', 'Grep', 'LS'][Math.floor(Math.random() * 5)],
        parameters: {
          file_path: '/Users/test/project/src/component.tsx',
          content: 'Sample file content',
        },
        start_time: new Date().toISOString(),
      },
      ...overrides,
    }),

  tool_result: (overrides: Partial<Event> = {}): Event =>
    createMockEvent({
      event_type: 'tool_result',
      data: {
        tool_name: 'Read',
        success: Math.random() > 0.1, // 90% success rate
        result: 'File read successfully',
        execution_time: Math.floor(Math.random() * 1000) + 100,
        end_time: new Date().toISOString(),
      },
      ...overrides,
    }),

  error: (overrides: Partial<Event> = {}): Event =>
    createMockEvent({
      event_type: 'error',
      data: {
        error_type: ['ValidationError', 'NetworkError', 'PermissionError'][Math.floor(Math.random() * 3)],
        message: 'An error occurred during processing',
        stack_trace: 'Error: Something went wrong\n  at function (file.js:10:5)',
        severity: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)],
      },
      ...overrides,
    }),

  notification: (overrides: Partial<Event> = {}): Event =>
    createMockEvent({
      event_type: 'notification',
      data: {
        type: ['info', 'success', 'warning', 'error'][Math.floor(Math.random() * 4)],
        title: 'Test Notification',
        message: 'This is a test notification message',
        dismissible: Math.random() > 0.3,
      },
      ...overrides,
    }),

  subagent_start: (overrides: Partial<Event> = {}): Event =>
    createMockEvent({
      event_type: 'subagent_start',
      sub_agent_id: `agent_${Math.random().toString(36).substr(2, 9)}`,
      sub_agent_name: ['TestAgent', 'CodeReviewer', 'DocumentGenerator'][Math.floor(Math.random() * 3)],
      data: {
        agent_type: 'specialist',
        capabilities: ['code_analysis', 'testing', 'documentation'],
        parent_session_id: overrides.session_id || 'session_123',
      },
      ...overrides,
    }),
};

// Realistic session scenarios
export const createSessionScenarios = {
  activeSession: (): Session => createMockSession({
    status: 'active',
    end_time: null,
    total_events: Math.floor(Math.random() * 50) + 10,
    total_input_tokens: Math.floor(Math.random() * 2000) + 500,
    total_output_tokens: Math.floor(Math.random() * 3000) + 800,
    total_cost: parseFloat((Math.random() * 2 + 0.10).toFixed(4)),
  }),

  completedSession: (): Session => createMockSession({
    status: 'completed',
    end_time: new Date(Date.now() - Math.random() * 86400000).toISOString(), // Within last 24h
    total_events: Math.floor(Math.random() * 100) + 25,
    summary: 'Successfully completed coding task with test coverage and documentation',
    total_cost: parseFloat((Math.random() * 5 + 0.50).toFixed(4)),
  }),

  awaitingInputSession: (): Session => createMockSession({
    status: 'awaiting_input',
    end_time: null,
    total_events: Math.floor(Math.random() * 20) + 5,
    total_input_tokens: Math.floor(Math.random() * 1000) + 200,
    total_output_tokens: Math.floor(Math.random() * 1500) + 300,
  }),

  errorSession: (): Session => createMockSession({
    status: 'error',
    end_time: new Date().toISOString(),
    total_events: Math.floor(Math.random() * 10) + 1,
    summary: 'Session terminated due to error',
    total_cost: parseFloat((Math.random() * 0.50 + 0.01).toFixed(4)),
  }),
};

// Load testing data generators
export const createLoadTestData = {
  // Generate realistic event stream for a coding session
  codingSession: (durationMinutes: number = 30): Event[] => {
    const events: Event[] = [];
    const sessionId = `coding_session_${Date.now()}`;
    const startTime = Date.now() - (durationMinutes * 60 * 1000);
    
    // Session start
    events.push(createMockEventsByType.session_start({
      session_id: sessionId,
      timestamp: new Date(startTime).toISOString(),
    }));

    // Simulate realistic coding flow
    let currentTime = startTime + 5000; // 5 seconds after start
    
    for (let i = 0; i < durationMinutes; i++) {
      // User submits prompt every 2-5 minutes
      if (i % Math.floor(Math.random() * 3 + 2) === 0) {
        events.push(createMockEventsByType.user_prompt_submit({
          session_id: sessionId,
          timestamp: new Date(currentTime).toISOString(),
        }));
        currentTime += Math.random() * 30000 + 5000; // 5-35 seconds
      }

      // Tool uses follow prompts
      const toolCount = Math.floor(Math.random() * 5) + 1;
      for (let j = 0; j < toolCount; j++) {
        events.push(createMockEventsByType.tool_use({
          session_id: sessionId,
          timestamp: new Date(currentTime).toISOString(),
        }));
        currentTime += Math.random() * 5000 + 1000; // 1-6 seconds

        events.push(createMockEventsByType.tool_result({
          session_id: sessionId,
          timestamp: new Date(currentTime).toISOString(),
        }));
        currentTime += Math.random() * 2000 + 500; // 0.5-2.5 seconds
      }

      // Occasional errors (5% chance)
      if (Math.random() < 0.05) {
        events.push(createMockEventsByType.error({
          session_id: sessionId,
          timestamp: new Date(currentTime).toISOString(),
        }));
        currentTime += 1000;
      }

      currentTime += Math.random() * 60000 + 30000; // 30-90 seconds between cycles
    }

    return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  },

  // Generate high-frequency test data
  highFrequency: (eventsPerSecond: number, durationSeconds: number): Event[] => {
    const events: Event[] = [];
    const totalEvents = eventsPerSecond * durationSeconds;
    const sessionId = `perf_session_${Date.now()}`;
    const startTime = Date.now();

    for (let i = 0; i < totalEvents; i++) {
      const eventTime = startTime + (i * 1000 / eventsPerSecond);
      const eventType = mockEventTypes[i % mockEventTypes.length];
      
      events.push(createMockEventsByType[eventType as keyof typeof createMockEventsByType]?.({
        session_id: sessionId,
        timestamp: new Date(eventTime).toISOString(),
      }) || createMockEvent({
        session_id: sessionId,
        timestamp: new Date(eventTime).toISOString(),
        event_type: eventType,
      }));
    }

    return events;
  },
};