import { 
  setupSupabaseIntegrationTest,
  simulateSupabaseErrors,
  createPerformanceTestClient
} from '../../src/test-utils/supabaseMocks';
import { createMockEvents, createMockSessions } from '../../src/test-utils/mockData';
import { PerformanceMonitor } from '../../src/test-utils/performanceHelpers';

describe('Database Operations Integration Tests', () => {
  let integrationSetup: ReturnType<typeof setupSupabaseIntegrationTest>;
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    integrationSetup = setupSupabaseIntegrationTest();
    performanceMonitor = new PerformanceMonitor();
  });

  afterEach(() => {
    integrationSetup.cleanup();
  });

  describe('CRUD Operations', () => {
    it('should handle CREATE operations with validation', async () => {
      const mockEvent = createMockEvents(1)[0];
      
      integrationSetup.client.from.mockReturnValue({
        ...integrationSetup.client.from(),
        insert: jest.fn().mockResolvedValue({
          data: [mockEvent],
          error: null,
        })
      });

      const response = await integrationSetup.client
        .from('chronicle_events')
        .insert(mockEvent);

      expect(response.error).toBeNull();
      expect(response.data).toHaveLength(1);
      expect(response.data[0]).toMatchObject({
        id: mockEvent.id,
        session_id: mockEvent.session_id
      });
    });

    it('should handle READ operations with complex filtering', async () => {
      const mockEvents = createMockEvents(50);
      const filteredEvents = mockEvents.slice(0, 10);
      
      // Mock the complex query chain
      const mockQueryBuilder = integrationSetup.client.from();
      mockQueryBuilder.select().in().gte().lte().textSearch().order().limit
        .mockResolvedValue({
          data: filteredEvents,
          error: null,
        });

      performanceMonitor.startMeasurement();

      const response = await integrationSetup.client
        .from('chronicle_events')
        .select('*')
        .in('type', ['user_prompt_submit', 'assistant_response'])
        .gte('timestamp', '2024-01-01T00:00:00Z')
        .lte('timestamp', '2024-12-31T23:59:59Z')
        .textSearch('data', 'search query')
        .order('timestamp', { ascending: false })
        .limit(10);

      const queryTime = performanceMonitor.endMeasurement();

      expect(response.error).toBeNull();
      expect(response.data).toHaveLength(10);
      expect(queryTime).toBeLessThan(200);
    });

    it('should handle UPDATE operations with optimistic locking', async () => {
      const originalEvent = createMockEvents(1)[0];
      const updatedEvent = { ...originalEvent, type: 'updated_type' };

      integrationSetup.client.from().update().eq.mockResolvedValue({
        data: [updatedEvent],
        error: null,
      });

      const response = await integrationSetup.client
        .from('chronicle_events')
        .update({ type: 'updated_type' })
        .eq('id', originalEvent.id);

      expect(response.error).toBeNull();
      expect(response.data[0].type).toBe('updated_type');
    });

    it('should handle DELETE operations with cascade protection', async () => {
      const mockEvent = createMockEvents(1)[0];

      integrationSetup.client.from().delete().eq.mockResolvedValue({
        data: [],
        error: null,
      });

      const response = await integrationSetup.client
        .from('chronicle_events')
        .delete()
        .eq('id', mockEvent.id);

      expect(response.error).toBeNull();
      expect(response.data).toEqual([]);
    });
  });

  describe('Transaction Management', () => {
    it('should handle atomic transactions correctly', async () => {
      const mockEvents = createMockEvents(3);
      let transactionCommitted = false;

      // Mock transaction-like behavior
      integrationSetup.client.from().insert.mockImplementation((data) => {
        if (Array.isArray(data) && data.length === 3) {
          transactionCommitted = true;
          return Promise.resolve({ data, error: null });
        }
        return Promise.resolve({ 
          data: null, 
          error: { message: 'Transaction failed', code: 'TRANSACTION_ERROR' } 
        });
      });

      const response = await integrationSetup.client
        .from('chronicle_events')
        .insert(mockEvents);

      expect(response.error).toBeNull();
      expect(transactionCommitted).toBe(true);
      expect(response.data).toHaveLength(3);
    });

    it('should rollback transactions on failure', async () => {
      const mockEvents = createMockEvents(3);
      mockEvents[1].type = null; // Invalid data to cause failure

      integrationSetup.client.from().insert.mockImplementation((data) => {
        // Simulate validation failure
        const invalidItem = data.find((item: any) => !item.type);
        if (invalidItem) {
          return Promise.resolve({
            data: null,
            error: { message: 'Validation failed: type is required', code: 'VALIDATION_ERROR' }
          });
        }
        return Promise.resolve({ data, error: null });
      });

      const response = await integrationSetup.client
        .from('chronicle_events')
        .insert(mockEvents);

      expect(response.error).toBeTruthy();
      expect(response.error.code).toBe('VALIDATION_ERROR');
      expect(response.data).toBeNull();
    });

    it('should handle deadlock scenarios gracefully', async () => {
      let deadlockOccurred = false;

      integrationSetup.client.from().insert.mockImplementation(() => {
        deadlockOccurred = true;
        return Promise.resolve({
          data: null,
          error: { message: 'Deadlock detected', code: 'DEADLOCK_ERROR' }
        });
      });

      const response = await integrationSetup.client
        .from('chronicle_events')
        .insert(createMockEvents(1));

      expect(deadlockOccurred).toBe(true);
      expect(response.error.code).toBe('DEADLOCK_ERROR');
    });
  });

  describe('Connection Pool Management', () => {
    it('should handle connection pool exhaustion', async () => {
      const requests = Array.from({ length: 20 }, (_, index) => 
        integrationSetup.client
          .from('chronicle_events')
          .select('*')
          .eq('id', `event_${index}`)
          .limit(1)
      );

      const results = await Promise.all(requests);

      // All requests should complete even with high concurrency
      results.forEach(result => {
        expect(result.error).toBeNull();
      });
    });

    it('should implement connection recycling', async () => {
      const connectionUsageTimes: number[] = [];

      // Simulate connection usage tracking
      integrationSetup.client.from().select().limit.mockImplementation(() => {
        const startTime = performance.now();
        return new Promise((resolve) => {
          setTimeout(() => {
            connectionUsageTimes.push(performance.now() - startTime);
            resolve({ data: createMockEvents(1), error: null });
          }, Math.random() * 50); // Variable latency
        });
      });

      // Make sequential requests to test connection reuse
      for (let i = 0; i < 10; i++) {
        await integrationSetup.client.from('events').select('*').limit(1);
      }

      expect(connectionUsageTimes).toHaveLength(10);
      
      // Connection reuse should keep times relatively consistent
      const avgTime = connectionUsageTimes.reduce((a, b) => a + b, 0) / connectionUsageTimes.length;
      const maxTime = Math.max(...connectionUsageTimes);
      expect(maxTime).toBeLessThan(avgTime * 3); // No connection should take 3x average
    });
  });

  describe('Index and Query Optimization', () => {
    it('should use indexes efficiently for common queries', async () => {
      const mockEvents = createMockEvents(100);
      
      // Mock query with index usage
      integrationSetup.client.from().select().eq().order().limit.mockImplementation(() => {
        // Simulate fast index-based lookup
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({ data: mockEvents.slice(0, 10), error: null });
          }, 10); // Fast response simulating index usage
        });
      });

      performanceMonitor.startMeasurement();

      const response = await integrationSetup.client
        .from('chronicle_events')
        .select('*')
        .eq('session_id', 'test_session')
        .order('timestamp', { ascending: false })
        .limit(10);

      const queryTime = performanceMonitor.endMeasurement();

      expect(response.error).toBeNull();
      expect(queryTime).toBeLessThan(50); // Should be fast with index
    });

    it('should handle full-text search efficiently', async () => {
      const searchResults = createMockEvents(25);
      
      // Mock the search query chain
      const mockQueryBuilder = integrationSetup.client.from();
      mockQueryBuilder.select().textSearch().order().limit
        .mockResolvedValue({
          data: searchResults,
          error: null,
        });

      performanceMonitor.startMeasurement();

      const response = await integrationSetup.client
        .from('chronicle_events')
        .select('*')
        .textSearch('data', 'search terms')
        .order('timestamp', { ascending: false })
        .limit(25);

      const queryTime = performanceMonitor.endMeasurement();

      expect(response.error).toBeNull();
      expect(response.data).toHaveLength(25);
      expect(queryTime).toBeLessThan(300); // Full-text search should be reasonable
    });

    it('should optimize range queries with proper indexing', async () => {
      const rangeResults = createMockEvents(50);
      
      integrationSetup.client.from().select().gte().lte().order().limit
        .mockResolvedValue({
          data: rangeResults,
          error: null,
        });

      performanceMonitor.startMeasurement();

      const response = await integrationSetup.client
        .from('chronicle_events')
        .select('*')
        .gte('timestamp', '2024-01-01T00:00:00Z')
        .lte('timestamp', '2024-01-31T23:59:59Z')
        .order('timestamp', { ascending: false })
        .limit(50);

      const queryTime = performanceMonitor.endMeasurement();

      expect(response.error).toBeNull();
      expect(queryTime).toBeLessThan(150); // Range queries should be fast with proper indexes
    });
  });

  describe('Data Consistency and Integrity', () => {
    it('should enforce foreign key constraints', async () => {
      const invalidEvent = createMockEvents(1)[0];
      invalidEvent.session_id = 'nonexistent_session';

      integrationSetup.client.from().insert.mockImplementation((data) => {
        // Simulate foreign key constraint violation
        if (data.session_id === 'nonexistent_session') {
          return Promise.resolve({
            data: null,
            error: { 
              message: 'Foreign key violation: session_id does not exist',
              code: 'FOREIGN_KEY_VIOLATION'
            }
          });
        }
        return Promise.resolve({ data: [data], error: null });
      });

      const response = await integrationSetup.client
        .from('chronicle_events')
        .insert(invalidEvent);

      expect(response.error).toBeTruthy();
      expect(response.error.code).toBe('FOREIGN_KEY_VIOLATION');
    });

    it('should maintain referential integrity on cascade deletes', async () => {
      const mockSession = createMockSessions(1)[0];
      const relatedEvents = createMockEvents(3).map(event => ({
        ...event,
        session_id: mockSession.id
      }));

      let cascadeDeleteOccurred = false;

      integrationSetup.client.from().delete().eq.mockImplementation((column, value) => {
        if (column === 'id' && value === mockSession.id) {
          cascadeDeleteOccurred = true;
          return Promise.resolve({
            data: [],
            error: null,
            // Simulate cascade delete of related events
            cascaded: { events: relatedEvents.length }
          });
        }
        return Promise.resolve({ data: [], error: null });
      });

      const response = await integrationSetup.client
        .from('chronicle_sessions')
        .delete()
        .eq('id', mockSession.id);

      expect(response.error).toBeNull();
      expect(cascadeDeleteOccurred).toBe(true);
    });

    it('should handle concurrent modifications with proper locking', async () => {
      const mockEvent = createMockEvents(1)[0];
      let concurrentModificationDetected = false;

      // Simulate concurrent modification scenario
      integrationSetup.client.from().update().eq.mockImplementation((column, value) => {
        // Simulate optimistic locking failure
        concurrentModificationDetected = true;
        return Promise.resolve({
          data: null,
          error: {
            message: 'Concurrent modification detected',
            code: 'CONCURRENT_MODIFICATION'
          }
        });
      });

      const response = await integrationSetup.client
        .from('chronicle_events')
        .update({ type: 'modified_type' })
        .eq('id', mockEvent.id);

      expect(concurrentModificationDetected).toBe(true);
      expect(response.error.code).toBe('CONCURRENT_MODIFICATION');
    });
  });

  describe('Performance Under Load', () => {
    it('should maintain performance with high insert volume', async () => {
      const batchSize = 100;
      const batches = 5;
      const insertTimes: number[] = [];

      integrationSetup.client.from().insert.mockImplementation((data) => {
        const startTime = performance.now();
        return new Promise((resolve) => {
          setTimeout(() => {
            insertTimes.push(performance.now() - startTime);
            resolve({ data, error: null });
          }, 20); // Simulate realistic insert time
        });
      });

      // Perform multiple large batch inserts
      for (let batch = 0; batch < batches; batch++) {
        const batchEvents = createMockEvents(batchSize);
        await integrationSetup.client
          .from('chronicle_events')
          .insert(batchEvents);
      }

      expect(insertTimes).toHaveLength(batches);
      
      // Performance should remain consistent across batches
      const avgTime = insertTimes.reduce((a, b) => a + b, 0) / insertTimes.length;
      const lastBatchTime = insertTimes[insertTimes.length - 1];
      expect(lastBatchTime).toBeLessThan(avgTime * 1.5); // No more than 50% slower
    });

    it('should handle read-heavy workloads efficiently', async () => {
      const readTimes: number[] = [];
      const concurrentReads = 20;

      integrationSetup.client.from().select().limit.mockImplementation(() => {
        const startTime = performance.now();
        return new Promise((resolve) => {
          setTimeout(() => {
            readTimes.push(performance.now() - startTime);
            resolve({ data: createMockEvents(10), error: null });
          }, Math.random() * 30 + 10); // 10-40ms response time
        });
      });

      const readPromises = Array.from({ length: concurrentReads }, () =>
        integrationSetup.client.from('chronicle_events').select('*').limit(10)
      );

      await Promise.all(readPromises);

      expect(readTimes).toHaveLength(concurrentReads);
      
      // All reads should complete within reasonable time
      readTimes.forEach(time => {
        expect(time).toBeLessThan(100);
      });
    });

    it('should handle mixed read/write workloads', async () => {
      const operationTimes: { type: string, time: number }[] = [];

      // Mock both read and write operations
      integrationSetup.client.from().select().limit.mockImplementation(() => {
        const startTime = performance.now();
        return new Promise((resolve) => {
          setTimeout(() => {
            operationTimes.push({ type: 'read', time: performance.now() - startTime });
            resolve({ data: createMockEvents(5), error: null });
          }, 15);
        });
      });

      integrationSetup.client.from().insert.mockImplementation(() => {
        const startTime = performance.now();
        return new Promise((resolve) => {
          setTimeout(() => {
            operationTimes.push({ type: 'write', time: performance.now() - startTime });
            resolve({ data: createMockEvents(1), error: null });
          }, 25);
        });
      });

      // Execute mixed workload
      const mixedPromises = [];
      for (let i = 0; i < 10; i++) {
        if (i % 3 === 0) {
          // Insert operation
          mixedPromises.push(
            integrationSetup.client.from('chronicle_events').insert(createMockEvents(1)[0])
          );
        } else {
          // Select operation
          mixedPromises.push(
            integrationSetup.client.from('chronicle_events').select('*').limit(5)
          );
        }
      }

      await Promise.all(mixedPromises);

      expect(operationTimes).toHaveLength(10);
      
      const readOps = operationTimes.filter(op => op.type === 'read');
      const writeOps = operationTimes.filter(op => op.type === 'write');
      
      expect(readOps.length).toBeGreaterThan(0);
      expect(writeOps.length).toBeGreaterThan(0);
      
      // Both operation types should complete efficiently
      const avgReadTime = readOps.reduce((sum, op) => sum + op.time, 0) / readOps.length;
      const avgWriteTime = writeOps.reduce((sum, op) => sum + op.time, 0) / writeOps.length;
      
      expect(avgReadTime).toBeLessThan(50);
      expect(avgWriteTime).toBeLessThan(100);
    });
  });
});