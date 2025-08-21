import { Event, Session } from '@/types/events';
import { EventType } from '@/types/filters';

/**
 * Database schema type for Supabase client - matches actual schema
 */
export interface Database {
  public: {
    Tables: {
      chronicle_sessions: {
        Row: {
          id: string;
          claude_session_id: string;
          project_path: string | null;
          git_branch: string | null;
          start_time: string;
          end_time: string | null;
          metadata: Record<string, any>;
          created_at: string;
        };
        Insert: {
          id?: string;
          claude_session_id: string;
          project_path?: string | null;
          git_branch?: string | null;
          start_time?: string;
          end_time?: string | null;
          metadata?: Record<string, any>;
        };
        Update: {
          id?: string;
          claude_session_id?: string;
          project_path?: string | null;
          git_branch?: string | null;
          start_time?: string;
          end_time?: string | null;
          metadata?: Record<string, any>;
        };
      };
      chronicle_events: {
        Row: {
          id: string;
          session_id: string;
          event_type: string;
          timestamp: string;
          metadata: Record<string, any>;
          tool_name: string | null;
          duration_ms: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          event_type: string;
          timestamp?: string;
          metadata?: Record<string, any>;
          tool_name?: string | null;
          duration_ms?: number | null;
        };
        Update: {
          id?: string;
          session_id?: string;
          event_type?: string;
          timestamp?: string;
          metadata?: Record<string, any>;
          tool_name?: string | null;
          duration_ms?: number | null;
        };
      };
    };
  };
}

