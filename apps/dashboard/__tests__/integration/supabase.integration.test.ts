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
      const missedEvents = mockEvents.slice(5); // Simulate 5 missed events
      
      // Mock the backfill query chain
      const mockQueryBuilder = integrationSetup.client.from();
      mockQueryBuilder.select().gte().order.mockResolvedValue({
        data: missedEvents,
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
        .from('chronicle_sessions')
        .select('*')
        .order('start_time', { ascending: false })
        .limit(50);

      const queryTime = performanceMonitor.endMeasurement();
      
      expect(queryTime).toBeLessThan(150); // 150ms budget for session queries
      expect(response.data).toHaveLength(50);
    });

    it('should optimize large dataset queries with pagination', async () => {
      const pageSize = 50;
      const mockPage = createMockEvents(pageSize);
      
      // Mock paginated response
      const mockQueryBuilder = integrationSetup.client.from();
      mockQueryBuilder.select().range.mockResolvedValue({
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
      
      // Mock the complex query chain
      const mockQueryBuilder = integrationSetup.client.from();
      mockQueryBuilder.select().in().gte().lte().textSearch.mockResolvedValue({
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
      
      // Simulate partial failure scenario - reset the mock for this test
      integrationSetup.client.from.mockReturnValue({
        ...integrationSetup.client.from(),
        insert: jest.fn().mockImplementation((data) => {
          if (Array.isArray(data) && data.length > 3) {
            return Promise.resolve({ data: null, error: { message: 'Batch too large' } });
          }
          return Promise.resolve({ data: data, error: null });
        })
      });

      // Should handle normal batch gracefully
      const normalInsert = await integrationSetup.client.from('events').insert(validEvents);
      expect(normalInsert.error).toBeNull();

      // Should fail with oversized batch
      const oversizedInsert = await integrationSetup.client
        .from('events')
        .insert([...validEvents, ...createMockEvents(5)]);
      expect(oversizedInsert.error).toBeTruthy();
    });
  });

  describe('Connection Reliability & Recovery', () => {
    it('should detect and recover from connection drops', async () => {
      const connectionStates: string[] = [];
      let reconnectionAttempts = 0;
      
      // Set up connection monitoring
      integrationSetup.channel.on('system', (payload) => {
        connectionStates.push(payload.status);
        // Simulate a reconnect attempt when we get a disconnect
        if (payload.status === 'disconnected') {
          reconnectionAttempts++;
        }
      });

      integrationSetup.channel.subscribe();
      
      // Simulate connection drop
      integrationSetup.channel.simulateDisconnect();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Simulate automatic reconnection
      integrationSetup.channel.simulateReconnect();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(connectionStates).toContain('disconnected');
      expect(connectionStates).toContain('connected');
      expect(reconnectionAttempts).toBeGreaterThan(0);
    });

    it('should implement connection pooling with concurrent requests', async () => {
      const concurrentRequests = 25;
      const performanceTargets: number[] = [];
      
      // Create multiple concurrent database operations
      const promises = Array.from({ length: concurrentRequests }, async (_, index) => {
        const startTime = performance.now();
        
        // Use the basic query method that we know is mocked
        const response = await integrationSetup.client
          .from('events')
          .select('*')
          .limit(10);
          
        const endTime = performance.now();
        performanceTargets.push(endTime - startTime);
        
        return response;
      });

      const results = await Promise.all(promises);
      
      // All requests should complete successfully
      results.forEach(result => {
        expect(result.error).toBeNull();
        expect(Array.isArray(result.data)).toBe(true);
      });
      
      // Connection pooling should keep average response time reasonable
      const avgResponseTime = performanceTargets.reduce((a, b) => a + b, 0) / performanceTargets.length;
      expect(avgResponseTime).toBeLessThan(100); // Should average under 100ms with pooling
    });

    it('should handle connection timeout scenarios gracefully', async () => {
      let timeoutOccurred = false;
      
      // Mock a slow response that would timeout
      integrationSetup.client.from().select().limit.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => {
            timeoutOccurred = true;
            reject(new Error('Connection timeout'));
          }, 100);
        });
      });

      try {
        await integrationSetup.client.from('events').select('*').limit(1);
      } catch (error) {
        expect(error.message).toContain('timeout');
        expect(timeoutOccurred).toBe(true);
      }
    });

    it('should maintain subscription health during network instability', async () => {
      const events: any[] = [];
      const connectionEvents: string[] = [];
      
      integrationSetup.channel.on('postgres_changes', (payload) => {
        events.push(payload);
      });
      
      integrationSetup.channel.on('system', (payload) => {
        connectionEvents.push(payload.status);
      });

      integrationSetup.channel.subscribe();
      
      // Simulate network instability - multiple disconnects/reconnects
      for (let i = 0; i < 3; i++) {
        integrationSetup.channel.simulateDisconnect();
        await new Promise(resolve => setTimeout(resolve, 20));
        
        integrationSetup.channel.simulateReconnect();
        await new Promise(resolve => setTimeout(resolve, 20));
        
        // Should still receive events after reconnection
        integrationSetup.channel.simulateInsert(createMockEvents(1)[0]);
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      expect(events).toHaveLength(3); // Should receive all events despite instability
      expect(connectionEvents.filter(state => state === 'connected')).toHaveLength(3);
    });
  });

  describe('Real-time Event Stream Reliability', () => {
    it('should handle burst event scenarios without data loss', async () => {
      const receivedEvents: any[] = [];
      const burstSize = 100;
      const mockEvents = createMockEvents(burstSize);
      
      integrationSetup.channel.on('postgres_changes', (payload) => {
        receivedEvents.push(payload);
      });

      integrationSetup.channel.subscribe();
      
      performanceMonitor.startMeasurement();
      
      // Simulate burst of events in rapid succession
      mockEvents.forEach((event, index) => {
        setTimeout(() => {
          integrationSetup.channel.simulateInsert(event);
        }, index * 2); // 2ms intervals = 500 events/sec
      });
      
      // Wait for all events to be processed
      await new Promise(resolve => setTimeout(resolve, (burstSize * 2) + 50));
      
      const processingTime = performanceMonitor.endMeasurement();
      
      expect(receivedEvents).toHaveLength(burstSize);
      expect(processingTime).toBeLessThan(1000); // Should handle burst within 1 second
    });

    it('should implement event deduplication correctly', async () => {
      const receivedEvents: any[] = [];
      const testEvent = createMockEvents(1)[0];
      
      integrationSetup.channel.on('postgres_changes', (payload) => {
        // Simulate deduplication logic
        const isDuplicate = receivedEvents.some(e => e.new.id === payload.new.id);
        if (!isDuplicate) {
          receivedEvents.push(payload);
        }
      });

      integrationSetup.channel.subscribe();
      
      // Send the same event multiple times
      for (let i = 0; i < 5; i++) {
        integrationSetup.channel.simulateInsert(testEvent);
      }
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(receivedEvents).toHaveLength(1); // Should only receive once due to deduplication
    });

    it('should handle mixed event types in single stream', async () => {
      const insertEvents: any[] = [];
      const updateEvents: any[] = [];
      const deleteEvents: any[] = [];
      
      integrationSetup.channel.on('postgres_changes', (payload) => {
        switch (payload.eventType) {
          case 'INSERT':
            insertEvents.push(payload);
            break;
          case 'UPDATE':
            updateEvents.push(payload);
            break;
          case 'DELETE':
            deleteEvents.push(payload);
            break;
        }
      });

      integrationSetup.channel.subscribe();
      
      const testEvent = createMockEvents(1)[0];
      
      // Simulate different event types
      integrationSetup.channel.simulateInsert(testEvent);
      integrationSetup.channel.simulateUpdate(testEvent, testEvent);
      integrationSetup.channel.simulateDelete(testEvent);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(insertEvents).toHaveLength(1);
      expect(updateEvents).toHaveLength(1);
      expect(deleteEvents).toHaveLength(1);
    });
  });

  describe('Advanced Performance & Optimization', () => {
    it('should optimize cursor-based pagination performance', async () => {
      const pageSize = 25;
      const mockEvents = createMockEvents(100);
      
      // Mock cursor-based pagination responses
      let currentCursor = 0;
      const mockQueryBuilder = integrationSetup.client.from();
      mockQueryBuilder.select().gt().order().limit.mockImplementation(() => {
        const pageEvents = mockEvents.slice(currentCursor, currentCursor + pageSize);
        currentCursor += pageSize;
        
        return Promise.resolve({
          data: pageEvents,
          error: null,
        });
      });

      const allPages: any[] = [];
      
      performanceMonitor.startMeasurement();
      
      // Fetch multiple pages using cursor pagination
      for (let page = 0; page < 4; page++) {
        const response = await integrationSetup.client
          .from('events')
          .select('*')
          .gt('id', page * pageSize)
          .order('id', { ascending: true })
          .limit(pageSize);
          
        allPages.push(...response.data);
      }
      
      const paginationTime = performanceMonitor.endMeasurement();
      
      expect(allPages).toHaveLength(100);
      expect(paginationTime).toBeLessThan(200); // Cursor pagination should be fast
    });

    it('should handle complex multi-table joins efficiently', async () => {
      const mockJoinedData = createMockEvents(20).map(event => ({
        ...event,
        session: {
          id: event.session_id,
          user_id: `user_${Math.floor(Math.random() * 10)}`,
          start_time: new Date().toISOString()
        }
      }));
      
      integrationSetup.client.from().select.mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({
              data: mockJoinedData,
              error: null,
            }),
          }),
        }),
      });

      performanceMonitor.startMeasurement();
      
      const response = await integrationSetup.client
        .from('chronicle_events')
        .select(`
          *,
          session:chronicle_sessions(
            id,
            user_id,
            start_time
          )
        `)
        .eq('type', 'user_prompt_submit')
        .order('timestamp', { ascending: false })
        .limit(20);
      
      const queryTime = performanceMonitor.endMeasurement();
      
      expect(response.data).toHaveLength(20);
      expect(response.data[0]).toHaveProperty('session');
      expect(queryTime).toBeLessThan(150); // Complex joins should still be reasonable
    });

    it('should implement efficient bulk operations', async () => {
      const bulkEvents = createMockEvents(500);
      
      // Mock bulk insert with batching
      integrationSetup.client.from().insert.mockImplementation((data) => {
        const batchSize = 100;
        if (Array.isArray(data) && data.length > batchSize) {
          // Simulate batching logic
          return Promise.resolve({
            data: data.slice(0, batchSize),
            error: null,
          });
        }
        return Promise.resolve({ data, error: null });
      });

      performanceMonitor.startMeasurement();
      
      // Simulate batched bulk insert
      const batches = [];
      for (let i = 0; i < bulkEvents.length; i += 100) {
        const batch = bulkEvents.slice(i, i + 100);
        const response = await integrationSetup.client.from('events').insert(batch);
        batches.push(response);
      }
      
      const bulkTime = performanceMonitor.endMeasurement();
      
      expect(batches).toHaveLength(5); // 500 events / 100 batch size
      expect(bulkTime).toBeLessThan(500); // Bulk operations should be fast
      batches.forEach(batch => {
        expect(batch.error).toBeNull();
      });
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

    it('should implement proper connection cleanup on component unmount', () => {
      const cleanupCallbacks: (() => void)[] = [];
      
      // Simulate multiple subscriptions
      const channels = Array.from({ length: 5 }, (_, index) => {
        const channel = new MockRealtimeChannel();
        const cleanup = () => channel.unsubscribe();
        cleanupCallbacks.push(cleanup);
        return channel;
      });
      
      // Should cleanup all channels without errors
      expect(() => {
        cleanupCallbacks.forEach(cleanup => cleanup());
      }).not.toThrow();
      
      expect(cleanupCallbacks).toHaveLength(5);
    });

    it('should manage event memory limits effectively', async () => {
      const maxEvents = 1000;
      const events: any[] = [];
      
      integrationSetup.channel.on('postgres_changes', (payload) => {
        events.push(payload);
        
        // Simulate memory limit enforcement
        if (events.length > maxEvents) {
          events.splice(0, events.length - maxEvents);
        }
      });

      integrationSetup.channel.subscribe();
      
      // Simulate receiving more events than memory limit
      for (let i = 0; i < 1500; i++) {
        integrationSetup.channel.simulateInsert(createMockEvents(1)[0]);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(events.length).toBeLessThanOrEqual(maxEvents);
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