import {
  formatEventType,
  eventMatchesFilter,
  filterEvents,
  getUniqueEventTypes,
  countEventsByType,
  getFilteredEventCounts,
  createFilterState,
  toggleEventTypeFilter,
  clearAllFilters,
  isDefaultFilterState,
  getFilterDescription,
  validateFilterState,
} from '../../src/lib/filterUtils';
import { Event } from '../../src/types/events';
import { FilterState, EventType } from '../../src/types/filters';

describe('filterUtils', () => {
  // Mock event data for testing
  const mockEvents: Event[] = [
    {
      id: 'event-1',
      session_id: 'session-1',
      event_type: 'user_prompt_submit',
      timestamp: new Date('2024-01-01T00:00:00Z'),
      metadata: { message: 'Hello' },
      created_at: new Date('2024-01-01T00:00:00Z'),
    },
    {
      id: 'event-2',
      session_id: 'session-1',
      event_type: 'post_tool_use',
      timestamp: new Date('2024-01-01T00:01:00Z'),
      metadata: { tool: 'read_file' },
      created_at: new Date('2024-01-01T00:01:00Z'),
    },
    {
      id: 'event-3',
      session_id: 'session-2',
      event_type: 'user_prompt_submit',
      timestamp: new Date('2024-01-01T00:02:00Z'),
      metadata: { message: 'Hi' },
      created_at: new Date('2024-01-01T00:02:00Z'),
    },
    {
      id: 'event-4',
      session_id: 'session-2',
      event_type: 'error',
      timestamp: new Date('2024-01-01T00:03:00Z'),
      metadata: { error: 'Test error' },
      created_at: new Date('2024-01-01T00:03:00Z'),
    },
    {
      id: 'event-5',
      session_id: 'session-1',
      event_type: 'pre_tool_use',
      timestamp: new Date('2024-01-01T00:04:00Z'),
      metadata: { tool: 'write_file' },
      created_at: new Date('2024-01-01T00:04:00Z'),
    },
  ];

  describe('formatEventType', () => {
    it('should format event type with proper capitalization and spacing', () => {
      expect(formatEventType('user_prompt_submit')).toBe('User Prompt Submit');
      expect(formatEventType('post_tool_use')).toBe('Post Tool Use');
      expect(formatEventType('error')).toBe('Error');
      expect(formatEventType('session_start')).toBe('Session Start');
    });

    it('should handle single word event types', () => {
      expect(formatEventType('start')).toBe('Start');
      expect(formatEventType('stop')).toBe('Stop');
      expect(formatEventType('notification')).toBe('Notification');
    });

    it('should handle empty string', () => {
      expect(formatEventType('' as EventType)).toBe('');
    });

    it('should handle event types with multiple underscores', () => {
      expect(formatEventType('multi_word_event_type' as EventType)).toBe('Multi Word Event Type');
    });
  });

  describe('eventMatchesFilter', () => {
    it('should return true when showAll is enabled', () => {
      const filters: FilterState = { eventTypes: [], showAll: true };
      
      mockEvents.forEach(event => {
        expect(eventMatchesFilter(event, filters)).toBe(true);
      });
    });

    it('should return true when no event types are specified', () => {
      const filters: FilterState = { eventTypes: [], showAll: false };
      
      mockEvents.forEach(event => {
        expect(eventMatchesFilter(event, filters)).toBe(true);
      });
    });

    it('should return true when event type is in filter', () => {
      const filters: FilterState = { 
        eventTypes: ['user_prompt_submit', 'error'], 
        showAll: false 
      };
      
      expect(eventMatchesFilter(mockEvents[0], filters)).toBe(true); // user_prompt_submit
      expect(eventMatchesFilter(mockEvents[3], filters)).toBe(true); // error
    });

    it('should return false when event type is not in filter', () => {
      const filters: FilterState = { 
        eventTypes: ['user_prompt_submit'], 
        showAll: false 
      };
      
      expect(eventMatchesFilter(mockEvents[1], filters)).toBe(false); // post_tool_use
      expect(eventMatchesFilter(mockEvents[3], filters)).toBe(false); // error
    });
  });

  describe('filterEvents', () => {
    it('should return all events when showAll is true', () => {
      const filters: FilterState = { eventTypes: ['error'], showAll: true };
      const result = filterEvents(mockEvents, filters);
      
      expect(result).toEqual(mockEvents);
      expect(result.length).toBe(5);
    });

    it('should return all events when no event types are specified', () => {
      const filters: FilterState = { eventTypes: [], showAll: false };
      const result = filterEvents(mockEvents, filters);
      
      expect(result).toEqual(mockEvents);
    });

    it('should filter events by single event type', () => {
      const filters: FilterState = { 
        eventTypes: ['user_prompt_submit'], 
        showAll: false 
      };
      const result = filterEvents(mockEvents, filters);
      
      expect(result).toHaveLength(2);
      expect(result.every(event => event.event_type === 'user_prompt_submit')).toBe(true);
    });

    it('should filter events by multiple event types', () => {
      const filters: FilterState = { 
        eventTypes: ['user_prompt_submit', 'error'], 
        showAll: false 
      };
      const result = filterEvents(mockEvents, filters);
      
      expect(result).toHaveLength(3);
      expect(result.every(event => 
        event.event_type === 'user_prompt_submit' || event.event_type === 'error'
      )).toBe(true);
    });

    it('should return empty array when no events match filter', () => {
      const filters: FilterState = { 
        eventTypes: ['nonexistent_type' as EventType], 
        showAll: false 
      };
      const result = filterEvents(mockEvents, filters);
      
      expect(result).toEqual([]);
    });

    it('should handle empty events array', () => {
      const filters: FilterState = { 
        eventTypes: ['user_prompt_submit'], 
        showAll: false 
      };
      const result = filterEvents([], filters);
      
      expect(result).toEqual([]);
    });
  });

  describe('getUniqueEventTypes', () => {
    it('should extract unique event types from events', () => {
      const result = getUniqueEventTypes(mockEvents);
      
      expect(result).toHaveLength(4);
      expect(result).toContain('user_prompt_submit');
      expect(result).toContain('post_tool_use');
      expect(result).toContain('error');
      expect(result).toContain('pre_tool_use');
    });

    it('should return sorted event types', () => {
      const result = getUniqueEventTypes(mockEvents);
      const sorted = [...result].sort();
      
      expect(result).toEqual(sorted);
    });

    it('should handle empty events array', () => {
      const result = getUniqueEventTypes([]);
      
      expect(result).toEqual([]);
    });

    it('should deduplicate event types', () => {
      const duplicateEvents = [
        { ...mockEvents[0], id: 'dup-1' },
        { ...mockEvents[0], id: 'dup-2' },
        { ...mockEvents[1], id: 'dup-3' },
      ];
      
      const result = getUniqueEventTypes(duplicateEvents);
      
      expect(result).toHaveLength(2);
      expect(result).toContain('user_prompt_submit');
      expect(result).toContain('post_tool_use');
    });
  });

  describe('countEventsByType', () => {
    it('should count events by type correctly', () => {
      const result = countEventsByType(mockEvents);
      
      expect(result['user_prompt_submit']).toBe(2);
      expect(result['post_tool_use']).toBe(1);
      expect(result['error']).toBe(1);
      expect(result['pre_tool_use']).toBe(1);
    });

    it('should handle empty events array', () => {
      const result = countEventsByType([]);
      
      expect(result).toEqual({});
    });

    it('should handle single event', () => {
      const result = countEventsByType([mockEvents[0]]);
      
      expect(result['user_prompt_submit']).toBe(1);
      expect(Object.keys(result)).toHaveLength(1);
    });
  });

  describe('getFilteredEventCounts', () => {
    it('should return counts for filtered events only', () => {
      const filters: FilterState = { 
        eventTypes: ['user_prompt_submit', 'error'], 
        showAll: false 
      };
      const result = getFilteredEventCounts(mockEvents, filters);
      
      expect(result['user_prompt_submit']).toBe(2);
      expect(result['error']).toBe(1);
      expect(result['post_tool_use']).toBeUndefined();
      expect(result['pre_tool_use']).toBeUndefined();
    });

    it('should return all counts when showAll is true', () => {
      const filters: FilterState = { eventTypes: [], showAll: true };
      const result = getFilteredEventCounts(mockEvents, filters);
      
      expect(result['user_prompt_submit']).toBe(2);
      expect(result['post_tool_use']).toBe(1);
      expect(result['error']).toBe(1);
      expect(result['pre_tool_use']).toBe(1);
    });
  });

  describe('createFilterState', () => {
    it('should create filter state with specified event types', () => {
      const eventTypes: EventType[] = ['user_prompt_submit', 'error'];
      const result = createFilterState(eventTypes);
      
      expect(result.eventTypes).toEqual(eventTypes);
      expect(result.showAll).toBe(false);
    });

    it('should create default filter state when no event types provided', () => {
      const result = createFilterState();
      
      expect(result.eventTypes).toEqual([]);
      expect(result.showAll).toBe(true);
    });

    it('should create default filter state with empty array', () => {
      const result = createFilterState([]);
      
      expect(result.eventTypes).toEqual([]);
      expect(result.showAll).toBe(true);
    });
  });

  describe('toggleEventTypeFilter', () => {
    it('should add event type when not currently selected', () => {
      const currentFilters: FilterState = { 
        eventTypes: ['user_prompt_submit'], 
        showAll: false 
      };
      const result = toggleEventTypeFilter(currentFilters, 'error');
      
      expect(result.eventTypes).toContain('user_prompt_submit');
      expect(result.eventTypes).toContain('error');
      expect(result.eventTypes).toHaveLength(2);
      expect(result.showAll).toBe(false);
    });

    it('should remove event type when currently selected', () => {
      const currentFilters: FilterState = { 
        eventTypes: ['user_prompt_submit', 'error'], 
        showAll: false 
      };
      const result = toggleEventTypeFilter(currentFilters, 'error');
      
      expect(result.eventTypes).toEqual(['user_prompt_submit']);
      expect(result.showAll).toBe(false);
    });

    it('should set showAll to true when removing last event type', () => {
      const currentFilters: FilterState = { 
        eventTypes: ['user_prompt_submit'], 
        showAll: false 
      };
      const result = toggleEventTypeFilter(currentFilters, 'user_prompt_submit');
      
      expect(result.eventTypes).toEqual([]);
      expect(result.showAll).toBe(true);
    });

    it('should add first event type to empty filter', () => {
      const currentFilters: FilterState = { eventTypes: [], showAll: true };
      const result = toggleEventTypeFilter(currentFilters, 'error');
      
      expect(result.eventTypes).toEqual(['error']);
      expect(result.showAll).toBe(false);
    });
  });

  describe('clearAllFilters', () => {
    it('should return default filter state', () => {
      const result = clearAllFilters();
      
      expect(result.eventTypes).toEqual([]);
      expect(result.showAll).toBe(true);
    });

    it('should always return consistent result', () => {
      const result1 = clearAllFilters();
      const result2 = clearAllFilters();
      
      expect(result1).toEqual(result2);
    });
  });

  describe('isDefaultFilterState', () => {
    it('should return true for default state', () => {
      const filters: FilterState = { eventTypes: [], showAll: true };
      
      expect(isDefaultFilterState(filters)).toBe(true);
    });

    it('should return false when event types are selected', () => {
      const filters: FilterState = { 
        eventTypes: ['user_prompt_submit'], 
        showAll: false 
      };
      
      expect(isDefaultFilterState(filters)).toBe(false);
    });

    it('should return false when showAll is false but no event types', () => {
      const filters: FilterState = { eventTypes: [], showAll: false };
      
      expect(isDefaultFilterState(filters)).toBe(false);
    });

    it('should return false when showAll is true but event types exist', () => {
      const filters: FilterState = { 
        eventTypes: ['user_prompt_submit'], 
        showAll: true 
      };
      
      expect(isDefaultFilterState(filters)).toBe(false);
    });
  });

  describe('getFilterDescription', () => {
    it('should return "Showing all events" for default state', () => {
      const filters: FilterState = { eventTypes: [], showAll: true };
      
      expect(getFilterDescription(filters)).toBe('Showing all events');
    });

    it('should return "Showing all events" when no event types but showAll false', () => {
      const filters: FilterState = { eventTypes: [], showAll: false };
      
      expect(getFilterDescription(filters)).toBe('Showing all events');
    });

    it('should describe single event type', () => {
      const filters: FilterState = { 
        eventTypes: ['user_prompt_submit'], 
        showAll: false 
      };
      
      expect(getFilterDescription(filters)).toBe('Showing User Prompt Submit events');
    });

    it('should describe two event types', () => {
      const filters: FilterState = { 
        eventTypes: ['user_prompt_submit', 'error'], 
        showAll: false 
      };
      
      expect(getFilterDescription(filters)).toBe('Showing User Prompt Submit and Error events');
    });

    it('should describe three event types', () => {
      const filters: FilterState = { 
        eventTypes: ['user_prompt_submit', 'error', 'post_tool_use'], 
        showAll: false 
      };
      
      expect(getFilterDescription(filters)).toBe('Showing User Prompt Submit, Error and Post Tool Use events');
    });

    it('should summarize many event types', () => {
      const filters: FilterState = { 
        eventTypes: ['user_prompt_submit', 'error', 'post_tool_use', 'pre_tool_use'], 
        showAll: false 
      };
      
      expect(getFilterDescription(filters)).toBe('Showing 4 event types');
    });

    it('should handle more than 4 event types', () => {
      const filters: FilterState = { 
        eventTypes: [
          'user_prompt_submit', 
          'error', 
          'post_tool_use', 
          'pre_tool_use',
          'session_start'
        ] as EventType[], 
        showAll: false 
      };
      
      expect(getFilterDescription(filters)).toBe('Showing 5 event types');
    });
  });

  describe('validateFilterState', () => {
    it('should set showAll to true when no event types are selected', () => {
      const invalidFilters: FilterState = { eventTypes: [], showAll: false };
      const result = validateFilterState(invalidFilters);
      
      expect(result.eventTypes).toEqual([]);
      expect(result.showAll).toBe(true);
    });

    it('should set showAll to false when event types are selected', () => {
      const invalidFilters: FilterState = { 
        eventTypes: ['user_prompt_submit'], 
        showAll: true 
      };
      const result = validateFilterState(invalidFilters);
      
      expect(result.eventTypes).toEqual(['user_prompt_submit']);
      expect(result.showAll).toBe(false);
    });

    it('should leave valid filter state unchanged', () => {
      const validFilters: FilterState = { 
        eventTypes: ['user_prompt_submit'], 
        showAll: false 
      };
      const result = validateFilterState(validFilters);
      
      expect(result).toEqual(validFilters);
    });

    it('should leave default state unchanged', () => {
      const defaultFilters: FilterState = { eventTypes: [], showAll: true };
      const result = validateFilterState(defaultFilters);
      
      expect(result).toEqual(defaultFilters);
    });

    it('should not mutate original filter object', () => {
      const originalFilters: FilterState = { eventTypes: [], showAll: false };
      const result = validateFilterState(originalFilters);
      
      expect(originalFilters.showAll).toBe(false); // Original unchanged
      expect(result.showAll).toBe(true); // Result corrected
      expect(result).not.toBe(originalFilters); // Different objects
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large numbers of events efficiently', () => {
      const largeEventSet = Array.from({ length: 10000 }, (_, i) => ({
        ...mockEvents[i % mockEvents.length],
        id: `event-${i}`,
      }));

      const filters: FilterState = { 
        eventTypes: ['user_prompt_submit'], 
        showAll: false 
      };

      const start = performance.now();
      const result = filterEvents(largeEventSet, filters);
      const end = performance.now();

      expect(result.length).toBeGreaterThan(0);
      expect(end - start).toBeLessThan(100); // Should complete in under 100ms
    });

    it('should handle events with undefined event_type gracefully', () => {
      const malformedEvents = [
        { ...mockEvents[0], event_type: undefined as any },
        mockEvents[1],
      ];

      expect(() => {
        getUniqueEventTypes(malformedEvents);
        countEventsByType(malformedEvents);
      }).not.toThrow();
    });

    it('should maintain reference equality for unchanged arrays', () => {
      const events = [mockEvents[0]];
      const filters: FilterState = { eventTypes: [], showAll: true };
      
      const result = filterEvents(events, filters);
      
      expect(result).toBe(events); // Same reference when no filtering needed
    });

    it('should handle complex filter state changes', () => {
      let filters: FilterState = { eventTypes: [], showAll: true };
      
      // Add multiple types
      filters = toggleEventTypeFilter(filters, 'user_prompt_submit');
      filters = toggleEventTypeFilter(filters, 'error');
      filters = toggleEventTypeFilter(filters, 'post_tool_use');
      
      expect(filters.eventTypes).toHaveLength(3);
      expect(filters.showAll).toBe(false);
      
      // Remove all types
      filters = toggleEventTypeFilter(filters, 'user_prompt_submit');
      filters = toggleEventTypeFilter(filters, 'error');
      filters = toggleEventTypeFilter(filters, 'post_tool_use');
      
      expect(filters.eventTypes).toEqual([]);
      expect(filters.showAll).toBe(true);
    });
  });
});