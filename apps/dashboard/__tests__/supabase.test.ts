import { REALTIME_CONFIG } from '../src/lib/supabase';

// Test the configuration constants and types
describe('Supabase Client Setup', () => {
  beforeEach(() => {
    // Mock environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  it('should have correct realtime configuration constants', () => {
    expect(REALTIME_CONFIG.EVENTS_PER_SECOND).toBe(10);
    expect(REALTIME_CONFIG.RECONNECT_ATTEMPTS).toBe(5);
    expect(REALTIME_CONFIG.BATCH_SIZE).toBe(50);
    expect(REALTIME_CONFIG.BATCH_DELAY).toBe(100);
    expect(REALTIME_CONFIG.MAX_CACHED_EVENTS).toBe(1000);
  });

  it('should throw error when environment variables are missing', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    expect(() => {
      jest.isolateModules(() => {
        require('../src/lib/supabase');
      });
    }).toThrow('Missing required Supabase environment variables');
  });

  it('should export supabase client when env vars are present', () => {
    // This test ensures the module can be imported without errors
    const { supabase } = require('../src/lib/supabase');
    expect(supabase).toBeDefined();
  });
});