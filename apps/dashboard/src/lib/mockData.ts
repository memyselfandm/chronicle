// Mock data utilities for Chronicle Dashboard development and testing

export interface EventData {
  id: string;
  timestamp: Date;
  type: 'success' | 'tool_use' | 'file_op' | 'error' | 'lifecycle';
  session_id: string;
  summary: string;
  details?: Record<string, any>;
  toolName?: string;
  success?: boolean;
}

export interface SessionData {
  id: string;
  status: 'active' | 'idle' | 'completed';
  startedAt: Date;
  projectName?: string;
  color: string; // Consistent color for session identification
}

// Color palette for session identification
const SESSION_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // yellow
  '#ef4444', // red
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#f97316', // orange
  '#ec4899', // pink
];

// Tool names from the Claude Code ecosystem
const TOOL_NAMES = [
  'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'LS', 
  'MultiEdit', 'NotebookRead', 'NotebookEdit', 'WebFetch', 
  'WebSearch', 'TodoRead', 'TodoWrite'
];

// Session project names 
const PROJECT_NAMES = [
  'chronicle-dashboard', 'ai-workspace', 'claude-dev', 'observability-suite',
  'data-pipeline', 'user-analytics', 'real-time-monitor', 'performance-tracker'
];

// Event summaries for different types
const EVENT_SUMMARIES = {
  success: [
    'File operation completed successfully',
    'Tool execution finished',
    'Data query returned results',
    'API request completed',
    'Validation passed'
  ],
  tool_use: [
    'Reading configuration file',
    'Editing component source',
    'Running shell command',
    'Searching codebase',
    'Listing directory contents'
  ],
  file_op: [
    'Created new component file',
    'Updated package.json',
    'Modified configuration',
    'Deleted temporary files',
    'Renamed source file'
  ],
  error: [
    'Failed to read file',
    'Command execution failed',
    'Network request timeout',
    'Validation error',
    'Permission denied'
  ],
  lifecycle: [
    'Session started',
    'New project initialized',
    'User connected',
    'Session ended',
    'Context switched'
  ]
};

let sessionColorIndex = 0;
const sessionColorMap = new Map<string, string>();

function getSessionColor(sessionId: string): string {
  if (!sessionColorMap.has(sessionId)) {
    sessionColorMap.set(sessionId, SESSION_COLORS[sessionColorIndex % SESSION_COLORS.length]);
    sessionColorIndex++;
  }
  return sessionColorMap.get(sessionId)!;
}

function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function generateSessionId(): string {
  return `session-${Math.random().toString(36).substring(2, 9)}`;
}

function generateEventId(): string {
  return `event-${Math.random().toString(36).substring(2, 11)}`;
}

export function generateMockSession(): SessionData {
  const sessionId = generateSessionId();
  return {
    id: sessionId,
    status: getRandomItem(['active', 'idle', 'completed']),
    startedAt: new Date(Date.now() - Math.random() * 86400000), // Within last 24 hours
    projectName: getRandomItem(PROJECT_NAMES),
    color: getSessionColor(sessionId)
  };
}

export function generateMockEvent(sessionId?: string): EventData {
  const eventType = getRandomItem(['success', 'tool_use', 'file_op', 'error', 'lifecycle'] as const);
  const session = sessionId || generateSessionId();
  
  const baseEvent: EventData = {
    id: generateEventId(),
    timestamp: new Date(Date.now() - Math.random() * 3600000), // Within last hour
    type: eventType,
    session_id: session,
    summary: getRandomItem(EVENT_SUMMARIES[eventType]),
    success: eventType === 'success' || (eventType !== 'error' && Math.random() > 0.2)
  };

  // Add type-specific details
  switch (eventType) {
    case 'tool_use':
      baseEvent.toolName = getRandomItem(TOOL_NAMES);
      baseEvent.details = {
        tool_name: baseEvent.toolName,
        parameters: { file_path: '/src/components/Example.tsx' },
        duration_ms: Math.floor(Math.random() * 1000) + 100
      };
      break;
    case 'file_op':
      baseEvent.details = {
        operation: getRandomItem(['create', 'update', 'delete', 'rename']),
        file_path: `/src/${getRandomItem(['components', 'lib', 'hooks'])}/${getRandomItem(['Example', 'Utils', 'Helper'])}.${getRandomItem(['tsx', 'ts', 'js'])}`,
        size_bytes: Math.floor(Math.random() * 10000) + 100
      };
      break;
    case 'error':
      baseEvent.details = {
        error_code: getRandomItem(['ENOENT', 'EACCES', 'TIMEOUT', 'VALIDATION_ERROR']),
        message: getRandomItem(['File not found', 'Permission denied', 'Request timeout', 'Invalid input']),
        stack_trace: 'Error: Sample error\n  at Function.example\n  at process.nextTick'
      };
      break;
    case 'lifecycle':
      baseEvent.details = {
        event: getRandomItem(['session_start', 'session_end', 'context_switch', 'user_connect']),
        metadata: { user_agent: 'Claude Code v1.0', platform: 'darwin' }
      };
      break;
    default:
      baseEvent.details = {
        result: 'Operation completed',
        metadata: { timestamp: baseEvent.timestamp.toISOString() }
      };
  }

  return baseEvent;
}

export function generateMockEvents(count: number, sessionIds?: string[]): EventData[] {
  const events: EventData[] = [];
  const sessions = sessionIds || [generateSessionId(), generateSessionId(), generateSessionId()];
  
  for (let i = 0; i < count; i++) {
    const sessionId = getRandomItem(sessions);
    events.push(generateMockEvent(sessionId));
  }
  
  // Sort by timestamp (most recent first)
  return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

export function generateMockSessions(count: number): SessionData[] {
  const sessions: SessionData[] = [];
  for (let i = 0; i < count; i++) {
    sessions.push(generateMockSession());
  }
  return sessions;
}

// Predefined datasets for consistent testing
export const MOCK_EVENTS_SMALL = generateMockEvents(10);
export const MOCK_EVENTS_MEDIUM = generateMockEvents(50);
export const MOCK_EVENTS_LARGE = generateMockEvents(200);

export const MOCK_SESSIONS = generateMockSessions(5);

// Helper function to create events with specific characteristics for testing
export function createMockEventWithProps(overrides: Partial<EventData>): EventData {
  const baseEvent = generateMockEvent();
  return { ...baseEvent, ...overrides };
}

// Create a realistic stream of events for demo purposes
export function generateRealtimeEventStream(): EventData[] {
  const sessions = MOCK_SESSIONS.map(s => s.id);
  const events: EventData[] = [];
  
  // Generate events with realistic timing patterns
  const now = new Date();
  for (let i = 0; i < 20; i++) {
    const timestamp = new Date(now.getTime() - (i * 30000) - Math.random() * 30000); // Spread over last 10-15 minutes
    events.push({
      ...generateMockEvent(getRandomItem(sessions)),
      timestamp
    });
  }
  
  return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

// Filter helpers for testing different scenarios
export function getMockErrorEvents(): EventData[] {
  return MOCK_EVENTS_MEDIUM.filter(event => event.type === 'error');
}

export function getMockSuccessEvents(): EventData[] {
  return MOCK_EVENTS_MEDIUM.filter(event => event.type === 'success');
}

export function getMockEventsForSession(sessionId: string): EventData[] {
  return MOCK_EVENTS_MEDIUM.filter(event => event.session_id === sessionId);
}