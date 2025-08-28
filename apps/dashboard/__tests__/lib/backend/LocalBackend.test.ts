/**
 * Tests for LocalBackend implementation
 */

import { LocalBackend } from '../../../src/lib/backend/LocalBackend';
import { ConnectionError, TimeoutError } from '../../../src/lib/backend';

// Mock fetch
global.fetch = jest.fn();

// Mock WebSocket
class MockWebSocket {
  public readyState: number = WebSocket.CONNECTING;
  public onopen: ((event: Event) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;

  constructor(public url: string) {
    // Simulate async connection
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      this.onopen?.(new Event('open'));
    }, 10);
  }

  send(data: string) {
    // Mock send
  }

  close(code?: number, reason?: string) {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close', { code, reason }));
  }
}

// @ts-ignore
global.WebSocket = MockWebSocket;

// Mock AbortSignal.timeout
global.AbortSignal.timeout = jest.fn().mockImplementation((ms: number) => ({
  aborted: false,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}));

// Mock logger
jest.mock('../../../src/lib/utils', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('LocalBackend', () => {
  let backend: LocalBackend;
  const serverUrl = 'http://localhost:8510';

  beforeEach(() => {
    backend = new LocalBackend(serverUrl);
    jest.clearAllMocks();
    (fetch as jest.Mock).mockClear();
  });

  afterEach(async () => {
    await backend.disconnect();
  });

  describe('connection management', () => {
    it('should initialize with disconnected status', () => {
      expect(backend.getConnectionStatus()).toBe('disconnected');
    });

    it('should connect successfully', async () => {
      // Mock successful health check
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
      });

      await backend.connect();

      expect(backend.getConnectionStatus()).toBe('connected');
      expect(fetch).toHaveBeenCalledWith(`${serverUrl}/health`, expect.any(Object));
    });

    it('should handle connection failure', async () => {
      // Mock failed health check
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Connection failed'));

      await expect(backend.connect()).rejects.toThrow(ConnectionError);
      expect(backend.getConnectionStatus()).toBe('error');
    });

    it('should disconnect cleanly', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
      await backend.connect();

      await backend.disconnect();

      expect(backend.getConnectionStatus()).toBe('disconnected');
    });

    it('should handle multiple connect calls gracefully', async () => {
      (fetch as jest.Mock).mockResolvedValue({ ok: true });

      // Call connect multiple times simultaneously
      const promises = [backend.connect(), backend.connect(), backend.connect()];
      await Promise.all(promises);

      expect(backend.getConnectionStatus()).toBe('connected');
      // Health check should only be called once during connection setup
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('connection status callbacks', () => {
    it('should notify callbacks on status change', async () => {
      const callback = jest.fn();
      const subscription = backend.onConnectionStatusChange(callback);

      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
      await backend.connect();

      expect(callback).toHaveBeenCalledWith('connecting');
      expect(callback).toHaveBeenCalledWith('connected');

      subscription.unsubscribe();
    });

    it('should remove callback on unsubscribe', async () => {
      const callback = jest.fn();
      const subscription = backend.onConnectionStatusChange(callback);
      subscription.unsubscribe();

      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
      await backend.connect();

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('events API', () => {
    beforeEach(async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true }); // Health check
      await backend.connect();
    });

    it('should fetch events with basic filters', async () => {
      const mockEvents = [
        { id: '1', event_type: 'session_start', timestamp: '2023-01-01T00:00:00Z' },
        { id: '2', event_type: 'pre_tool_use', timestamp: '2023-01-01T00:01:00Z' },
      ];

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ events: mockEvents }),
      });

      const events = await backend.getEvents({
        limit: 10,
        sessionIds: ['session-1'],
      });

      expect(events).toEqual(mockEvents);
      expect(fetch).toHaveBeenCalledWith(
        `${serverUrl}/api/events?limit=10&session_ids=session-1`,
        expect.objectContaining({
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should handle event filters correctly', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ events: [] }),
      });

      await backend.getEvents({
        limit: 50,
        offset: 100,
        sessionIds: ['session-1', 'session-2'],
        eventTypes: ['pre_tool_use', 'post_tool_use'],
        searchQuery: 'test query',
        dateRange: {
          start: new Date('2023-01-01'),
          end: new Date('2023-01-02'),
        },
      });

      const expectedUrl = new URL(`${serverUrl}/api/events`);
      expectedUrl.searchParams.set('limit', '50');
      expectedUrl.searchParams.set('offset', '100');
      expectedUrl.searchParams.set('session_ids', 'session-1,session-2');
      expectedUrl.searchParams.set('event_types', 'pre_tool_use,post_tool_use');
      expectedUrl.searchParams.set('search', 'test query');
      expectedUrl.searchParams.set('start_date', '2023-01-01T00:00:00.000Z');
      expectedUrl.searchParams.set('end_date', '2023-01-02T00:00:00.000Z');

      expect(fetch).toHaveBeenCalledWith(
        expectedUrl.toString(),
        expect.any(Object)
      );
    });

    it('should handle fetch errors', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(backend.getEvents()).rejects.toThrow(ConnectionError);
    });

    it('should handle HTTP errors', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(backend.getEvents()).rejects.toThrow(ConnectionError);
    });
  });

  describe('sessions API', () => {
    beforeEach(async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true }); // Health check
      await backend.connect();
    });

    it('should fetch sessions with filters', async () => {
      const mockSessions = [
        { id: 'session-1', start_time: '2023-01-01T00:00:00Z' },
        { id: 'session-2', start_time: '2023-01-01T01:00:00Z' },
      ];

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sessions: mockSessions }),
      });

      const sessions = await backend.getSessions({
        timeRangeMinutes: 60,
        includeEnded: true,
      });

      expect(sessions).toEqual(mockSessions);
      expect(fetch).toHaveBeenCalledWith(
        `${serverUrl}/api/sessions?time_range_minutes=60&include_ended=true`,
        expect.objectContaining({
          method: 'GET',
        })
      );
    });
  });

  describe('session summaries API', () => {
    beforeEach(async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true }); // Health check
      await backend.connect();
    });

    it('should fetch session summaries', async () => {
      const mockSummaries = [
        { session_id: 'session-1', total_events: 10, tool_usage_count: 5, error_count: 0 },
      ];

      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ summaries: mockSummaries }),
      });

      const summaries = await backend.getSessionSummaries(['session-1']);

      expect(summaries).toEqual(mockSummaries);
      expect(fetch).toHaveBeenCalledWith(
        `${serverUrl}/api/sessions/summaries`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_ids: ['session-1'] }),
        })
      );
    });

    it('should return empty array for empty session IDs', async () => {
      const summaries = await backend.getSessionSummaries([]);

      expect(summaries).toEqual([]);
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('real-time subscriptions', () => {
    beforeEach(async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true }); // Health check
      await backend.connect();
      // Wait for WebSocket to connect
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    it('should handle event subscriptions', () => {
      const callback = jest.fn();
      const subscription = backend.subscribeToEvents(callback);

      // Simulate receiving an event via WebSocket
      const mockEvent = { id: '1', event_type: 'session_start', timestamp: '2023-01-01T00:00:00Z' };
      const wsMessage = { type: 'event', data: mockEvent };
      
      // Access the WebSocket mock to trigger message
      const ws = (backend as any).ws as MockWebSocket;
      ws.onmessage?.(new MessageEvent('message', { data: JSON.stringify(wsMessage) }));

      expect(callback).toHaveBeenCalledWith(mockEvent);

      subscription.unsubscribe();
    });

    it('should handle session subscriptions', () => {
      const callback = jest.fn();
      const subscription = backend.subscribeToSessions(callback);

      // Simulate receiving a session via WebSocket
      const mockSession = { id: 'session-1', start_time: '2023-01-01T00:00:00Z' };
      const wsMessage = { type: 'session', data: mockSession };
      
      const ws = (backend as any).ws as MockWebSocket;
      ws.onmessage?.(new MessageEvent('message', { data: JSON.stringify(wsMessage) }));

      expect(callback).toHaveBeenCalledWith(mockSession);

      subscription.unsubscribe();
    });

    it('should handle WebSocket errors gracefully', () => {
      const callback = jest.fn();
      backend.subscribeToEvents(callback);

      // Simulate WebSocket error message
      const wsMessage = { type: 'error', error: 'Something went wrong' };
      
      const ws = (backend as any).ws as MockWebSocket;
      ws.onmessage?.(new MessageEvent('message', { data: JSON.stringify(wsMessage) }));

      // Should not crash and callback should not be called
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('health check', () => {
    it('should return true for successful health check', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

      const isHealthy = await backend.healthCheck();

      expect(isHealthy).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        `${serverUrl}/health`,
        expect.objectContaining({
          method: 'GET',
          signal: expect.any(Object),
        })
      );
    });

    it('should return false for failed health check', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const isHealthy = await backend.healthCheck();

      expect(isHealthy).toBe(false);
    });
  });

  describe('metadata', () => {
    it('should return backend metadata', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ version: '1.0.0' }),
      });

      const metadata = await backend.getMetadata();

      expect(metadata).toEqual({
        type: 'local',
        version: '1.0.0',
        capabilities: {
          realtime: true,
          websockets: true,
          analytics: true,
          export: true,
        },
        connectionInfo: {
          url: serverUrl,
          lastPing: null,
        },
      });
    });

    it('should handle metadata fetch failure', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const metadata = await backend.getMetadata();

      expect(metadata.type).toBe('local');
      expect(metadata.version).toBe('unknown');
      expect(metadata.capabilities.realtime).toBe(false);
    });
  });
});