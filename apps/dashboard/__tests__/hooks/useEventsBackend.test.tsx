/**
 * Tests for useEvents hook with backend abstraction
 */

import { renderHook, act } from '@testing-library/react';
import { useEvents } from '../../src/hooks/useEvents';
import * as backendFactory from '../../src/lib/backend/factory';
import { ChronicleBackend } from '../../src/lib/backend';

// Mock the backend factory
jest.mock('../../src/lib/backend/factory');

// Mock the config
jest.mock('../../src/lib/config', () => ({
  config: {
    backend: { mode: 'local' },
    performance: { maxEventsDisplay: 1000 },
  },
}));

// Mock logger
jest.mock('../../src/lib/utils', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('useEvents with Backend Abstraction', () => {
  const mockBackend: jest.Mocked<ChronicleBackend> = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    getConnectionStatus: jest.fn().mockReturnValue('connected'),
    onConnectionStatusChange: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
    getEvents: jest.fn().mockResolvedValue([]),
    subscribeToEvents: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
    getSessions: jest.fn().mockResolvedValue([]),
    subscribeToSessions: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
    getSessionSummaries: jest.fn().mockResolvedValue([]),
    healthCheck: jest.fn().mockResolvedValue(true),
    getMetadata: jest.fn().mockResolvedValue({
      type: 'local',
      version: '1.0.0',
      capabilities: { realtime: true, websockets: true, analytics: true, export: true },
      connectionInfo: { url: 'http://localhost:8510' },
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (backendFactory.getBackend as jest.Mock).mockResolvedValue(mockBackend);
  });

  it('should initialize with loading state', () => {
    const { result } = renderHook(() => useEvents());

    expect(result.current.loading).toBe(true);
    expect(result.current.events).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.connectionStatus).toBe('disconnected');
  });

  it('should fetch events on mount', async () => {
    const mockEvents = [
      { id: '1', event_type: 'session_start', timestamp: '2023-01-01T00:00:00Z' },
      { id: '2', event_type: 'pre_tool_use', timestamp: '2023-01-01T00:01:00Z' },
    ];

    mockBackend.getEvents.mockResolvedValue(mockEvents);

    const { result, waitForNextUpdate } = renderHook(() => useEvents());

    await act(async () => {
      await waitForNextUpdate();
    });

    expect(backendFactory.getBackend).toHaveBeenCalled();
    expect(mockBackend.getEvents).toHaveBeenCalledWith({
      sessionIds: [],
      eventTypes: [],
      dateRange: null,
      searchQuery: '',
      limit: 50,
      offset: 0,
    });
    expect(result.current.events).toEqual(mockEvents);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should apply filters correctly', async () => {
    const filters = {
      sessionIds: ['session-1'],
      eventTypes: ['pre_tool_use'],
      searchQuery: 'test',
      dateRange: {
        start: new Date('2023-01-01'),
        end: new Date('2023-01-02'),
      },
    };

    const { result, waitForNextUpdate } = renderHook(() => 
      useEvents({ filters, limit: 25 })
    );

    await act(async () => {
      await waitForNextUpdate();
    });

    expect(mockBackend.getEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionIds: ['session-1'],
        eventTypes: ['pre_tool_use'],
        searchQuery: 'test',
        dateRange: {
          start: new Date('2023-01-01'),
          end: new Date('2023-01-02'),
        },
        limit: 25,
        offset: 0,
      })
    );
  });

  it('should handle real-time event subscriptions', async () => {
    const { waitForNextUpdate } = renderHook(() => useEvents({ enableRealtime: true }));

    await act(async () => {
      await waitForNextUpdate();
    });

    expect(mockBackend.subscribeToEvents).toHaveBeenCalled();
  });

  it('should not setup real-time when disabled', async () => {
    const { waitForNextUpdate } = renderHook(() => useEvents({ enableRealtime: false }));

    await act(async () => {
      await waitForNextUpdate();
    });

    expect(mockBackend.subscribeToEvents).not.toHaveBeenCalled();
  });

  it('should handle connection status changes', async () => {
    let statusCallback: (status: any) => void;
    mockBackend.onConnectionStatusChange.mockImplementation((callback) => {
      statusCallback = callback;
      return { unsubscribe: jest.fn() };
    });
    mockBackend.getConnectionStatus.mockReturnValue('connecting');

    const { result, waitForNextUpdate } = renderHook(() => useEvents());

    await act(async () => {
      await waitForNextUpdate();
    });

    expect(result.current.connectionStatus).toBe('connecting');

    // Simulate status change
    act(() => {
      statusCallback('connected');
    });

    expect(result.current.connectionStatus).toBe('connected');
  });

  it('should handle real-time events', async () => {
    const mockEventCallback = jest.fn();
    mockBackend.subscribeToEvents.mockImplementation((callback) => {
      mockEventCallback.mockImplementation(callback);
      return { unsubscribe: jest.fn() };
    });

    const { result, waitForNextUpdate } = renderHook(() => useEvents());

    await act(async () => {
      await waitForNextUpdate();
    });

    // Simulate real-time event
    const newEvent = { 
      id: '3', 
      event_type: 'post_tool_use', 
      timestamp: '2023-01-01T00:02:00Z' 
    };

    act(() => {
      mockEventCallback(newEvent);
    });

    expect(result.current.events).toContain(newEvent);
  });

  it('should handle errors gracefully', async () => {
    const error = new Error('Backend connection failed');
    mockBackend.getEvents.mockRejectedValue(error);

    const { result, waitForNextUpdate } = renderHook(() => useEvents());

    await act(async () => {
      await waitForNextUpdate();
    });

    expect(result.current.error).toEqual(error);
    expect(result.current.loading).toBe(false);
    expect(result.current.events).toEqual([]);
  });

  it('should retry on error', async () => {
    const error = new Error('Network error');
    mockBackend.getEvents.mockRejectedValueOnce(error).mockResolvedValue([]);

    const { result, waitForNextUpdate } = renderHook(() => useEvents());

    await act(async () => {
      await waitForNextUpdate();
    });

    expect(result.current.error).toEqual(error);

    // Retry
    await act(async () => {
      result.current.retry();
      await waitForNextUpdate();
    });

    expect(result.current.error).toBeNull();
    expect(mockBackend.getEvents).toHaveBeenCalledTimes(2);
  });

  it('should load more events for pagination', async () => {
    const initialEvents = [
      { id: '1', event_type: 'session_start', timestamp: '2023-01-01T00:00:00Z' },
    ];
    const moreEvents = [
      { id: '2', event_type: 'pre_tool_use', timestamp: '2023-01-01T00:01:00Z' },
    ];

    mockBackend.getEvents
      .mockResolvedValueOnce(initialEvents)
      .mockResolvedValueOnce(moreEvents);

    const { result, waitForNextUpdate } = renderHook(() => useEvents({ limit: 1 }));

    await act(async () => {
      await waitForNextUpdate();
    });

    expect(result.current.events).toEqual(initialEvents);
    expect(result.current.hasMore).toBe(true);

    // Load more
    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.events).toEqual([...initialEvents, ...moreEvents]);
    expect(mockBackend.getEvents).toHaveBeenCalledTimes(2);
    expect(mockBackend.getEvents).toHaveBeenNthCalledWith(2, 
      expect.objectContaining({
        offset: 1,
        limit: 1,
      })
    );
  });

  it('should prevent duplicate events in real-time updates', async () => {
    const mockEventCallback = jest.fn();
    mockBackend.subscribeToEvents.mockImplementation((callback) => {
      mockEventCallback.mockImplementation(callback);
      return { unsubscribe: jest.fn() };
    });

    const initialEvents = [
      { id: '1', event_type: 'session_start', timestamp: '2023-01-01T00:00:00Z' },
    ];
    mockBackend.getEvents.mockResolvedValue(initialEvents);

    const { result, waitForNextUpdate } = renderHook(() => useEvents());

    await act(async () => {
      await waitForNextUpdate();
    });

    // Try to add the same event via real-time
    const duplicateEvent = initialEvents[0];

    act(() => {
      mockEventCallback(duplicateEvent);
    });

    // Should not duplicate
    expect(result.current.events).toEqual(initialEvents);
  });

  it('should cleanup subscriptions on unmount', async () => {
    const unsubscribeMock = jest.fn();
    mockBackend.subscribeToEvents.mockReturnValue({ unsubscribe: unsubscribeMock });
    mockBackend.onConnectionStatusChange.mockReturnValue({ unsubscribe: jest.fn() });

    const { waitForNextUpdate, unmount } = renderHook(() => useEvents());

    await act(async () => {
      await waitForNextUpdate();
    });

    unmount();

    expect(unsubscribeMock).toHaveBeenCalled();
  });
});