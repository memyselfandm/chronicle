import { createClient, RealtimeChannel } from '@supabase/supabase-js';
import type { Database } from './types';

// Validate environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing required Supabase environment variables. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

// Create Supabase client with optimized real-time configuration
export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  realtime: {
    params: {
      eventsPerSecond: 10, // Limit to prevent flooding
    },
  },
  auth: {
    persistSession: false, // We're not using auth for MVP
  },
});

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
 * Default configuration for real-time subscriptions
 */
export const REALTIME_CONFIG = {
  EVENTS_PER_SECOND: 10,
  RECONNECT_ATTEMPTS: 5,
  BATCH_SIZE: 50,
  BATCH_DELAY: 100, // ms
  MAX_CACHED_EVENTS: 1000,
} as const;