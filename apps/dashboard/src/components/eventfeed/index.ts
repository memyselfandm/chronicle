/**
 * EventFeed - High-performance event feed components
 * 
 * Exports all components for the event feed system with:
 * - Dense 24px row layout
 * - Virtual scrolling for 1000+ events
 * - Event batching with 100ms windowing
 * - Semantic color coding per variant_3
 * - Sub-agent hierarchy support
 * - Auto-scroll management
 * - Performance monitoring
 */

// Main components
export { EventFeed, usePerformanceMonitoring } from './EventFeed';
export { EventTable } from './EventTable';
export { EventRow } from './EventRow';
export { VirtualizedList } from './VirtualizedList';

// Specialized components
export { SubAgentRow } from './SubAgentRow';
export { AutoScrollToggle } from './AutoScrollToggle';
export { EventDetails } from './EventDetails';

// Legacy components (for backwards compatibility)
export { FilterBadges, CompactFilterBadges, FilterSummary } from './FilterBadges';

// Type exports
export type { 
  EventFeedProps, 
  PerformanceMetrics 
} from './EventFeed';

export type { 
  EventTableProps 
} from './EventTable';

export type { 
  EventRowProps 
} from './EventRow';

export type { 
  VirtualizedListProps, 
  VirtualizedListRef 
} from './VirtualizedList';

export type { 
  SubAgentRowProps 
} from './SubAgentRow';

export type { 
  AutoScrollToggleProps 
} from './AutoScrollToggle';

export type { 
  EventDetailsProps 
} from './EventDetails';