'use client';

import { useCallback, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { FilterState, EventType, FilterChangeHandler } from '@/types/filters';
import { cn } from '@/lib/utils';

interface EventFilterProps extends FilterChangeHandler {
  /** Current filter state */
  filters: FilterState;
  /** Available event types to filter by */
  availableEventTypes: EventType[];
  /** Optional className for styling */
  className?: string;
  /** Optional title for the filter section */
  title?: string;
}

/**
 * EventFilter component provides checkbox-based filtering for event types
 * with a "Show All" option that's selected by default
 */
export function EventFilter({
  filters,
  onFilterChange,
  availableEventTypes,
  className,
  title = "Event Type Filter"
}: EventFilterProps) {
  
  /**
   * Format event type string for display
   */
  const formatEventType = (eventType: EventType): string => {
    return eventType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  /**
   * Handle Show All checkbox change
   */
  const handleShowAllChange = useCallback((checked: boolean) => {
    onFilterChange({
      eventTypes: [],
      showAll: checked
    });
  }, [onFilterChange]);

  /**
   * Handle individual event type checkbox change
   */
  const handleEventTypeChange = useCallback((eventType: EventType, checked: boolean) => {
    let newEventTypes: EventType[];
    
    if (checked) {
      // Add the event type if not already present
      newEventTypes = filters.eventTypes.includes(eventType) 
        ? filters.eventTypes 
        : [...filters.eventTypes, eventType];
    } else {
      // Remove the event type
      newEventTypes = filters.eventTypes.filter(type => type !== eventType);
    }

    // Automatically set showAll to true if no event types are selected
    // Set showAll to false if any event types are selected
    const showAll = newEventTypes.length === 0;

    onFilterChange({
      eventTypes: newEventTypes,
      showAll
    });
  }, [filters.eventTypes, onFilterChange]);

  /**
   * Get the count of active filters for display
   */
  const getActiveFilterCount = (): number => {
    return filters.showAll ? 0 : filters.eventTypes.length;
  };

  return (
    <Card className={cn("p-4 bg-bg-secondary border-border", className)}>
      <div 
        role="group" 
        aria-label={title}
        className="space-y-3"
      >
        {/* Filter Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-text-primary">
            {title}
          </h3>
          {getActiveFilterCount() > 0 && (
            <Badge variant="info" className="text-xs">
              {getActiveFilterCount()} active
            </Badge>
          )}
        </div>

        {/* Show All Option */}
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="show-all-events"
            checked={filters.showAll}
            onChange={(e) => handleShowAllChange(e.target.checked)}
            className="h-4 w-4 rounded border-border text-accent-blue focus:ring-accent-blue focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-secondary bg-bg-tertiary"
            aria-label="Show All Events"
          />
          <label 
            htmlFor="show-all-events" 
            className="text-sm text-text-primary cursor-pointer select-none"
          >
            Show All
          </label>
        </div>

        {/* Event Type Checkboxes */}
        {availableEventTypes.length > 0 && (
          <div className="space-y-2 pl-2 border-l-2 border-border">
            {availableEventTypes.map((eventType) => {
              const isChecked = filters.eventTypes.includes(eventType);
              const displayName = formatEventType(eventType);
              const checkboxId = `event-type-${eventType}`;

              return (
                <div key={eventType} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={checkboxId}
                    checked={isChecked}
                    disabled={filters.showAll}
                    onChange={(e) => handleEventTypeChange(eventType, e.target.checked)}
                    className={cn(
                      "h-4 w-4 rounded border-border text-accent-blue focus:ring-accent-blue focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-secondary bg-bg-tertiary",
                      filters.showAll && "opacity-50 cursor-not-allowed"
                    )}
                    aria-label={displayName}
                  />
                  <label 
                    htmlFor={checkboxId} 
                    className={cn(
                      "text-sm cursor-pointer select-none",
                      filters.showAll ? "text-text-muted" : "text-text-secondary",
                      isChecked && !filters.showAll && "text-text-primary font-medium"
                    )}
                  >
                    {displayName}
                  </label>
                </div>
              );
            })}
          </div>
        )}

        {/* No Event Types Message */}
        {availableEventTypes.length === 0 && (
          <p className="text-sm text-text-muted italic pl-2">
            No event types available
          </p>
        )}
      </div>
    </Card>
  );
}

/**
 * Hook for managing event filter state
 */
export function useEventFilter(initialFilters?: Partial<FilterState>) {
  const [filters, setFilters] = useState<FilterState>({
    eventTypes: [],
    showAll: true,
    ...initialFilters
  });

  const updateFilters = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      eventTypes: [],
      showAll: true
    });
  }, []);

  const hasActiveFilters = useCallback(() => {
    return !filters.showAll && filters.eventTypes.length > 0;
  }, [filters]);

  return {
    filters,
    updateFilters,
    clearFilters,
    hasActiveFilters
  };
}

export default EventFilter;