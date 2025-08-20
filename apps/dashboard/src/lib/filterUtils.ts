/**
 * Client-side filtering utilities for the Chronicle Dashboard
 */

import { FilterState, EventType } from '@/types/filters';
import { Event } from '@/types/events';

/**
 * Format event type for display in UI
 */
export function formatEventType(eventType: EventType): string {
  return eventType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

/**
 * Check if an event matches the current filter criteria
 */
export function eventMatchesFilter(event: Event, filters: FilterState): boolean {
  // If "Show All" is enabled, show all events
  if (filters.showAll) {
    return true;
  }

  // If no specific event types are selected, show all events
  if (filters.eventTypes.length === 0) {
    return true;
  }

  // Check if the event type is in the selected filter types
  return filters.eventTypes.includes(event.event_type);
}

/**
 * Filter an array of events based on the filter criteria
 */
export function filterEvents(events: Event[], filters: FilterState): Event[] {
  if (filters.showAll || filters.eventTypes.length === 0) {
    return events;
  }

  return events.filter(event => eventMatchesFilter(event, filters));
}

/**
 * Get unique event types from a list of events
 */
export function getUniqueEventTypes(events: Event[]): EventType[] {
  const uniqueTypes = new Set<EventType>();
  
  events.forEach(event => {
    uniqueTypes.add(event.event_type);
  });

  return Array.from(uniqueTypes).sort();
}

/**
 * Count events by type for the current filter
 */
export function countEventsByType(events: Event[]): Record<EventType, number> {
  const counts: Partial<Record<EventType, number>> = {};

  events.forEach(event => {
    counts[event.event_type] = (counts[event.event_type] || 0) + 1;
  });

  return counts as Record<EventType, number>;
}

/**
 * Get filtered event counts for each available event type
 */
export function getFilteredEventCounts(
  events: Event[], 
  filters: FilterState
): Record<EventType, number> {
  const filteredEvents = filterEvents(events, filters);
  return countEventsByType(filteredEvents);
}

/**
 * Create a filter state with specified event types
 */
export function createFilterState(eventTypes: EventType[] = []): FilterState {
  return {
    eventTypes,
    showAll: eventTypes.length === 0
  };
}

/**
 * Toggle an event type in the filter state
 */
export function toggleEventTypeFilter(
  currentFilters: FilterState, 
  eventType: EventType
): FilterState {
  const isCurrentlySelected = currentFilters.eventTypes.includes(eventType);
  
  let newEventTypes: EventType[];
  
  if (isCurrentlySelected) {
    // Remove the event type
    newEventTypes = currentFilters.eventTypes.filter(type => type !== eventType);
  } else {
    // Add the event type
    newEventTypes = [...currentFilters.eventTypes, eventType];
  }

  return {
    eventTypes: newEventTypes,
    showAll: newEventTypes.length === 0
  };
}

/**
 * Clear all filters and return to "Show All" state
 */
export function clearAllFilters(): FilterState {
  return {
    eventTypes: [],
    showAll: true
  };
}

/**
 * Check if filters are in their default "show all" state
 */
export function isDefaultFilterState(filters: FilterState): boolean {
  return filters.showAll && filters.eventTypes.length === 0;
}

/**
 * Get human-readable description of current filters
 */
export function getFilterDescription(filters: FilterState): string {
  if (filters.showAll || filters.eventTypes.length === 0) {
    return "Showing all events";
  }

  if (filters.eventTypes.length === 1) {
    return `Showing ${formatEventType(filters.eventTypes[0])} events`;
  }

  if (filters.eventTypes.length <= 3) {
    const formattedTypes = filters.eventTypes.map(formatEventType);
    const lastType = formattedTypes.pop();
    return `Showing ${formattedTypes.join(', ')} and ${lastType} events`;
  }

  return `Showing ${filters.eventTypes.length} event types`;
}

/**
 * Validate filter state for consistency
 */
export function validateFilterState(filters: FilterState): FilterState {
  // Ensure showAll is true when no event types are selected
  if (filters.eventTypes.length === 0 && !filters.showAll) {
    return {
      ...filters,
      showAll: true
    };
  }

  // Ensure showAll is false when event types are selected
  if (filters.eventTypes.length > 0 && filters.showAll) {
    return {
      ...filters,
      showAll: false
    };
  }

  return filters;
}