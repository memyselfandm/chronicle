import { EventType, isValidEventType } from '../src/types/filters';
import { Event, Session } from '../src/types/events';

describe('Database Types', () => {
  describe('EventType', () => {
    it('should include all required event types', () => {
      // EventType is now a string union, not an enum
      const eventTypes: EventType[] = [
        'session_start',
        'pre_tool_use', 
        'post_tool_use',
        'user_prompt_submit',
        'stop',
        'subagent_stop',
        'pre_compact',
        'notification',
        'error'
      ];
      
      expect(eventTypes).toContain('session_start');
      expect(eventTypes).toContain('post_tool_use');
      expect(eventTypes).toContain('user_prompt_submit');
    });

    it('should validate event types correctly', () => {
      expect(isValidEventType('user_prompt_submit')).toBe(true);
      expect(isValidEventType('post_tool_use')).toBe(true);
      expect(isValidEventType('session_start')).toBe(true);
      expect(isValidEventType('error')).toBe(true);
      expect(isValidEventType('invalid_type')).toBe(false);
      expect(isValidEventType('')).toBe(false);
      expect(isValidEventType(undefined as any)).toBe(false);
    });
  });

  describe('Session interface', () => {
    it('should create valid session object', () => {
      const session: Session = {
        id: crypto.randomUUID(),
        claude_session_id: crypto.randomUUID(),
        project_path: '/path/to/project',
        git_branch: 'main',
        start_time: '2024-01-01T00:00:00Z',
        end_time: '2024-01-01T01:00:00Z',
        metadata: { status: 'active' },
        created_at: '2024-01-01T00:00:00Z',
      };

      expect(session.id).toBeDefined();
      expect(session.metadata.status).toBe('active');
      expect(session.end_time).toBeDefined();
    });
  });

  describe('Event interface', () => {
    it('should create valid event object with JSONB data', () => {
      const event: Event = {
        id: crypto.randomUUID(),
        session_id: crypto.randomUUID(),
        event_type: 'post_tool_use',
        tool_name: 'read_file',
        duration_ms: 150,
        timestamp: '2024-01-01T00:00:00Z',
        metadata: {
          parameters: { file_path: '/test.txt' },
          result: { success: true },
        },
        created_at: '2024-01-01T00:00:00Z',
      };

      expect(event.event_type).toBe('post_tool_use');
      expect(event.tool_name).toBe('read_file');
      expect(event.metadata).toHaveProperty('parameters');
      expect(event.metadata).toHaveProperty('result');
    });
  });

  // Helper functions have been removed in the new architecture
  // Event and Session creation is now handled by the application layer
});