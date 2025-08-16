// Mock data utilities for Chronicle Dashboard development and testing

export interface EventData {
  id: string;
  timestamp: Date;
  type: 'session_start' | 'pre_tool_use' | 'post_tool_use' | 'user_prompt_submit' | 'stop' | 'subagent_stop' | 'pre_compact' | 'notification' | 'error';
  session_id: string;
  summary: string;
  details?: Record<string, any>;
  tool_name?: string;
  duration_ms?: number;
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
  session_start: [
    'Session started for chronicle-dashboard',
    'New development session initiated',
    'Project session began',
    'Development environment ready',
    'Claude Code session active'
  ],
  pre_tool_use: [
    'Preparing to read configuration file',
    'About to edit component source',
    'Ready to run shell command',
    'Starting codebase search',
    'Preparing file operation'
  ],
  post_tool_use: [
    'File read operation completed',
    'Component edit finished successfully',
    'Shell command executed',
    'Search operation completed',
    'File write operation finished'
  ],
  user_prompt_submit: [
    'User submitted new request',
    'Prompt received from user',
    'New instruction provided',
    'User input processed',
    'Request submitted for processing'
  ],
  stop: [
    'Main agent execution completed',
    'Request processing finished',
    'Task execution stopped',
    'Agent reached completion',
    'Response generation finished'
  ],
  subagent_stop: [
    'Subagent task completed',
    'Background process finished',
    'Subtask execution stopped',
    'Worker agent completed',
    'Parallel task finished'
  ],
  pre_compact: [
    'Preparing context compaction',
    'Ready to compact conversation',
    'Context optimization starting',
    'Memory management initiated',
    'Conversation summarization ready'
  ],
  notification: [
    'Permission required for tool execution',
    'Waiting for user input',
    'Action confirmation needed',
    'User attention required',
    'Interactive prompt displayed'
  ],
  error: [
    'Failed to read file',
    'Command execution failed',
    'Network request timeout',
    'Validation error',
    'Permission denied'
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
  // Generate UUID format session ID to match backend
  return crypto.randomUUID();
}

function generateEventId(): string {
  // Generate UUID format event ID to match backend
  return crypto.randomUUID();
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
  const eventType = getRandomItem(['session_start', 'pre_tool_use', 'post_tool_use', 'user_prompt_submit', 'stop', 'subagent_stop', 'pre_compact', 'notification', 'error'] as const);
  const session = sessionId || generateSessionId();
  
  const baseEvent: EventData = {
    id: generateEventId(),
    timestamp: new Date(Date.now() - Math.random() * 3600000), // Within last hour
    type: eventType,
    session_id: session,
    summary: getRandomItem(EVENT_SUMMARIES[eventType]),
    success: eventType !== 'error' && Math.random() > 0.1 // Most events succeed unless they're errors
  };

  // Add type-specific details and fields
  switch (eventType) {
    case 'session_start':
      baseEvent.details = {
        source: getRandomItem(['startup', 'resume', 'clear']),
        project_path: `/Users/dev/${getRandomItem(PROJECT_NAMES)}`,
        git_branch: getRandomItem(['main', 'dev', 'feature/new-dashboard', 'bugfix/event-types']),
        metadata: { user_agent: 'Claude Code v1.0', platform: 'darwin' }
      };
      break;
    case 'pre_tool_use':
      baseEvent.tool_name = getRandomItem(TOOL_NAMES);
      baseEvent.details = {
        tool_name: baseEvent.tool_name,
        tool_input: {
          file_path: `/src/${getRandomItem(['components', 'lib', 'hooks'])}/${getRandomItem(['Example', 'Utils', 'Helper'])}.${getRandomItem(['tsx', 'ts', 'js'])}`,
          parameters: { content: 'example content' }
        },
        session_id: session,
        transcript_path: `~/.claude/projects/chronicle/${session}.jsonl`,
        cwd: `/Users/dev/${getRandomItem(PROJECT_NAMES)}`
      };
      break;
    case 'post_tool_use':
      baseEvent.tool_name = getRandomItem(TOOL_NAMES);
      baseEvent.duration_ms = Math.floor(Math.random() * 2000) + 50; // 50-2050ms
      baseEvent.details = {
        tool_name: baseEvent.tool_name,
        tool_input: {
          file_path: `/src/${getRandomItem(['components', 'lib', 'hooks'])}/${getRandomItem(['Example', 'Utils', 'Helper'])}.${getRandomItem(['tsx', 'ts', 'js'])}`,
          parameters: { content: 'example content' }
        },
        tool_response: {
          success: baseEvent.success,
          result: baseEvent.success ? 'Operation completed successfully' : 'Operation failed',
          file_path: `/src/${getRandomItem(['components', 'lib', 'hooks'])}/${getRandomItem(['Example', 'Utils', 'Helper'])}.${getRandomItem(['tsx', 'ts', 'js'])}`
        },
        duration_ms: baseEvent.duration_ms,
        session_id: session
      };
      break;
    case 'user_prompt_submit':
      baseEvent.details = {
        prompt: getRandomItem([
          'Update the dashboard to show real-time events',
          'Fix the event filtering bug',
          'Add dark mode to the interface',
          'Implement session analytics',
          'Create a performance monitoring dashboard'
        ]),
        session_id: session,
        transcript_path: `~/.claude/projects/chronicle/${session}.jsonl`,
        cwd: `/Users/dev/${getRandomItem(PROJECT_NAMES)}`
      };
      break;
    case 'stop':
      baseEvent.details = {
        stop_reason: getRandomItem(['completion', 'user_interrupt', 'timeout', 'error']),
        session_id: session,
        final_status: baseEvent.success ? 'completed' : 'error'
      };
      break;
    case 'subagent_stop':
      baseEvent.details = {
        subagent_task: getRandomItem(['file_analysis', 'code_review', 'testing', 'documentation']),
        stop_reason: 'task_completed',
        session_id: session,
        task_result: baseEvent.success ? 'success' : 'failed'
      };
      break;
    case 'pre_compact':
      baseEvent.details = {
        trigger: getRandomItem(['manual', 'auto']),
        context_size: Math.floor(Math.random() * 50000) + 10000, // 10k-60k tokens
        session_id: session,
        custom_instructions: ''
      };
      break;
    case 'notification':
      baseEvent.details = {
        message: getRandomItem([
          'Claude needs your permission to use Bash',
          'Claude is waiting for your input',
          'Tool execution requires confirmation',
          'Session has been idle for 60 seconds'
        ]),
        notification_type: getRandomItem(['permission_request', 'idle_warning', 'confirmation']),
        session_id: session
      };
      break;
    case 'error':
      baseEvent.success = false;
      baseEvent.details = {
        error_code: getRandomItem(['ENOENT', 'EACCES', 'TIMEOUT', 'VALIDATION_ERROR', 'NETWORK_ERROR']),
        error_message: getRandomItem(['File not found', 'Permission denied', 'Request timeout', 'Invalid input', 'Network connection failed']),
        stack_trace: 'Error: Sample error\n  at Function.example\n  at process.nextTick',
        session_id: session,
        context: { tool_name: getRandomItem(TOOL_NAMES), timestamp: baseEvent.timestamp.toISOString() }
      };
      break;
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

export function getMockToolEvents(): EventData[] {
  return MOCK_EVENTS_MEDIUM.filter(event => event.type === 'pre_tool_use' || event.type === 'post_tool_use');
}

export function getMockSessionEvents(): EventData[] {
  return MOCK_EVENTS_MEDIUM.filter(event => event.type === 'session_start');
}

export function getMockEventsForSession(sessionId: string): EventData[] {
  return MOCK_EVENTS_MEDIUM.filter(event => event.session_id === sessionId);
}