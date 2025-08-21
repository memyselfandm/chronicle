/**
 * Store optimizations test suite
 * Tests for Zustand performance optimizations and selective subscriptions
 */

import { renderHook, act } from '@testing-library/react';
import {
  useOptimizedSessions,
  useOptimizedEvents,
  useOptimizedFilters,
  useOptimizedUI,
  useOptimizedRealTime,
  useBatchedSessionUpdates,
  useBatchedEventUpdates,
  useMemoryOptimization,
  BatchedStoreUpdates,
  getBatchedUpdates,
} from '../../src/lib/storeOptimizations';
import { useDashboardStore } from '../../src/stores/dashboardStore';

// Mock performance monitor
jest.mock('../../src/lib/performanceMonitor', () => ({
  getPerformanceMonitor: () => ({
    trackComponentRender: jest.fn(),
    createProfiler: () => ({
      start: () => ({ end: () => 0 }),
    }),
  }),
}));

describe('Store Optimizations', () => {
  beforeEach(() => {
    // Reset store state
    useDashboardStore.getState().setSessions([]);
    useDashboardStore.getState().setEvents([]);
    useDashboardStore.getState().resetFilters();
  });

  describe('Optimized Selectors', () => {
    describe('useOptimizedSessions', () => {
      it('should return sessions data without causing unnecessary re-renders', () => {
        const { result, rerender } = renderHook(() => useOptimizedSessions());

        expect(result.current.sessions).toEqual([]);
        expect(result.current.sessionCount).toBe(0);
        expect(result.current.activeSessions).toEqual([]);

        // Add a session
        act(() => {
          useDashboardStore.getState().addSession({
            id: 'session-1',
            status: 'active',
            startTime: new Date(),
            toolsUsed: 0,
            eventsCount: 0,
            lastActivity: new Date(),
          });
        });

        rerender();

        expect(result.current.sessions).toHaveLength(1);
        expect(result.current.sessionCount).toBe(1);
        expect(result.current.activeSessions).toHaveLength(1);
      });

      it('should not re-render when unrelated state changes', () => {
        const renderSpy = jest.fn();
        
        renderHook(() => {
          const data = useOptimizedSessions();
          renderSpy();
          return data;
        });

        const initialRenderCount = renderSpy.mock.calls.length;

        // Change UI state (unrelated to sessions)
        act(() => {
          useDashboardStore.getState().setLoading(true);
        });

        // Should not trigger additional renders for session hook
        expect(renderSpy.mock.calls.length).toBe(initialRenderCount);
      });
    });

    describe('useOptimizedEvents', () => {
      it('should return events data efficiently', () => {
        const { result } = renderHook(() => useOptimizedEvents());

        expect(result.current.events).toEqual([]);
        expect(result.current.eventCount).toBe(0);

        // Add events
        act(() => {
          useDashboardStore.getState().addEvent({
            id: 'event-1',
            sessionId: 'session-1',
            type: 'user_prompt_submit',
            timestamp: new Date(),
            metadata: {},
            status: 'active',
          });
        });

        expect(result.current.events).toHaveLength(1);
        expect(result.current.eventCount).toBe(1);
        expect(result.current.recentEvents).toHaveLength(1);
      });

      it('should limit recent events for performance', () => {
        const { result } = renderHook(() => useOptimizedEvents());

        // Add more than 100 events
        act(() => {
          const events = Array.from({ length: 150 }, (_, index) => ({
            id: `event-${index}`,
            sessionId: 'session-1',
            type: 'user_prompt_submit',
            timestamp: new Date(),
            metadata: {},
            status: 'active' as const,
          }));
          useDashboardStore.getState().setEvents(events);
        });

        expect(result.current.events).toHaveLength(150);
        expect(result.current.recentEvents).toHaveLength(100); // Limited to 100
      });
    });

    describe('useOptimizedFilters', () => {
      it('should return filter state efficiently', () => {
        const { result } = renderHook(() => useOptimizedFilters());

        expect(Array.from(result.current.selectedSessions)).toEqual([]);
        expect(result.current.searchTerm).toBe('');

        act(() => {
          useDashboardStore.getState().updateFilters({
            searchTerm: 'test',
            selectedSessions: ['session-1'],
          });
        });

        expect(result.current.searchTerm).toBe('test');
        expect(Array.from(result.current.selectedSessions)).toEqual(['session-1']);
      });
    });

    describe('useOptimizedUI', () => {
      it('should return UI state efficiently', () => {
        const { result } = renderHook(() => useOptimizedUI());

        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();

        act(() => {
          useDashboardStore.getState().setLoading(true);
          useDashboardStore.getState().setError('Test error');
        });

        expect(result.current.loading).toBe(true);
        expect(result.current.error).toBe('Test error');
      });
    });

    describe('useOptimizedRealTime', () => {
      it('should return real-time state efficiently', () => {
        const { result } = renderHook(() => useOptimizedRealTime());

        expect(result.current.connectionStatus).toBe('disconnected');
        expect(result.current.isEnabled).toBe(false);

        act(() => {
          useDashboardStore.getState().enableRealTime();
        });

        expect(result.current.isEnabled).toBe(true);
      });
    });
  });

  describe('Batched Updates', () => {
    describe('BatchedStoreUpdates', () => {
      let batchedUpdates: BatchedStoreUpdates;

      beforeEach(() => {
        batchedUpdates = new BatchedStoreUpdates(50); // 50ms batch delay
      });

      afterEach(() => {
        batchedUpdates.destroy();
      });

      it('should queue multiple updates and execute them in batches', (done) => {
        const updates: number[] = [];

        batchedUpdates.queueUpdate(() => updates.push(1));
        batchedUpdates.queueUpdate(() => updates.push(2));
        batchedUpdates.queueUpdate(() => updates.push(3));

        // Updates should not execute immediately
        expect(updates).toEqual([]);

        setTimeout(() => {
          // After batch delay, all updates should be executed
          expect(updates).toEqual([1, 2, 3]);
          done();
        }, 60);
      });

      it('should flush updates immediately when requested', () => {
        const updates: number[] = [];

        batchedUpdates.queueUpdate(() => updates.push(1));
        batchedUpdates.queueUpdate(() => updates.push(2));

        expect(updates).toEqual([]);

        batchedUpdates.flush();

        expect(updates).toEqual([1, 2]);
      });

      it('should handle rapid updates efficiently', () => {
        const updates: number[] = [];

        // Queue many updates rapidly
        for (let i = 0; i < 100; i++) {
          batchedUpdates.queueUpdate(() => updates.push(i));
        }

        batchedUpdates.flush();

        expect(updates).toHaveLength(100);
        expect(updates[0]).toBe(0);
        expect(updates[99]).toBe(99);
      });
    });

    describe('useBatchedSessionUpdates', () => {
      it('should batch session updates', () => {
        const { result } = renderHook(() => useBatchedSessionUpdates());

        // These updates should be batched
        act(() => {
          result.current.addSession({
            id: 'session-1',
            status: 'active',
            startTime: new Date(),
            toolsUsed: 0,
            eventsCount: 0,
            lastActivity: new Date(),
          });

          result.current.addSession({
            id: 'session-2',
            status: 'idle',
            startTime: new Date(),
            toolsUsed: 0,
            eventsCount: 0,
            lastActivity: new Date(),
          });
        });

        // Force batch flush
        getBatchedUpdates().flush();

        const sessions = useDashboardStore.getState().sessions;
        expect(sessions).toHaveLength(2);
      });

      it('should batch session updates for better performance', () => {
        const { result } = renderHook(() => useBatchedSessionUpdates());

        const updateSpy = jest.spyOn(useDashboardStore.getState(), 'updateSession');

        act(() => {
          result.current.updateSession('session-1', { toolsUsed: 1 });
          result.current.updateSession('session-1', { toolsUsed: 2 });
          result.current.updateSession('session-1', { toolsUsed: 3 });
        });

        getBatchedUpdates().flush();

        // Updates should be batched and executed efficiently
        expect(updateSpy).toHaveBeenCalledTimes(3);
      });
    });

    describe('useBatchedEventUpdates', () => {
      it('should batch event updates', () => {
        const { result } = renderHook(() => useBatchedEventUpdates());

        act(() => {
          result.current.addEventsBatch([
            {
              id: 'event-1',
              sessionId: 'session-1',
              type: 'user_prompt_submit',
              timestamp: new Date(),
              metadata: {},
              status: 'active',
            },
            {
              id: 'event-2',
              sessionId: 'session-1',
              type: 'pre_tool_use',
              timestamp: new Date(),
              metadata: {},
              status: 'active',
            },
          ]);
        });

        getBatchedUpdates().flush();

        const events = useDashboardStore.getState().events;
        expect(events).toHaveLength(2);
      });
    });
  });

  describe('Memory Optimization', () => {
    describe('useMemoryOptimization', () => {
      it('should clean up old events when limit exceeded', () => {
        const { result } = renderHook(() => useMemoryOptimization());

        // Add more events than the limit
        act(() => {
          const events = Array.from({ length: 1500 }, (_, index) => ({
            id: `event-${index}`,
            sessionId: 'session-1',
            type: 'user_prompt_submit',
            timestamp: new Date(),
            metadata: {},
            status: 'active' as const,
          }));
          useDashboardStore.getState().setEvents(events);
        });

        expect(useDashboardStore.getState().events).toHaveLength(1500);

        act(() => {
          result.current.cleanupOldEvents(1000);
        });

        expect(useDashboardStore.getState().events).toHaveLength(1000);
      });

      it('should clean up completed sessions older than threshold', () => {
        const now = new Date();
        const oldDate = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25 hours ago

        const { result } = renderHook(() => useMemoryOptimization());

        act(() => {
          useDashboardStore.getState().setSessions([
            {
              id: 'session-1',
              status: 'active',
              startTime: now,
              toolsUsed: 0,
              eventsCount: 0,
              lastActivity: now,
            },
            {
              id: 'session-2',
              status: 'completed',
              startTime: oldDate,
              endTime: oldDate,
              toolsUsed: 0,
              eventsCount: 0,
              lastActivity: oldDate,
            },
            {
              id: 'session-3',
              status: 'completed',
              startTime: now,
              endTime: now,
              toolsUsed: 0,
              eventsCount: 0,
              lastActivity: now,
            },
          ]);
        });

        expect(useDashboardStore.getState().sessions).toHaveLength(3);

        act(() => {
          result.current.cleanupCompletedSessions(24 * 60 * 60 * 1000); // 24 hours
        });

        const remainingSessions = useDashboardStore.getState().sessions;
        expect(remainingSessions).toHaveLength(2);
        expect(remainingSessions.find(s => s.id === 'session-2')).toBeUndefined();
      });

      it('should calculate memory usage estimation', () => {
        const { result } = renderHook(() => useMemoryOptimization());

        act(() => {
          useDashboardStore.getState().setSessions([
            {
              id: 'session-1',
              status: 'active',
              startTime: new Date(),
              toolsUsed: 0,
              eventsCount: 0,
              lastActivity: new Date(),
            },
          ]);

          useDashboardStore.getState().setEvents([
            {
              id: 'event-1',
              sessionId: 'session-1',
              type: 'user_prompt_submit',
              timestamp: new Date(),
              metadata: {},
              status: 'active',
            },
            {
              id: 'event-2',
              sessionId: 'session-1',
              type: 'pre_tool_use',
              timestamp: new Date(),
              metadata: {},
              status: 'active',
            },
          ]);
        });

        const usage = result.current.getMemoryUsage();

        expect(usage.sessions).toBe(1);
        expect(usage.events).toBe(2);
        expect(usage.estimatedSizeKB).toBe(2.5); // 1 * 0.5 + 2 * 1
      });
    });
  });

  describe('Performance Tracking', () => {
    it('should track component render performance', () => {
      const performanceMonitor = require('../../src/lib/performanceMonitor').getPerformanceMonitor();

      renderHook(() => useOptimizedSessions());

      expect(performanceMonitor.trackComponentRender).toHaveBeenCalledWith(
        'useOptimizedSessions',
        0
      );
    });

    it('should not cause performance degradation with frequent updates', () => {
      const { result } = renderHook(() => useBatchedEventUpdates());

      const startTime = performance.now();

      // Add many events rapidly
      act(() => {
        for (let i = 0; i < 100; i++) {
          result.current.addEvent({
            id: `event-${i}`,
            sessionId: 'session-1',
            type: 'user_prompt_submit',
            timestamp: new Date(),
            metadata: {},
            status: 'active',
          });
        }
      });

      getBatchedUpdates().flush();

      const duration = performance.now() - startTime;

      // Should complete quickly even with many updates
      expect(duration).toBeLessThan(100); // ms
    });
  });
});