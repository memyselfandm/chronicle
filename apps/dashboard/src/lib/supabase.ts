import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import type { Database } from './types';
import { config, configUtils } from './config';

// Get Supabase URL and key, with fallbacks for client-side loading
const supabaseUrl = config.supabase.url || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = config.supabase.anonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Validate we have required config before creating client
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase configuration missing. Dashboard will not be able to connect to the database.');
}

// Create Supabase client with environment-aware configuration
export const supabase = createClient<Database>(
  supabaseUrl || 'http://localhost:54321', // Fallback to local Supabase
  supabaseAnonKey || 'placeholder-key-for-build', // Placeholder to prevent build errors
  {
    realtime: {
      params: {
        eventsPerSecond: configUtils.isProduction() ? 5 : 10, // Lower rate in production
        heartbeatIntervalMs: config.performance.realtimeHeartbeat,
        timeoutMs: config.performance.realtimeTimeout,
      },
    },
    auth: {
      persistSession: false, // We're not using auth for MVP
      detectSessionInUrl: false, // Disable for performance
    },
    global: {
      headers: {
        'X-Chronicle-Environment': config.environment,
        'X-Chronicle-Version': '1.0.0',
      },
    },
  }
);

/**
 * Creates a real-time channel with consistent configuration
 * @param channelName - Unique channel identifier
 * @param config - Optional channel configuration
 * @returns RealtimeChannel instance
 */
export const createRealtimeChannel = (
  channelName: string,
  config?: { private?: boolean }
): RealtimeChannel => {
  return supabase.channel(channelName, { config });
};

/**
 * Connection status type for monitoring
 */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * Real-time configuration based on environment settings
 */
export const REALTIME_CONFIG = {
  EVENTS_PER_SECOND: configUtils.isProduction() ? 5 : 10,
  RECONNECT_ATTEMPTS: 5,
  BATCH_SIZE: config.performance.batchSize,
  BATCH_DELAY: 100, // ms
  MAX_CACHED_EVENTS: config.performance.maxEventsDisplay,
  HEARTBEAT_INTERVAL: config.performance.realtimeHeartbeat,
  TIMEOUT: config.performance.realtimeTimeout,
} as const;