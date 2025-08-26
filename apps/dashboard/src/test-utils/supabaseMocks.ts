import { createMockEvent, createMockSession } from './mockData';

// Comprehensive Supabase mocking utilities
export interface MockSupabaseChannel {
  subscribe: jest.Mock;
  unsubscribe: jest.Mock;
  on: jest.Mock;
  send: jest.Mock;
}

export interface MockSupabaseClient {
  from: jest.Mock;
  channel: jest.Mock;
  auth: {
    getSession: jest.Mock;
    onAuthStateChange: jest.Mock;
  };
  realtime: {
    isConnected: jest.Mock;
    connect: jest.Mock;
    disconnect: jest.Mock;
  };
}

export const createMockSupabaseChannel = (): MockSupabaseChannel => ({
  subscribe: jest.fn().mockImplementation((callback) => {
    // Simulate successful subscription
    setTimeout(() => callback?.('SUBSCRIBED'), 0);
    return {
      unsubscribe: jest.fn().mockResolvedValue(undefined),
    };
  }),
  unsubscribe: jest.fn().mockResolvedValue(undefined),
  on: jest.fn().mockReturnThis(),
  send: jest.fn().mockResolvedValue({ status: 'ok' }),
});

export const createMockSupabaseClient = (): MockSupabaseClient => {
  const mockChannel = createMockSupabaseChannel();
  
  // Create a comprehensive query builder mock that supports chaining
  const createQueryBuilder = (defaultData = [createMockEvent()]) => {
    const builder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      gt: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({
        data: defaultData,
        error: null,
      }),
      range: jest.fn().mockResolvedValue({
        data: defaultData,
        error: null,
      }),
      textSearch: jest.fn().mockReturnThis(),
    };
    
    // Set up the chain to return the resolved value for terminal methods only
    Object.keys(builder).forEach(key => {
      if (key !== 'limit' && key !== 'range') {
        builder[key].mockReturnValue(builder);
      }
    });
    
    return builder;
  };
  
  return {
    from: jest.fn().mockReturnValue({
      ...createQueryBuilder(),
      insert: jest.fn().mockResolvedValue({
        data: [createMockEvent()],
        error: null,
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: [createMockEvent()],
          error: null,
        }),
      }),
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }),
    }),
    channel: jest.fn().mockReturnValue(mockChannel),
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
    },
    realtime: {
      isConnected: jest.fn().mockReturnValue(true),
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
    },
  };
};

// Mock connection manager
export const createMockConnectionManager = () => ({
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
});

// Mock useSupabaseConnection hook
export const mockUseSupabaseConnection = {
  useSupabaseConnection: jest.fn(() => createMockConnectionManager()),
};

// Real-time event simulation
export class MockRealtimeChannel {
  private callbacks: Map<string, Function[]> = new Map();
  private subscriptionCallback?: Function;

  on(event: string, callback: Function) {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, []);
    }
    this.callbacks.get(event)!.push(callback);
    return this;
  }

  subscribe(callback?: Function) {
    this.subscriptionCallback = callback;
    // Simulate successful subscription
    setTimeout(() => callback?.('SUBSCRIBED'), 0);
    return this;
  }

  unsubscribe() {
    this.callbacks.clear();
    this.subscriptionCallback = undefined;
    return Promise.resolve();
  }

  // Test utilities
  simulateEvent(eventType: string, payload: any) {
    const callbacks = this.callbacks.get(eventType) || [];
    callbacks.forEach(callback => callback(payload));
  }

  simulateInsert(data: any) {
    this.simulateEvent('postgres_changes', {
      eventType: 'INSERT',
      new: data,
      old: null,
    });
  }

  simulateUpdate(newData: any, oldData: any) {
    this.simulateEvent('postgres_changes', {
      eventType: 'UPDATE',
      new: newData,
      old: oldData,
    });
  }

  simulateDelete(data: any) {
    this.simulateEvent('postgres_changes', {
      eventType: 'DELETE',
      new: null,
      old: data,
    });
  }

  simulateDisconnect() {
    this.simulateEvent('system', { status: 'disconnected' });
  }

  simulateReconnect() {
    this.simulateEvent('system', { status: 'connected' });
  }
}

// Performance testing utilities for Supabase
export const createPerformanceTestClient = (latencyMs: number = 50) => {
  const client = createMockSupabaseClient();
  
  // Add latency to all database operations
  const addLatency = (originalMethod: jest.Mock) => {
    return originalMethod.mockImplementation((...args) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(originalMethod.getMockImplementation()?.(...args) || { data: [], error: null });
        }, latencyMs);
      });
    });
  };

  // Apply latency to common operations
  const fromMock = client.from();
  addLatency(fromMock.select().limit);
  addLatency(fromMock.insert);
  
  return client;
};

// Mock SWR with Supabase data
export const createMockSWRConfig = (data: any = [], error: any = null) => ({
  provider: () => new Map(),
  dedupingInterval: 0,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  fallback: {
    '/api/events': { data, error },
    '/api/sessions': { data, error },
  },
});

// Integration test helpers
export const setupSupabaseIntegrationTest = () => {
  const mockClient = createMockSupabaseClient();
  const mockChannel = new MockRealtimeChannel();
  
  // Override channel creation to return our mock
  mockClient.channel.mockReturnValue(mockChannel);
  
  return {
    client: mockClient,
    channel: mockChannel,
    cleanup: () => {
      jest.clearAllMocks();
    },
  };
};

// Error simulation utilities
export const simulateSupabaseErrors = {
  networkError: () => ({
    data: null,
    error: { message: 'Network error', code: 'NETWORK_ERROR' },
  }),
  
  authError: () => ({
    data: null,
    error: { message: 'Authentication failed', code: 'AUTH_ERROR' },
  }),
  
  rateLimitError: () => ({
    data: null,
    error: { message: 'Rate limit exceeded', code: 'RATE_LIMIT' },
  }),
  
  timeoutError: () => ({
    data: null,
    error: { message: 'Request timeout', code: 'TIMEOUT' },
  }),
};