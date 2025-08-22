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