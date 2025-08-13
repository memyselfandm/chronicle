import { EventType, Session, Event, isValidEventType, createEvent, createSession } from '../src/lib/types';

describe('Database Types', () => {
  describe('EventType', () => {
    it('should include all required event types', () => {
      expect(EventType.PROMPT).toBe('prompt');
      expect(EventType.TOOL_USE).toBe('tool_use');
      expect(EventType.SESSION_START).toBe('session_start');
      expect(EventType.SESSION_END).toBe('session_end');
    });

    it('should validate event types correctly', () => {
      expect(isValidEventType('prompt')).toBe(true);
      expect(isValidEventType('tool_use')).toBe(true);
      expect(isValidEventType('session_start')).toBe(true);
      expect(isValidEventType('session_end')).toBe(true);
      expect(isValidEventType('invalid_type')).toBe(false);
      expect(isValidEventType('')).toBe(false);
      expect(isValidEventType(undefined as any)).toBe(false);
    });
  });

  describe('Session interface', () => {
    it('should create valid session object', () => {
      const session: Session = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        project_path: '/path/to/project',
        git_branch: 'main',
        start_time: new Date('2024-01-01T00:00:00Z'),
        end_time: null,
        status: 'active',
        event_count: 0,
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T00:00:00Z'),
      };

      expect(session.id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(session.status).toBe('active');
      expect(session.end_time).toBeNull();
    });
  });

  describe('Event interface', () => {
    it('should create valid event object with JSONB data', () => {
      const event: Event = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        session_id: '123e4567-e89b-12d3-a456-426614174000',
        type: EventType.TOOL_USE,
        timestamp: new Date('2024-01-01T00:00:00Z'),
        data: {
          tool_name: 'read_file',
          parameters: { file_path: '/test.txt' },
          result: { success: true },
        },
        created_at: new Date('2024-01-01T00:00:00Z'),
      };

      expect(event.type).toBe('tool_use');
      expect(event.data).toHaveProperty('tool_name');
      expect(event.data).toHaveProperty('parameters');
      expect(event.data).toHaveProperty('result');
    });
  });

  describe('Helper functions', () => {
    it('should create event with createEvent helper', () => {
      const eventData = {
        session_id: '123e4567-e89b-12d3-a456-426614174000',
        type: EventType.PROMPT as const,
        data: { message: 'test prompt' },
      };

      const event = createEvent(eventData);

      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeInstanceOf(Date);
      expect(event.created_at).toBeInstanceOf(Date);
      expect(event.session_id).toBe(eventData.session_id);
      expect(event.type).toBe(eventData.type);
      expect(event.data).toEqual(eventData.data);
    });

    it('should create session with createSession helper', () => {
      const sessionData = {
        project_path: '/test/project',
        git_branch: 'feature/test',
      };

      const session = createSession(sessionData);

      expect(session.id).toBeDefined();
      expect(session.start_time).toBeInstanceOf(Date);
      expect(session.created_at).toBeInstanceOf(Date);
      expect(session.updated_at).toBeInstanceOf(Date);
      expect(session.project_path).toBe(sessionData.project_path);
      expect(session.git_branch).toBe(sessionData.git_branch);
      expect(session.status).toBe('active');
      expect(session.event_count).toBe(0);
      expect(session.end_time).toBeNull();
    });
  });
});