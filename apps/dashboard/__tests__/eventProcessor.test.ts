import {
  processEvent,
  sanitizeEventData,
  validateEventData,
  groupEventsBySession,
  deduplicateEvents,
  batchEvents,
  EventProcessor,
} from '../src/lib/eventProcessor';
import { Event } from '../src/types/events';

describe('Event Processor', () => {
  const mockEvent: Event = {
    id: crypto.randomUUID(),
    session_id: crypto.randomUUID(),
    event_type: 'post_tool_use',
    tool_name: 'read_file',
    duration_ms: 150,
    timestamp: '2024-01-01T00:00:00Z',
    metadata: {
      parameters: { file_path: '/sensitive/path.txt' },
      result: { success: true, content: 'secret data' },
    },
    created_at: '2024-01-01T00:00:00Z',
  };

  describe('processEvent', () => {
    it('should transform and validate event data', () => {
      const processed = processEvent(mockEvent);

      expect(processed.id).toBe(mockEvent.id);
      expect(processed.event_type).toBe(mockEvent.event_type);
      expect(processed.metadata).toBeDefined();
    });

    it('should handle invalid events gracefully', () => {
      const invalidEvent = { ...mockEvent, event_type: 'invalid_type' as any };
      const processed = processEvent(invalidEvent);

      expect(processed).toBeNull();
    });
  });

  describe('sanitizeEventData', () => {
    it('should remove sensitive data fields', () => {
      const sensitiveData = {
        tool_name: 'read_file',
        parameters: {
          file_path: '/sensitive/path.txt',
          password: 'secret123',
          api_key: 'sk-1234567890',
        },
        result: {
          success: true,
          content: 'file content',
          token: 'bearer-token',
        },
      };

      const sanitized = sanitizeEventData(sensitiveData);

      expect(sanitized.parameters.password).toBe('[REDACTED]');
      expect(sanitized.parameters.api_key).toBe('[REDACTED]');
      expect(sanitized.result.token).toBe('[REDACTED]');
      expect(sanitized.tool_name).toBe('read_file');
      expect(sanitized.parameters.file_path).toBe('/sensitive/path.txt');
    });

    it('should handle nested objects', () => {
      const nestedData = {
        config: {
          auth: {
            password: 'secret',
            username: 'user',
          },
          settings: {
            debug: true,
          },
        },
      };

      const sanitized = sanitizeEventData(nestedData);

      // The 'auth' key is sensitive, so the entire auth object should be redacted
      expect(sanitized.config.auth).toBe('[REDACTED]');
      expect(sanitized.config.settings.debug).toBe(true);
    });
  });

  describe('validateEventData', () => {
    it('should validate correct event structure', () => {
      expect(validateEventData(mockEvent)).toBe(true);
    });

    it('should reject events with missing required fields', () => {
      const invalidEvent = { ...mockEvent };
      delete invalidEvent.id;

      expect(validateEventData(invalidEvent)).toBe(false);
    });

    it('should reject events with invalid timestamps', () => {
      const invalidEvent = { ...mockEvent, timestamp: 'invalid-date' as any };

      expect(validateEventData(invalidEvent)).toBe(false);
    });

    it('should reject events with invalid event types', () => {
      const invalidEvent = { ...mockEvent, event_type: 'invalid_type' as any };

      expect(validateEventData(invalidEvent)).toBe(false);
    });
  });

  describe('groupEventsBySession', () => {
    it('should group events by session_id', () => {
      const events: Event[] = [
        { ...mockEvent, session_id: 'session-1' },
        { ...mockEvent, id: crypto.randomUUID(), session_id: crypto.randomUUID() },
        { ...mockEvent, id: crypto.randomUUID(), session_id: mockEvent.session_id },
      ];

      const grouped = groupEventsBySession(events);

      expect(grouped.size).toBe(2);
      expect(grouped.get(mockEvent.session_id)).toHaveLength(2);
      expect(grouped.has(mockEvent.session_id)).toBe(true);
    });

    it('should handle empty events array', () => {
      const grouped = groupEventsBySession([]);

      expect(grouped.size).toBe(0);
    });
  });

  describe('deduplicateEvents', () => {
    it('should remove duplicate events by id', () => {
      const events: Event[] = [
        mockEvent,
        { ...mockEvent, metadata: { different: 'data' } }, // Same ID
        { ...mockEvent, id: crypto.randomUUID() },
      ];

      const deduplicated = deduplicateEvents(events);

      expect(deduplicated).toHaveLength(2);
      expect(deduplicated.find(e => e.id === mockEvent.id)).toBe(mockEvent); // First occurrence kept
    });

    it('should handle empty array', () => {
      const deduplicated = deduplicateEvents([]);

      expect(deduplicated).toEqual([]);
    });
  });

  describe('batchEvents', () => {
    const batchProcessor = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should batch events and process them after delay', () => {
      const batch = batchEvents(batchProcessor, { delay: 100, maxSize: 5 });

      batch.addEvent(mockEvent);
      expect(batchProcessor).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(batchProcessor).toHaveBeenCalledWith([mockEvent]);
    });

    it('should process immediately when batch size is reached', () => {
      const batch = batchEvents(batchProcessor, { delay: 100, maxSize: 2 });

      batch.addEvent(mockEvent);
      batch.addEvent({ ...mockEvent, id: '2' });

      expect(batchProcessor).toHaveBeenCalledWith([
        mockEvent,
        { ...mockEvent, id: crypto.randomUUID() },
      ]);
    });

    it('should allow manual flush', () => {
      const batch = batchEvents(batchProcessor, { delay: 100, maxSize: 5 });

      batch.addEvent(mockEvent);
      batch.flush();

      expect(batchProcessor).toHaveBeenCalledWith([mockEvent]);
    });
  });

  describe('EventProcessor class', () => {
    let processor: EventProcessor;

    beforeEach(() => {
      processor = new EventProcessor();
    });

    it('should process events with transformation and sanitization', () => {
      const rawEvent = {
        ...mockEvent,
        tool_name: 'write_file',
        metadata: {
          parameters: { content: 'test', password: 'secret' },
        },
      };

      const processed = processor.process(rawEvent);

      expect(processed).toBeDefined();
      expect(processed!.metadata.parameters.password).toBe('[REDACTED]');
    });

    it('should reject invalid events', () => {
      const invalidEvent = { ...mockEvent, id: undefined as any };

      const processed = processor.process(invalidEvent);

      expect(processed).toBeNull();
    });

    it('should track processing metrics', () => {
      processor.process(mockEvent);
      processor.process({ ...mockEvent, id: undefined as any }); // Invalid

      const metrics = processor.getMetrics();

      expect(metrics.totalProcessed).toBe(2);
      expect(metrics.successCount).toBe(1);
      expect(metrics.errorCount).toBe(1);
    });

    it('should provide batch processing', () => {
      const events = [
        mockEvent,
        { ...mockEvent, id: crypto.randomUUID() },
        { ...mockEvent, id: crypto.randomUUID() },
      ];

      const processed = processor.processBatch(events);

      expect(processed).toHaveLength(3);
      expect(processed.every(e => e !== null)).toBe(true);
    });
  });
});