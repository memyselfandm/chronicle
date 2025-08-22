import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import type { Database } from './types';
import { config, configUtils } from './config';
import { logger } from './utils';

// Get Supabase URL and key, prioritizing env vars for client-side
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || config.supabase.url || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || config.supabase.anonKey || '';

// Debug: Log what we're using
console.log('🔧 Supabase Client Initialization:', {
  url: supabaseUrl,
  keyPrefix: supabaseAnonKey ? supabaseAnonKey.substring(0, 20) + '...' : 'missing',
  hasEnvUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  hasEnvKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  hasConfigUrl: !!config.supabase.url,
  hasConfigKey: !!config.supabase.anonKey,
});

// Validate we have required config before creating client
if (!supabaseUrl || !supabaseAnonKey) {
  logger.warn('Supabase configuration missing. Dashboard will not be able to connect to the database.', {
    component: 'supabase',
    action: 'initialization'
  });
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