/**
 * Event types enum for type safety
 */
export enum EventType {
  PROMPT = 'prompt',
  TOOL_USE = 'tool_use',
  SESSION_START = 'session_start',
  SESSION_END = 'session_end',
}

/**
 * Type guard to check if a string is a valid EventType
 */
export const isValidEventType = (type: any): type is EventType => {
  return Object.values(EventType).includes(type);
};

/**
 * Session interface matching database schema
 */
export interface Session {
  id: string;
  project_path: string;
  git_branch: string | null;
  start_time: Date;
  end_time: Date | null;
  status: 'active' | 'completed' | 'error';
  event_count: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Event interface with proper JSONB data typing
 */
export interface Event {
  id: string;
  session_id: string;
  type: EventType;
  timestamp: Date;
  data: Record<string, any>; // JSONB data - flexible structure
  created_at: Date;
}

/**
 * Database schema type for Supabase client
 */
export interface Database {
  public: {
    Tables: {
      sessions: {
        Row: Session;
        Insert: Omit<Session, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Session, 'id' | 'created_at'>>;
      };
      events: {
        Row: Event;
        Insert: Omit<Event, 'id' | 'created_at'>;
        Update: Partial<Omit<Event, 'id' | 'created_at'>>;
      };
    };
  };
}

/**
 * Helper function to create a new event with generated ID and timestamps
 */
export const createEvent = (
  data: Omit<Event, 'id' | 'timestamp' | 'created_at'>
): Event => {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    timestamp: now,
    created_at: now,
    ...data,
  };
};

/**
 * Helper function to create a new session with generated ID and timestamps
 */
export const createSession = (
  data: Pick<Session, 'project_path' | 'git_branch'>
): Session => {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    start_time: now,
    end_time: null,
    status: 'active',
    event_count: 0,
    created_at: now,
    updated_at: now,
    ...data,
  };
};

/**
 * Event data structures for different event types
 */
export interface PromptEventData {
  message: string;
  context?: Record<string, any>;
}

export interface ToolUseEventData {
  tool_name: string;
  parameters: Record<string, any>;
  result?: Record<string, any>;
  success?: boolean;
  error?: string;
  duration_ms?: number;
}

export interface SessionEventData {
  action: 'start' | 'end';
  metadata?: Record<string, any>;
}

/**
 * Filter state for dashboard queries
 */
export interface FilterState {
  sessionIds: string[];
  eventTypes: EventType[];
  searchQuery: string;
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  sourceApps: string[];
}