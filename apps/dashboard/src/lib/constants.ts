/**
 * Shared timing constants for the Chronicle Dashboard
 * Single source of truth for all timing-related values
 */

// Connection and debouncing delays
export const CONNECTION_DELAYS = {
  /** Default debounce delay for connection state updates */
  DEBOUNCE_DELAY: 300,
  /** Delay before showing connecting state to prevent flicker */
  CONNECTING_DISPLAY_DELAY: 500,
  /** Standard reconnection delay after connection loss */
  RECONNECT_DELAY: 2000,
  /** Quick reconnection delay for temporary issues */
  QUICK_RECONNECT_DELAY: 1000,
} as const;

// Health check and monitoring intervals
export const MONITORING_INTERVALS = {
  /** Interval for health check pings to Supabase */
  HEALTH_CHECK_INTERVAL: 30000, // 30 seconds
  /** Interval for realtime heartbeat */
  REALTIME_HEARTBEAT_INTERVAL: 30000, // 30 seconds
  /** Time threshold for considering events recent */
  RECENT_EVENT_THRESHOLD: 30000, // 30 seconds
} as const;

// UI animation and feedback delays
export const UI_DELAYS = {
  /** Duration for CSS transitions and animations */
  ANIMATION_DURATION: 300,
  /** Delay for showing feedback messages */
  FEEDBACK_DISPLAY_DELAY: 2000,
  /** Delay for auto-dismissing notifications */
  NOTIFICATION_DISMISS_DELAY: 2000,
} as const;

// Performance and testing constants
export const PERFORMANCE_CONSTANTS = {
  /** Frame rate target for smooth animations */
  TARGET_FRAME_RATE: 16, // ~60fps
  /** Delay for simulating async operations in tests */
  TEST_ASYNC_DELAY: 10,
} as const;

// Time conversion and calculation constants
export const TIME_CONSTANTS = {
  /** Milliseconds in one second - for time calculations */
  MILLISECONDS_PER_SECOND: 1000,
  /** Milliseconds in one day - for 24-hour filtering */
  ONE_DAY_MS: 24 * 60 * 60 * 1000,
  /** Demo event generation interval */
  DEMO_EVENT_INTERVAL: 1500,
  /** Interval update for real-time displays */
  REALTIME_UPDATE_INTERVAL: 1000,
} as const;

// Standard CSS animation classes and styles
export const CSS_CLASSES = {
  /** Standard transition animation class */
  TRANSITION_ANIMATION: 'transition-all duration-300 ease-out',
  /** Connection status indicator animation */
  CONNECTION_INDICATOR: 'w-2 h-2 rounded-full transition-all duration-300',
} as const;

// Export all constants as a single object for convenience
export const TIMING_CONSTANTS = {
  ...CONNECTION_DELAYS,
  ...MONITORING_INTERVALS,
  ...UI_DELAYS,
  ...PERFORMANCE_CONSTANTS,
  ...TIME_CONSTANTS,
} as const;