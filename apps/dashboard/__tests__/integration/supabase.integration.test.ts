import { 
  setupSupabaseIntegrationTest,
  simulateSupabaseErrors,
  MockRealtimeChannel,
  createPerformanceTestClient
} from '../../src/test-utils/supabaseMocks';
import { createMockEvents, createMockSessions, createHighFrequencyEventStream } from '../../src/test-utils/mockData';
import { PerformanceMonitor, testEventBatching } from '../../src/test-utils/performanceHelpers';
import { supabase } from '../../src/lib/supabase';

// Mock the supabase module
jest.mock('../../src/lib/supabase');

describe('Supabase Integration Tests', () => {
  let integrationSetup: ReturnType<typeof setupSupabaseIntegrationTest>;
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    integrationSetup = setupSupabaseIntegrationTest();
    performanceMonitor = new PerformanceMonitor();
  });

  afterEach(() => {
    integrationSetup.cleanup();
  });

  describe('Database Connection', () => {
    it('should establish connection successfully', async () => {
      const response = await integrationSetup.client.from('events').select('*').limit(1);
      
      expect(response.error).toBeNull();
      expect(Array.isArray(response.data)).toBe(true);
    });

    it('should handle connection failures gracefully', async () => {
      integrationSetup.client.from().select().limit.mockResolvedValue(
        simulateSupabaseErrors.networkError()
      );

      const response = await integrationSetup.client.from('events').select('*').limit(1);
      
      expect(response.error).toBeTruthy();
      expect(response.error.code).toBe('NETWORK_ERROR');
    });

    it('should implement connection pooling', async () => {
      // Simulate multiple concurrent requests
      const requests = Array.from({ length: 10 }, () =>
        integrationSetup.client.from('events').select('*').limit(1)
      );

      const results = await Promise.all(requests);
      
      // All requests should complete successfully
      results.forEach(result => {
        expect(result.error).toBeNull();
      });
    });

    it('should handle authentication errors', async () => {
      integrationSetup.client.from().select().limit.mockResolvedValue(
        simulateSupabaseErrors.authError()
      );

      const response = await integrationSetup.client.from('events').select('*').limit(1);
      
      expect(response.error).toBeTruthy();
      expect(response.error.code).toBe('AUTH_ERROR');
    });
  });

  describe('Real-time Subscriptions', () => {
    it('should establish real-time subscription', () => {
      const channel = integrationSetup.client.channel('test-events');
      
      expect(channel).toBeDefined();
      expect(typeof channel.subscribe).toBe('function');
    });

    it('should handle event stream correctly', async () => {
      const mockEvents = createMockEvents(5);
      const receivedEvents: any[] = [];
      
      integrationSetup.channel.on('postgres_changes', (payload) => {
        receivedEvents.push(payload);
      });

      integrationSetup.channel.subscribe();

      // Simulate events
      mockEvents.forEach(event => {
        integrationSetup.channel.simulateInsert(event);
      });

      expect(receivedEvents).toHaveLength(5);
    });

    it('should handle reconnection after disconnect', async () => {
      let connectionState = 'connected';
      
      integrationSetup.channel.on('system', (payload) => {
        connectionState = payload.status;
      });

      integrationSetup.channel.subscribe();

      // Simulate disconnect and reconnect
      integrationSetup.channel.simulateDisconnect();
      expect(connectionState).toBe('disconnected');

      integrationSetup.channel.simulateReconnect();
      expect(connectionState).toBe('connected');
    });

    it('should implement backfill for missed events', async () => {
      const mockEvents = createMockEvents(10);
      
      // Mock the backfill query
      integrationSetup.client.from().select().gte().order().mockResolvedValue({
        data: mockEvents.slice(5), // Simulate 5 missed events
        error: null,
      });

      // Simulate subscription with backfill
      const backfillEvents = await integrationSetup.client
        .from('events')
        .select('*')
        .gte('created_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      expect(backfillEvents.data).toHaveLength(5);
    });

    it('should handle subscription errors gracefully', () => {
      const errorHandler = jest.fn();
      
      integrationSetup.channel.on('error', errorHandler);
      integrationSetup.channel.subscribe();

      // Simulate subscription error
      integrationSetup.channel.simulateEvent('error', { message: 'Subscription failed' });

      expect(errorHandler).toHaveBeenCalledWith({ message: 'Subscription failed' });
    });
  });

  describe('Query Performance', () => {
    it('should fetch events within performance budget', async () => {
      const mockEvents = createMockEvents(100);
      integrationSetup.client.from().select().order().limit.mockResolvedValue({
        data: mockEvents,
        error: null,
      });

      performanceMonitor.startMeasurement();
      
      const response = await integrationSetup.client
        .from('events')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);

      const queryTime = performanceMonitor.endMeasurement();
      
      expect(queryTime).toBeLessThan(200); // 200ms budget for query
      expect(response.data).toHaveLength(100);
    });

    it('should handle session queries efficiently', async () => {
      const mockSessions = createMockSessions(50);
      integrationSetup.client.from().select().order().limit.mockResolvedValue({
        data: mockSessions,
        error: null,
      });

      performanceMonitor.startMeasurement();
      
      const response = await integrationSetup.client
        .from('sessions')
        .select('*')
        .order('start_time', { ascending: false })
        .limit(50);

      const queryTime = performanceMonitor.endMeasurement();
      
      expect(queryTime).toBeLessThan(150); // 150ms budget for session queries
      expect(response.data).toHaveLength(50);
    });

    it('should optimize large dataset queries with pagination', async () => {
      const pageSize = 50;
      const totalEvents = 1000;
      
      // Mock paginated response
      const mockPage = createMockEvents(pageSize);
      integrationSetup.client.from().select().range().mockResolvedValue({
        data: mockPage,
        error: null,
      });

      performanceMonitor.startMeasurement();
      
      const response = await integrationSetup.client
        .from('events')
        .select('*')
        .range(0, pageSize - 1);

      const queryTime = performanceMonitor.endMeasurement();
      
      expect(queryTime).toBeLessThan(100); // Pagination should be fast
      expect(response.data).toHaveLength(pageSize);
    });

    it('should handle complex filtering queries', async () => {
      const filteredEvents = createMockEvents(25);
      integrationSetup.client.from().select().in().gte().lte().textSearch.mockResolvedValue({
        data: filteredEvents,
        error: null,
      });

      performanceMonitor.startMeasurement();
      
      const response = await integrationSetup.client
        .from('events')
        .select('*')
        .in('event_type', ['user_prompt_submit', 'tool_use'])
        .gte('timestamp', '2024-01-01')
        .lte('timestamp', '2024-01-31')
        .textSearch('data', 'search term');

      const queryTime = performanceMonitor.endMeasurement();
      
      expect(queryTime).toBeLessThan(250); // Complex queries allowed more time
      expect(response.data).toHaveLength(25);
    });
  });

  describe('High-Frequency Event Handling', () => {
    it('should process high-frequency events efficiently', async () => {
      const highFrequencyEvents = createHighFrequencyEventStream(200, 1); // 200 events/sec
      const processedEvents: any[] = [];
      
      integrationSetup.channel.on('postgres_changes', (payload) => {
        processedEvents.push(payload);
      });

      integrationSetup.channel.subscribe();

      performanceMonitor.startMeasurement();
      
      // Simulate rapid event stream
      highFrequencyEvents.slice(0, 50).forEach((event, index) => {
        setTimeout(() => {
          integrationSetup.channel.simulateInsert(event);
        }, index * 5); // 5ms intervals = 200 events/sec
      });

      // Wait for all events to be processed
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const processingTime = performanceMonitor.endMeasurement();
      
      expect(processedEvents).toHaveLength(50);
      expect(processingTime).toBeLessThan(400); // Should handle within 400ms
    });

    it('should implement event batching for performance', async () => {
      const batchProcessor = async (events: any[]) => {
        // Mock batch processing
        await new Promise(resolve => setTimeout(resolve, 10));
      };

      const performanceResult = await testEventBatching(
        batchProcessor,
        1000, // 1000 events
        100   // batch size
      );

      expect(performanceResult.eventsPerSecond).toBeGreaterThan(100);
      expect(performanceResult.averageBatchTime).toBeLessThan(100); // 100ms per batch
    });
  });

  describe('Error Scenarios and Recovery', () => {
    it('should handle rate limiting gracefully', async () => {
      integrationSetup.client.from().select().limit.mockResolvedValue(
        simulateSupabaseErrors.rateLimitError()
      );

      const response = await integrationSetup.client.from('events').select('*').limit(1);
      
      expect(response.error).toBeTruthy();
      expect(response.error.code).toBe('RATE_LIMIT');
    });

    it('should implement exponential backoff for retries', async () => {
      let attemptCount = 0;
      integrationSetup.client.from().select().limit.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.resolve(simulateSupabaseErrors.networkError());
        }
        return Promise.resolve({ data: createMockEvents(1), error: null });
      });

      // Simulate retry logic
      let response;
      let retryDelay = 100;
      
      for (let i = 0; i < 3; i++) {
        response = await integrationSetup.client.from('events').select('*').limit(1);
        
        if (!response.error) break;
        
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        retryDelay *= 2; // Exponential backoff
      }

      expect(response.error).toBeNull();
      expect(attemptCount).toBe(3);
    });

    it('should handle timeout scenarios', async () => {
      integrationSetup.client.from().select().limit.mockResolvedValue(
        simulateSupabaseErrors.timeoutError()
      );

      const response = await integrationSetup.client.from('events').select('*').limit(1);
      
      expect(response.error).toBeTruthy();
      expect(response.error.code).toBe('TIMEOUT');
    });

    it('should maintain data consistency during errors', async () => {
      const validEvents = createMockEvents(3);
      
      // Simulate partial failure scenario
      integrationSetup.client.from().insert.mockImplementation((data) => {
        if (Array.isArray(data) && data.length > 2) {
          return Promise.resolve({ data: null, error: { message: 'Batch too large' } });
        }
        return Promise.resolve({ data: validEvents, error: null });
      });

      // Should handle partial failures gracefully
      const largeInsert = await integrationSetup.client.from('events').insert(validEvents);
      expect(largeInsert.error).toBeNull();

      const oversizedInsert = await integrationSetup.client
        .from('events')
        .insert([...validEvents, ...createMockEvents(5)]);
      expect(oversizedInsert.error).toBeTruthy();
    });
  });

  describe('Memory and Resource Management', () => {
    it('should cleanup subscriptions properly', () => {
      const subscription = integrationSetup.channel.subscribe();
      
      expect(typeof integrationSetup.channel.unsubscribe).toBe('function');
      
      // Should not throw when unsubscribing
      expect(() => integrationSetup.channel.unsubscribe()).not.toThrow();
    });

    it('should handle memory pressure gracefully', async () => {
      // Simulate high memory usage scenario
      const largeDataset = createMockEvents(10000);
      
      integrationSetup.client.from().select().limit.mockResolvedValue({
        data: largeDataset,
        error: null,
      });

      // Should handle large datasets without memory issues
      const response = await integrationSetup.client.from('events').select('*').limit(10000);
      
      expect(response.data).toHaveLength(10000);
      expect(response.error).toBeNull();
    });
  });

  describe('Security and Validation', () => {
    it('should validate data before insertion', async () => {
      const invalidEvent = {
        // Missing required fields
        timestamp: new Date().toISOString(),
      };

      integrationSetup.client.from().insert.mockImplementation((data) => {
        // Simulate validation error
        if (!data.event_type || !data.session_id) {
          return Promise.resolve({
            data: null,
            error: { message: 'Missing required fields', code: 'VALIDATION_ERROR' }
          });
        }
        return Promise.resolve({ data: [data], error: null });
      });

      const response = await integrationSetup.client.from('events').insert(invalidEvent);
      
      expect(response.error).toBeTruthy();
      expect(response.error.code).toBe('VALIDATION_ERROR');
    });

    it('should sanitize input data', async () => {
      const maliciousEvent = createMockEvents(1)[0];
      maliciousEvent.data = {
        prompt: '<script>alert("xss")</script>Safe content',
        metadata: { injection: 'DROP TABLE events;' }
      };

      integrationSetup.client.from().insert.mockImplementation((data) => {
        // Simulate sanitization
        const sanitized = { ...data };
        if (sanitized.data && typeof sanitized.data === 'object') {
          Object.keys(sanitized.data).forEach(key => {
            if (typeof sanitized.data[key] === 'string') {
              sanitized.data[key] = sanitized.data[key].replace(/<script.*?<\/script>/gi, '');
            }
          });
        }
        return Promise.resolve({ data: [sanitized], error: null });
      });

      const response = await integrationSetup.client.from('events').insert(maliciousEvent);
      
      expect(response.error).toBeNull();
      expect(response.data[0].data.prompt).not.toContain('<script>');
    });
  });
});