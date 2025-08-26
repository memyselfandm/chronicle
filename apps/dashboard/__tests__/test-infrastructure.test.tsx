import React from 'react';
import { renderWithProviders, waitFor, screen } from '../src/test-utils';
import { 
  createMockEvent, 
  createMockSession,
  createMockEventsByType,
  createSessionScenarios,
  createLoadTestData
} from '../src/test-utils/mockData';
import { 
  PerformanceMonitor, 
  PERFORMANCE_BENCHMARKS,
  createAdvancedPerformanceTests,
  validateTestResults
} from '../src/test-utils/performanceHelpers';
import { 
  createMockSupabaseClient,
  MockRealtimeChannel,
  simulateSupabaseErrors
} from '../src/test-utils/supabaseMocks';

// Simple test component for infrastructure validation
const TestComponent: React.FC<{ text: string }> = ({ text }) => {
  return (
    <div data-testid="test-component">
      <h1>{text}</h1>
      <p>Testing infrastructure is working!</p>
    </div>
  );
};

describe('Test Infrastructure Validation', () => {
  describe('Render Helpers', () => {
    it('should render components with providers', () => {
      const { getByTestId } = renderWithProviders(
        <TestComponent text="Hello World" />
      );
      
      expect(getByTestId('test-component')).toBeInTheDocument();
      expect(screen.getByText('Hello World')).toBeInTheDocument();
      expect(screen.getByText('Testing infrastructure is working!')).toBeInTheDocument();
    });

    it('should handle custom SWR config', () => {
      const mockData = { events: [createMockEvent()] };
      
      renderWithProviders(
        <TestComponent text="SWR Test" />,
        {
          swrConfig: {
            fallback: { '/api/events': mockData }
          }
        }
      );
      
      expect(screen.getByText('SWR Test')).toBeInTheDocument();
    });
  });

  describe('Mock Data Generation', () => {
    it('should create valid mock events', () => {
      const event = createMockEvent();
      
      expect(event).toHaveProperty('id');
      expect(event).toHaveProperty('session_id');
      expect(event).toHaveProperty('event_type');
      expect(event).toHaveProperty('timestamp');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('created_at');
      expect(event).toHaveProperty('updated_at');
    });

    it('should create valid mock sessions', () => {
      const session = createMockSession();
      
      expect(session).toHaveProperty('id');
      expect(session).toHaveProperty('session_id');
      expect(session).toHaveProperty('start_time');
      expect(session).toHaveProperty('status');
      expect(session).toHaveProperty('total_events');
      expect(session).toHaveProperty('total_input_tokens');
      expect(session).toHaveProperty('total_output_tokens');
      expect(session).toHaveProperty('total_cost');
    });

    it('should create event-type specific mock data', () => {
      const userPromptEvent = createMockEventsByType.user_prompt_submit();
      expect(userPromptEvent.event_type).toBe('user_prompt_submit');
      expect(userPromptEvent.data).toHaveProperty('prompt');
      expect(userPromptEvent.data).toHaveProperty('tokens');

      const toolUseEvent = createMockEventsByType.tool_use();
      expect(toolUseEvent.event_type).toBe('tool_use');
      expect(toolUseEvent.data).toHaveProperty('tool_name');
      expect(toolUseEvent.data).toHaveProperty('parameters');

      const errorEvent = createMockEventsByType.error();
      expect(errorEvent.event_type).toBe('error');
      expect(errorEvent.data).toHaveProperty('error_type');
      expect(errorEvent.data).toHaveProperty('message');
    });

    it('should create realistic session scenarios', () => {
      const activeSession = createSessionScenarios.activeSession();
      expect(activeSession.status).toBe('active');
      expect(activeSession.end_time).toBeNull();

      const completedSession = createSessionScenarios.completedSession();
      expect(completedSession.status).toBe('completed');
      expect(completedSession.end_time).not.toBeNull();
      expect(completedSession.summary).toBeTruthy();
    });

    it('should generate load test data', () => {
      const codingSessionEvents = createLoadTestData.codingSession(5); // 5 minute session
      expect(codingSessionEvents.length).toBeGreaterThan(0);
      expect(codingSessionEvents[0].event_type).toBe('session_start');
      
      // Events should be in chronological order
      for (let i = 1; i < codingSessionEvents.length; i++) {
        const prev = new Date(codingSessionEvents[i - 1].timestamp);
        const curr = new Date(codingSessionEvents[i].timestamp);
        expect(curr.getTime()).toBeGreaterThanOrEqual(prev.getTime());
      }

      const highFreqEvents = createLoadTestData.highFrequency(10, 5); // 10 events/sec for 5 seconds
      expect(highFreqEvents).toHaveLength(50);
    });
  });

  describe('Performance Monitoring', () => {
    it('should measure performance metrics', async () => {
      const monitor = new PerformanceMonitor();
      
      monitor.startMeasurement();
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 50));
      const renderTime = monitor.endMeasurement();
      
      expect(renderTime).toBeGreaterThan(40);
      expect(renderTime).toBeLessThan(100);
      
      const metrics = monitor.getMetrics();
      expect(metrics.renderTime).toBe(renderTime);
    });

    it('should validate performance benchmarks', () => {
      const monitor = new PerformanceMonitor();
      const benchmark = PERFORMANCE_BENCHMARKS.initialRender;
      
      const result = monitor.validateBenchmark(benchmark, 80);
      expect(result.passed).toBe(true);
      expect(result.message).toContain('Initial Component Render');
      
      const failResult = monitor.validateBenchmark(benchmark, 200);
      expect(failResult.passed).toBe(false);
    });

    it('should validate test results', () => {
      const perfResult = validateTestResults.performanceWithinThreshold(95, 100, 10);
      expect(perfResult.passed).toBe(true);
      
      const memResult = validateTestResults.memoryUsageAcceptable(75, 100);
      expect(memResult.passed).toBe(true);
      
      const throughputResult = validateTestResults.throughputSufficient(150, 100);
      expect(throughputResult.passed).toBe(true);
    });
  });

  describe('Supabase Mocks', () => {
    it('should create functional mock Supabase client', async () => {
      const client = createMockSupabaseClient();
      
      expect(client.from).toBeDefined();
      expect(client.channel).toBeDefined();
      expect(client.auth).toBeDefined();
      
      // Test database operations
      const result = await client.from('events').select('*').limit(10);
      expect(result.data).toBeDefined();
      expect(result.error).toBeNull();
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should simulate real-time events', () => {
      const channel = new MockRealtimeChannel();
      const mockCallback = jest.fn();
      
      channel.on('postgres_changes', mockCallback);
      
      const testData = createMockEvent();
      channel.simulateInsert(testData);
      
      expect(mockCallback).toHaveBeenCalledWith({
        eventType: 'INSERT',
        new: testData,
        old: null,
      });
    });

    it('should simulate various error scenarios', () => {
      const networkError = simulateSupabaseErrors.networkError();
      expect(networkError.data).toBeNull();
      expect(networkError.error.code).toBe('NETWORK_ERROR');
      
      const authError = simulateSupabaseErrors.authError();
      expect(authError.error.code).toBe('AUTH_ERROR');
    });
  });

  describe('Advanced Performance Tests', () => {
    it('should test component mount/unmount cycles', async () => {
      const result = await createAdvancedPerformanceTests.mountUnmountCycle(
        TestComponent,
        { text: 'Performance Test' },
        10 // reduced cycles for faster test
      );
      
      expect(result.averageMountTime).toBeGreaterThan(0);
      expect(result.averageUnmountTime).toBeGreaterThan(0);
      expect(typeof result.memoryLeak).toBe('boolean');
      expect(result.finalMemoryUsage).toBeGreaterThan(0);
    }, 15000); // Longer timeout for performance test

    it('should test real-time data processing', async () => {
      const mockProcessor = jest.fn().mockResolvedValue(undefined);
      const dataGenerator = () => [createMockEvent()];
      
      const result = await createAdvancedPerformanceTests.realtimeDataProcessing(
        mockProcessor,
        dataGenerator,
        5, // 5 batches per second
        2  // for 2 seconds
      );
      
      expect(result.totalBatches).toBe(10);
      expect(result.averageProcessingTime).toBeGreaterThanOrEqual(0);
      expect(result.droppedBatches).toBe(0);
      expect(result.throughput).toBeGreaterThan(0);
      expect(mockProcessor).toHaveBeenCalledTimes(10);
    });

    it('should test virtualization performance', async () => {
      const result = await createAdvancedPerformanceTests.virtualizationStressTest(
        1000, // 1000 items
        20,   // 20 visible
        5     // 5 scroll cycles
      );
      
      expect(result.initialRenderTime).toBeGreaterThan(0);
      expect(result.scrollPerformance).toHaveLength(5);
      expect(result.memoryEfficiency).toBeGreaterThan(0);
      expect(result.avgFrameRate).toBeGreaterThan(0);
    });
  });

  describe('Test Environment Setup', () => {
    it('should have proper global mocks', () => {
      expect(global.ResizeObserver).toBeDefined();
      expect(global.IntersectionObserver).toBeDefined();
      expect(global.requestAnimationFrame).toBeDefined();
      expect(global.cancelAnimationFrame).toBeDefined();
      expect(performance.memory).toBeDefined();
    });

    it('should handle async operations properly', async () => {
      const promise = new Promise(resolve => {
        setTimeout(() => resolve('test complete'), 10);
      });
      
      await expect(promise).resolves.toBe('test complete');
    });
  });
});

// Integration test to verify all utilities work together
describe('Test Infrastructure Integration', () => {
  it('should handle complete testing workflow', async () => {
    // 1. Create mock data
    const events = createLoadTestData.codingSession(1); // 1 minute session
    const sessions = [
      createSessionScenarios.activeSession(),
      createSessionScenarios.completedSession()
    ];
    
    // 2. Setup Supabase mock
    const supabaseClient = createMockSupabaseClient();
    
    // 3. Render component with mocked data
    const { getByTestId } = renderWithProviders(
      <TestComponent text="Integration Test" />,
      {
        swrConfig: {
          fallback: {
            '/api/events': { data: events, error: null },
            '/api/sessions': { data: sessions, error: null }
          }
        }
      }
    );
    
    // 4. Verify component renders
    expect(getByTestId('test-component')).toBeInTheDocument();
    
    // 5. Performance measurement
    const monitor = new PerformanceMonitor();
    monitor.startMeasurement();
    
    // Simulate component interaction
    await waitFor(() => {
      expect(screen.getByText('Integration Test')).toBeInTheDocument();
    });
    
    const renderTime = monitor.endMeasurement();
    const perfResult = validateTestResults.performanceWithinThreshold(renderTime, 100, 100); // More lenient for integration test
    
    // 6. Validate results
    expect(perfResult.passed).toBe(true);
    expect(events.length).toBeGreaterThan(0);
    expect(sessions).toHaveLength(2);
  });
});