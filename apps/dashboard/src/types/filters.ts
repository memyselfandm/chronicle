/**
 * Filter-related type definitions for the Chronicle Dashboard
 */

/**
 * Available event types that can be filtered
 */
export type EventType = 
  | 'session_start'
  | 'pre_tool_use'
  | 'post_tool_use'
  | 'user_prompt_submit'
  | 'stop'
  | 'subagent_stop'
  | 'pre_compact'
  | 'notification'
  | 'error';

/**
 * Type guard to check if a string is a valid EventType
 */
export const isValidEventType = (type: any): type is EventType => {
  return [
    'session_start',
    'pre_tool_use',
    'post_tool_use',
    'user_prompt_submit',
    'stop',
    'subagent_stop',
    'pre_compact',
    'notification',
    'error'
  ].includes(type);
};

/**
 * Filter state interface for managing event filtering
 */
export interface FilterState {
  /** Array of selected event types to filter by */
  eventTypes: EventType[];
  /** Whether to show all events (no filtering) */
  showAll: boolean;
}

/**
 * Props for components that handle filter changes
 */
export interface FilterChangeHandler {
  /** Callback function when filters are updated */
  onFilterChange: (filters: FilterState) => void;
}

/**
 * Extended filter state that includes additional filtering options
 * for future implementation
 */
export interface ExtendedFilterState extends FilterState {
  /** Session IDs to filter by */
  sessionIds?: string[];
  /** Date range for filtering events */
  dateRange?: {
    start: Date;
    end: Date;
  } | null;
  /** Search query for text-based filtering */
  searchQuery?: string;
}

/**
 * Utility type for filter option configuration
 */
export interface FilterOption {
  /** Unique identifier for the filter option */
  value: string;
  /** Display label for the filter option */
  label: string;
  /** Whether this option is currently selected */
  selected: boolean;
  /** Number of items matching this filter (optional) */
  count?: number;
}

/**
 * Event filtering utilities
 */
export interface EventFilterUtils {
  /** Format event type for display */
  formatEventType: (eventType: EventType) => string;
  /** Check if an event matches the current filters */
  matchesFilter: (event: any, filters: FilterState) => boolean;
  /** Get all unique event types from a list of events */
  getUniqueEventTypes: (events: any[]) => EventType[];
}