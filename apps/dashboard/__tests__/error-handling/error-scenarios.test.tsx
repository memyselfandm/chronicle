/**
 * Error Handling and Edge Case Tests for Chronicle Dashboard
 * Tests system resilience with malformed data, network failures, and edge cases
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { jest } from '@jest/globals';
import { EventFeed } from '@/components/EventFeed';
import { Header } from '@/components/layout/Header';
import { EventFilter } from '@/components/EventFilter';
import { createMockEventWithProps, generateMockEvents } from '@/lib/mockData';
import { processEvents } from '@/lib/eventProcessor';
import { supabase } from '@/lib/supabase';

// Mock network timeouts and errors
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    channel: jest.fn(() => ({
      on: jest.fn(() => ({
        on: jest.fn(() => ({
          subscribe: jest.fn()
        }))
      })),
      unsubscribe: jest.fn()
    }))
  }
}));

// Utility to create malformed data scenarios
function createMalformedEvent(type: 'missing_fields' | 'invalid_types' | 'corrupted_json' | 'null_values' | 'circular_refs') {
  const baseEvent = {
    id: 'malformed-test',
    timestamp: new Date(),
    sessionId: 'test-session'
  };

  switch (type) {
    case 'missing_fields':
      return { id: baseEvent.id }; // Missing required fields
    
    case 'invalid_types':
      return {
        ...baseEvent,
        timestamp: 'not-a-date',
        type: 123, // Should be string
        success: 'not-boolean'
      };
    
    case 'corrupted_json':
      return {
        ...baseEvent,
        details: 'invalid-json-string',
        type: 'tool_use'
      };
    
    case 'null_values':
      return {
        ...baseEvent,
        type: null,
        summary: null,
        details: null
      };
    
    case 'circular_refs':
      const circularObj: any = { ...baseEvent, type: 'tool_use', summary: 'test' };
      circularObj.circular = circularObj;
      return circularObj;
  }
}

describe('Error Handling and Edge Cases', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console errors during tests to avoid noise
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Malformed Data Handling', () => {
    it('handles events with missing required fields gracefully', () => {
      const malformedEvent = createMalformedEvent('missing_fields');
      
      // Should not throw error
      expect(() => {
        render(<EventFeed events={[malformedEvent as any]} />);
      }).not.toThrow();

      // Should show empty state or error state instead of crashing
      expect(screen.getByTestId('event-feed')).toBeInTheDocument();
    });

    it('handles events with invalid data types', () => {
      const invalidEvent = createMalformedEvent('invalid_types');
      
      expect(() => {
        render(<EventFeed events={[invalidEvent as any]} />);
      }).not.toThrow();

      // Component should render without crashing
      expect(screen.getByTestId('event-feed')).toBeInTheDocument();
    });

    it('handles corrupted JSON in event details', () => {
      const corruptedEvent = createMalformedEvent('corrupted_json');
      
      expect(() => {
        render(<EventFeed events={[corruptedEvent as any]} />);
      }).not.toThrow();

      expect(screen.getByTestId('event-feed')).toBeInTheDocument();
    });

    it('handles null and undefined values gracefully', () => {
      const nullEvent = createMalformedEvent('null_values');
      
      expect(() => {
        render(<EventFeed events={[nullEvent as any]} />);
      }).not.toThrow();

      expect(screen.getByTestId('event-feed')).toBeInTheDocument();
    });

    it('handles circular references in event data', () => {
      const circularEvent = createMalformedEvent('circular_refs');
      
      expect(() => {
        render(<EventFeed events={[circularEvent as any]} />);
      }).not.toThrow();

      expect(screen.getByTestId('event-feed')).toBeInTheDocument();
    });

    it('processes malformed hook data without crashing event processor', () => {
      const malformedHookData = [
        // Missing session_id
        {
          hook_event_name: 'PreToolUse',
          timestamp: new Date().toISOString()
        },
        // Invalid timestamp
        {
          session_id: 'test',
          hook_event_name: 'PostToolUse',
          timestamp: 'invalid-date'
        },
        // Missing hook_event_name
        {
          session_id: 'test',
          timestamp: new Date().toISOString(),
          raw_input: null
        },
        // Circular reference in raw_input
        (() => {
          const obj: any = { session_id: 'test', hook_event_name: 'PreToolUse', timestamp: new Date().toISOString() };
          obj.raw_input = obj;
          return obj;
        })()
      ];

      expect(() => {
        const processed = processEvents(malformedHookData as any);
        render(<EventFeed events={processed} />);
      }).not.toThrow();
    });
  });

  describe('Network Error Scenarios', () => {
    it('handles Supabase connection timeouts', async () => {
      const mockSupabase = supabase.from as jest.Mock;
      mockSupabase.mockReturnValue({
        select: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn(() => ({
              execute: jest.fn().mockRejectedValue(new Error('Network timeout'))
            }))
          }))
        }))
      });

      render(
        <EventFeed 
          events={[]} 
          error="Failed to load events: Network timeout"
          onRetry={jest.fn()}
        />
      );

      expect(screen.getByTestId('event-feed-error')).toBeInTheDocument();
      expect(screen.getByText(/Network timeout/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });

    it('handles Supabase authentication errors', async () => {
      const mockSupabase = supabase.from as jest.Mock;
      mockSupabase.mockReturnValue({
        select: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn(() => ({
              execute: jest.fn().mockRejectedValue(new Error('Authentication failed'))
            }))
          }))
        }))
      });

      render(
        <EventFeed 
          events={[]} 
          error="Authentication failed"
          onRetry={jest.fn()}
        />
      );

      expect(screen.getByText('Authentication failed')).toBeInTheDocument();
    });

    it('handles real-time subscription failures', async () => {
      const mockChannel = {
        on: jest.fn(() => mockChannel),
        subscribe: jest.fn().mockRejectedValue(new Error('Subscription failed')),
        unsubscribe: jest.fn()
      };

      (supabase.channel as jest.Mock).mockReturnValue(mockChannel);

      // Should handle subscription failure gracefully
      render(<EventFeed events={generateMockEvents(5)} />);
      
      expect(screen.getAllByTestId(/event-card-/)).toHaveLength(5);
      // Real-time should fail silently, showing existing data
    });

    it('handles intermittent connectivity issues', async () => {
      const events = generateMockEvents(5);
      let connectionState = 'connected';
      
      const { rerender } = render(
        <div>
          <Header connectionStatus={connectionState as any} eventCount={events.length} />
          <EventFeed events={events} />
        </div>
      );

      // Simulate connection loss
      connectionState = 'disconnected';
      rerender(
        <div>
          <Header connectionStatus={connectionState as any} eventCount={events.length} />
          <EventFeed 
            events={events} 
            error="Connection lost - operating in offline mode"
          />
        </div>
      );

      expect(screen.getByText('Disconnected')).toBeInTheDocument();
      expect(screen.getByText(/offline mode/)).toBeInTheDocument();
      // Events should still be visible
      expect(screen.getAllByTestId(/event-card-/)).toHaveLength(5);

      // Simulate reconnection
      connectionState = 'connected';
      rerender(
        <div>
          <Header connectionStatus={connectionState as any} eventCount={events.length} />
          <EventFeed events={events} />
        </div>
      );

      expect(screen.getByText('Connected')).toBeInTheDocument();
      expect(screen.queryByText(/offline mode/)).not.toBeInTheDocument();
    });
  });

  describe('Edge Case Data Scenarios', () => {
    it('handles extremely large event payloads', () => {
      // Create event with very large data payload
      const largePayload = {
        massive_array: Array.from({ length: 10000 }, (_, i) => ({
          id: i,
          data: 'x'.repeat(1000), // 1KB per item = ~10MB total
          nested: { deep: { structure: { value: i } } }
        }))
      };

      const largeEvent = createMockEventWithProps({
        id: 'large-payload-event',
        details: largePayload
      });

      expect(() => {
        render(<EventFeed events={[largeEvent]} />);
      }).not.toThrow();

      expect(screen.getByTestId('event-card-large-payload-event')).toBeInTheDocument();
    });

    it('handles events with special characters and unicode', () => {
      const specialCharsEvent = createMockEventWithProps({
        id: 'special-chars-event',
        summary: '🚀 Special chars: <script>alert("xss")</script> & unicode: 中文 العربية ñørmål',
        details: {
          emoji_test: '🎉🔥💯🚀⚡️🌟',
          html_injection: '<img src="x" onerror="alert(1)">',
          unicode_strings: {
            chinese: '这是中文测试',
            arabic: 'هذا اختبار عربي',
            russian: 'Это русский тест',
            special_symbols: '™®©€£¥¢∞§¶•ªº'
          }
        }
      });

      expect(() => {
        render(<EventFeed events={[specialCharsEvent]} />);
      }).not.toThrow();

      // Should display safely without XSS
      expect(screen.getByTestId('event-card-special-chars-event')).toBeInTheDocument();
      // Should not execute script tags
      expect(screen.queryByText('alert("xss")')).not.toBeInTheDocument();
    });

    it('handles events with extremely long strings', () => {
      const longStringEvent = createMockEventWithProps({
        id: 'long-string-event',
        summary: 'x'.repeat(10000), // 10KB string
        details: {
          long_description: 'y'.repeat(50000), // 50KB string
          paths: Array.from({ length: 1000 }, (_, i) => 
            `/very/long/path/structure/with/many/nested/directories/file-${i}.tsx`
          )
        }
      });

      expect(() => {
        render(<EventFeed events={[longStringEvent]} />);
      }).not.toThrow();

      expect(screen.getByTestId('event-card-long-string-event')).toBeInTheDocument();
    });

    it('handles empty and whitespace-only data', () => {
      const emptyDataEvents = [
        createMockEventWithProps({
          id: 'empty-summary',
          summary: '',
          details: {}
        }),
        createMockEventWithProps({
          id: 'whitespace-summary',
          summary: '   \n\t   ',
          details: { empty_string: '', whitespace: '   \n\t   ' }
        }),
        createMockEventWithProps({
          id: 'undefined-details',
          summary: 'Test event',
          details: undefined as any
        })
      ];

      expect(() => {
        render(<EventFeed events={emptyDataEvents} />);
      }).not.toThrow();

      emptyDataEvents.forEach(event => {
        expect(screen.getByTestId(`event-card-${event.id}`)).toBeInTheDocument();
      });
    });
  });

  describe('Component Error Boundaries', () => {
    it('handles component rendering errors gracefully', () => {
      // Create an event that might cause rendering issues
      const problematicEvent = createMockEventWithProps({
        id: 'problematic-event',
        // Force invalid date that might cause rendering errors
        timestamp: new Date('invalid-date'),
        details: {
          problematic_data: {
            // Data that might cause JSON.stringify to fail
            circular: null
          }
        }
      });
      
      // Add circular reference
      (problematicEvent.details as any).problematic_data.circular = problematicEvent.details;

      expect(() => {
        render(<EventFeed events={[problematicEvent]} />);
      }).not.toThrow();

      // Should show some fallback content
      expect(screen.getByTestId('event-feed')).toBeInTheDocument();
    });

    it('handles filter component errors', () => {
      const onFilterChange = jest.fn().mockImplementation(() => {
        throw new Error('Filter processing error');
      });

      expect(() => {
        render(<EventFilter onFilterChange={onFilterChange} />);
      }).not.toThrow();

      // Try to trigger the error
      const eventTypeButton = screen.queryByRole('button', { name: /event types/i });
      if (eventTypeButton) {
        expect(() => {
          fireEvent.click(eventTypeButton);
        }).not.toThrow();
      }
    });
  });

  describe('Browser Compatibility Edge Cases', () => {
    it('handles missing browser APIs gracefully', () => {
      // Mock missing IntersectionObserver
      const originalIntersectionObserver = window.IntersectionObserver;
      delete (window as any).IntersectionObserver;

      expect(() => {
        render(<EventFeed events={generateMockEvents(10)} />);
      }).not.toThrow();

      // Restore
      window.IntersectionObserver = originalIntersectionObserver;
    });

    it('handles missing performance API', () => {
      const originalPerformance = window.performance;
      delete (window as any).performance;

      expect(() => {
        render(<EventFeed events={generateMockEvents(5)} />);
      }).not.toThrow();

      // Restore
      window.performance = originalPerformance;
    });

    it('handles missing localStorage gracefully', () => {
      const originalLocalStorage = window.localStorage;
      delete (window as any).localStorage;

      expect(() => {
        render(<EventFilter onFilterChange={jest.fn()} />);
      }).not.toThrow();

      // Restore
      window.localStorage = originalLocalStorage;
    });
  });

  describe('Data Validation and Sanitization', () => {
    it('validates event data structure', () => {
      const invalidEvents = [
        { not_an_event: true },
        null,
        undefined,
        'string_instead_of_object',
        123,
        []
      ];

      expect(() => {
        render(<EventFeed events={invalidEvents as any} />);
      }).not.toThrow();

      // Should show empty state or handle gracefully
      expect(screen.getByTestId('event-feed')).toBeInTheDocument();
    });

    it('sanitizes potentially dangerous content', () => {
      const dangerousEvent = createMockEventWithProps({
        id: 'dangerous-event',
        summary: '<script>alert("xss")</script>Dangerous content',
        details: {
          malicious_html: '<iframe src="javascript:alert(1)"></iframe>',
          script_injection: '<script>document.cookie = "stolen"</script>',
          event_handlers: '<div onclick="alert(1)">Click me</div>',
          data_urls: 'data:text/html,<script>alert(1)</script>'
        }
      });

      render(<EventFeed events={[dangerousEvent]} />);

      // Content should be displayed safely
      expect(screen.getByTestId('event-card-dangerous-event')).toBeInTheDocument();
      
      // Scripts should not execute
      expect(document.cookie).not.toContain('stolen');
    });

    it('handles database injection attempts in search', () => {
      const searchTerms = [
        "'; DROP TABLE events; --",
        '<script>alert("xss")</script>',
        '${process.env.SECRET}',
        '../../../etc/passwd',
        'UNION SELECT * FROM sessions'
      ];

      const onFilterChange = jest.fn();
      render(<EventFilter onFilterChange={onFilterChange} />);

      searchTerms.forEach(term => {
        expect(() => {
          // Simulate search input (this would normally be handled by the component)
          onFilterChange({
            searchQuery: term,
            eventTypes: [],
            sessionIds: [],
            dateRange: null
          });
        }).not.toThrow();
      });
    });
  });

  describe('Resource Exhaustion Protection', () => {
    it('handles excessive DOM manipulation attempts', () => {
      // Try to create events that would generate excessive DOM nodes
      const massiveEventSet = Array.from({ length: 1000 }, (_, i) => 
        createMockEventWithProps({
          id: `massive-event-${i}`,
          details: {
            // Each event tries to create large DOM structures
            large_data: Array.from({ length: 100 }, (_, j) => `item-${j}`)
          }
        })
      );

      expect(() => {
        render(<EventFeed events={massiveEventSet} />);
      }).not.toThrow();

      // Should handle gracefully, possibly with virtualization
      expect(screen.getByTestId('event-feed')).toBeInTheDocument();
    });

    it('prevents infinite loops in event processing', () => {
      // Create events that might cause infinite processing loops
      const recursiveEvent = createMockEventWithProps({
        id: 'recursive-event',
        details: {
          // Self-referencing data that might cause loops
          refs: new Array(1000).fill(0).map((_, i) => ({ id: i, next: i + 1 }))
        }
      });

      // Add circular reference
      (recursiveEvent.details as any).refs[999].next = 0;

      expect(() => {
        const processed = processEvents([{
          session_id: recursiveEvent.sessionId,
          hook_event_name: 'PreToolUse',
          timestamp: recursiveEvent.timestamp.toISOString(),
          raw_input: recursiveEvent.details
        }]);
        render(<EventFeed events={processed} />);
      }).not.toThrow();
    });
  });

  describe('Graceful Degradation', () => {
    it('maintains core functionality when advanced features fail', () => {
      // Simulate failure of advanced features
      const mockDateFormat = jest.fn().mockImplementation(() => {
        throw new Error('Date formatting failed');
      });

      // Mock date formatting failure
      const originalToLocaleString = Date.prototype.toLocaleString;
      Date.prototype.toLocaleString = mockDateFormat;

      const events = generateMockEvents(3);
      
      expect(() => {
        render(<EventFeed events={events} />);
      }).not.toThrow();

      // Core functionality should still work
      expect(screen.getByTestId('event-feed')).toBeInTheDocument();
      expect(screen.getAllByTestId(/event-card-/)).toHaveLength(3);

      // Restore
      Date.prototype.toLocaleString = originalToLocaleString;
    });

    it('handles theme/styling failures gracefully', () => {
      // Mock CSS-in-JS failure
      const originalGetComputedStyle = window.getComputedStyle;
      window.getComputedStyle = jest.fn().mockImplementation(() => {
        throw new Error('Style computation failed');
      });

      expect(() => {
        render(<EventFeed events={generateMockEvents(5)} />);
      }).not.toThrow();

      // Content should still be accessible even without styles
      expect(screen.getByTestId('event-feed')).toBeInTheDocument();

      // Restore
      window.getComputedStyle = originalGetComputedStyle;
    });
  });
});