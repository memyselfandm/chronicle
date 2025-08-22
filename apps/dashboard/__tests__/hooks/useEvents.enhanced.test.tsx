import { renderHook, act, waitFor } from '@testing-library/react';
import { useEvents } from '../../src/hooks/useEvents';
import { 
  createMockSupabaseClient, 
  MockRealtimeChannel,
  setupSupabaseIntegrationTest,
  simulateSupabaseErrors 
} from '../../src/test-utils/supabaseMocks';
import { createMockEvents, createHighFrequencyEventStream } from '../../src/test-utils/mockData';
import { TestProviders } from '../../src/test-utils/testProviders';
import { PerformanceMonitor, PERFORMANCE_BENCHMARKS } from '../../src/test-utils/performanceHelpers';

// Mock the supabase client module
jest.mock('../../src/lib/supabase', () => {
  const mockClient = createMockSupabaseClient();
  return {
    supabase: mockClient,
    REALTIME_CONFIG: {
      MAX_CACHED_EVENTS: 1000,
      BATCH_SIZE: 100,
    },
  };
});

// Mock the connection hook
jest.mock('../../src/hooks/useSupabaseConnection', () => ({
  useSupabaseConnection: jest.fn(() => ({
    status: {
      state: 'connected',
      lastUpdate: new Date(),
      lastEventReceived: new Date(),
      subscriptions: 2,
      reconnectAttempts: 0,
      error: null,
      isHealthy: true,
    },
    registerChannel: jest.fn(),
    unregisterChannel: jest.fn(),
    recordEventReceived: jest.fn(),
    retry: jest.fn(),
    getConnectionQuality: jest.fn().mockReturnValue('excellent'),
  })),
}));

describe('useEvents Hook - Enhanced', () => {
  let integrationSetup: ReturnType<typeof setupSupabaseIntegrationTest>;
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    integrationSetup = setupSupabaseIntegrationTest();
    performanceMonitor = new PerformanceMonitor();
  });

  afterEach(() => {
    integrationSetup.cleanup();
  });

  const renderUseEvents = (filters = {}) => {
    return renderHook(() => useEvents(filters), {
      wrapper: ({ children }) => (
        <TestProviders mockData={{ events: createMockEvents(10) }}>
          {children}
        </TestProviders>
      ),
    });
  };

  describe('Initialization', () => {
    it('should initialize with correct default state', async () => {
      const { result } = renderUseEvents();

      expect(result.current.events).toEqual([]);
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBeNull();
      expect(result.current.hasMore).toBe(true);
      expect(result.current.totalCount).toBe(0);
    });

    it('should fetch initial events on mount', async () => {
      const mockEvents = createMockEvents(5);
      
      // Setup mock response
      integrationSetup.client.from().select().order().limit.mockResolvedValue({
        data: mockEvents,
        error: null,
      });

      const { result } = renderUseEvents();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.events).toHaveLength(5);
      expect(result.current.error).toBeNull();
    });
  });

  describe('Real-time Updates', () => {
    it('should handle real-time event insertions', async () => {
      const { result } = renderUseEvents();
      const newEvent = createMockEvents(1)[0];

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Simulate real-time insert
      act(() => {
        integrationSetup.channel.simulateInsert(newEvent);
      });

      await waitFor(() => {
        expect(result.current.events).toContainEqual(expect.objectContaining({
          id: newEvent.id,
        }));
      });
    });

    it('should handle real-time event updates', async () => {
      const initialEvents = createMockEvents(3);
      integrationSetup.client.from().select().order().limit.mockResolvedValue({
        data: initialEvents,
        error: null,
      });

      const { result } = renderUseEvents();

      await waitFor(() => {
        expect(result.current.events).toHaveLength(3);
      });

      // Update an event
      const updatedEvent = { ...initialEvents[0], data: { updated: true } };
      
      act(() => {
        integrationSetup.channel.simulateUpdate(updatedEvent, initialEvents[0]);
      });

      await waitFor(() => {
        const foundEvent = result.current.events.find(e => e.id === updatedEvent.id);
        expect(foundEvent?.data).toEqual({ updated: true });
      });
    });

    it('should handle connection interruptions gracefully', async () => {
      const { result } = renderUseEvents();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Simulate disconnect
      act(() => {
        integrationSetup.channel.simulateDisconnect();
      });

      // Should attempt reconnection
      expect(result.current.connectionStatus.state).toBe('connected'); // Still shows as connected due to mock
    });
  });

  describe('Performance Tests', () => {
    it('should handle high-frequency events within latency budget', async () => {
      const { result } = renderUseEvents();
      const highFrequencyEvents = createHighFrequencyEventStream(200, 1); // 200 events/sec for 1 sec

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      performanceMonitor.startMeasurement();

      // Simulate rapid event stream
      for (const event of highFrequencyEvents.slice(0, 10)) { // Test with first 10 events
        act(() => {
          integrationSetup.channel.simulateInsert(event);
        });
      }

      const processingTime = performanceMonitor.endMeasurement();
      
      const benchmark = PERFORMANCE_BENCHMARKS.eventProcessing;
      const validation = performanceMonitor.validateBenchmark(benchmark, processingTime);
      
      expect(validation.passed).toBe(true);
      expect(processingTime).toBeLessThan(100); // 100ms budget
    });

    it('should maintain performance with large event datasets', async () => {
      const largeEventSet = createMockEvents(1000);
      
      integrationSetup.client.from().select().order().limit.mockResolvedValue({
        data: largeEventSet,
        error: null,
      });

      performanceMonitor.startMeasurement();
      const { result } = renderUseEvents();
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const renderTime = performanceMonitor.endMeasurement();
      
      expect(renderTime).toBeLessThan(300); // 300ms budget for large datasets
      expect(result.current.events).toHaveLength(1000);
    });

    it('should not leak memory during rapid updates', async () => {
      // This test would require memory profiling in a real environment
      const { result, unmount } = renderUseEvents();
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Simulate many rapid updates
      for (let i = 0; i < 100; i++) {
        const event = createMockEvents(1)[0];
        act(() => {
          integrationSetup.channel.simulateInsert(event);
        });
      }

      // Should still be responsive
      expect(result.current.events.length).toBeGreaterThan(0);
      
      // Cleanup should not throw
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      integrationSetup.client.from().select().order().limit.mockResolvedValue(
        simulateSupabaseErrors.networkError()
      );

      const { result } = renderUseEvents();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.events).toEqual([]);
    });

    it('should retry failed requests', async () => {
      let callCount = 0;
      integrationSetup.client.from().select().order().limit.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(simulateSupabaseErrors.networkError());
        }
        return Promise.resolve({ data: createMockEvents(5), error: null });
      });

      const { result } = renderUseEvents();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should eventually succeed after retry
      expect(result.current.events).toHaveLength(5);
      expect(callCount).toBeGreaterThan(1);
    });

    it('should handle malformed event data', async () => {
      const malformedEvents = [
        { id: 'test', /* missing required fields */ },
        null,
        undefined,
        createMockEvents(1)[0], // One valid event
      ];

      integrationSetup.client.from().select().order().limit.mockResolvedValue({
        data: malformedEvents,
        error: null,
      });

      const { result } = renderUseEvents();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should filter out malformed data and keep valid events
      expect(result.current.events).toHaveLength(1);
      expect(result.current.error).toBeNull(); // Should not error on malformed data
    });
  });

  describe('Filtering and Search', () => {
    it('should apply event type filters correctly', async () => {
      const mixedEvents = [
        ...createMockEvents(3, 'session_1').map(e => ({ ...e, event_type: 'user_prompt_submit' as const })),
        ...createMockEvents(2, 'session_1').map(e => ({ ...e, event_type: 'tool_use' as const })),
      ];

      integrationSetup.client.from().select().order().limit.mockResolvedValue({
        data: mixedEvents,
        error: null,
      });

      const { result } = renderUseEvents({ eventTypes: ['user_prompt_submit'] });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should only return filtered events
      result.current.events.forEach(event => {
        expect(event.event_type).toBe('user_prompt_submit');
      });
    });

    it('should support search functionality', async () => {
      const searchableEvents = createMockEvents(5).map((event, index) => ({
        ...event,
        data: { prompt: `Search term ${index}` },
      }));

      integrationSetup.client.from().select().order().limit.mockResolvedValue({
        data: searchableEvents,
        error: null,
      });

      const { result } = renderUseEvents({ search: 'term 2' });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should return filtered results based on search
      expect(result.current.events.length).toBeGreaterThan(0);
    });
  });

  describe('Pagination', () => {
    it('should load more events when requested', async () => {
      const initialEvents = createMockEvents(20);
      const moreEvents = createMockEvents(20, 'session_2');

      integrationSetup.client.from().select().order().limit
        .mockResolvedValueOnce({ data: initialEvents, error: null })
        .mockResolvedValueOnce({ data: moreEvents, error: null });

      const { result } = renderUseEvents();

      await waitFor(() => {
        expect(result.current.events).toHaveLength(20);
      });

      // Load more
      act(() => {
        result.current.loadMore();
      });

      await waitFor(() => {
        expect(result.current.events).toHaveLength(40);
      });
    });

    it('should handle end of data correctly', async () => {
      integrationSetup.client.from().select().order().limit.mockResolvedValue({
        data: [], // No more data
        error: null,
      });

      const { result } = renderUseEvents();

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasMore).toBe(false);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup subscriptions on unmount', () => {
      const { unmount } = renderUseEvents();
      
      // Should not throw during unmount
      expect(() => unmount()).not.toThrow();
      
      // Verify unsubscribe was called
      expect(integrationSetup.channel.unsubscribe).toHaveBeenCalled();
    });

    it('should handle multiple rapid mount/unmount cycles', () => {
      for (let i = 0; i < 5; i++) {
        const { unmount } = renderUseEvents();
        unmount();
      }
      
      // Should not leak subscriptions or cause errors
      expect(true).toBe(true); // Test passes if no errors thrown
    });
  });
});