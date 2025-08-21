/**
 * EventFeed V2 - High-performance event feed components
 * 
 * Exports all components for the new event feed system with:
 * - Dense 24px row layout
 * - Virtual scrolling for 1000+ events
 * - Event batching with 100ms windowing
 * - Semantic color coding per variant_3
 * - Sub-agent hierarchy support
 * - Auto-scroll management
 * - Performance monitoring
 */

// Main components
export { EventFeedV2, usePerformanceMonitoring } from './EventFeedV2';
export { EventTableV2 } from './EventTableV2';
export { EventRowV2 } from './EventRowV2';
export { VirtualizedList } from './VirtualizedList';

// Specialized components
export { SubAgentRow } from './SubAgentRow';
export { AutoScrollToggle } from './AutoScrollToggle';
export { EventDetails } from './EventDetails';

// Legacy components (for backwards compatibility)
export { FilterBadges, CompactFilterBadges, FilterSummary } from './FilterBadges';

// Type exports
export type { 
  EventFeedV2Props, 
  PerformanceMetrics 
} from './EventFeedV2';

export type { 
  EventTableV2Props 
} from './EventTableV2';

export type { 
  EventRowV2Props 
} from './EventRowV2';

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