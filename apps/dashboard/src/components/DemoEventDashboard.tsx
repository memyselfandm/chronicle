"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatedEventCard } from './AnimatedEventCard';
import { EventDetailModal } from './EventDetailModal';
import { ConnectionStatus, useConnectionStatus } from './ConnectionStatus';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader } from './ui/Card';
import type { Event } from '@/types/events';
import { TIME_CONSTANTS } from '@/lib/constants';
import { TimeoutManager } from '@/lib/utils';

// Mock data generator for demo
const generateMockEvent = (id: string): Event => {
  const types = ['session_start', 'pre_tool_use', 'post_tool_use', 'user_prompt_submit', 'stop', 'error', 'notification'] as const;
  const tools = ['Read', 'Write', 'Edit', 'Bash', 'Search', 'WebFetch'];
  
  const event_type = types[Math.floor(Math.random() * types.length)];
  const isToolEvent = event_type === 'pre_tool_use' || event_type === 'post_tool_use';
  
  return {
    id,
    session_id: `session-${Math.random().toString(36).substring(2, 15)}`,
    event_type,
    timestamp: new Date().toISOString(),
    metadata: {
      success: Math.random() > 0.3,
      ...(isToolEvent && {
        parameters: { 
          file_path: '/path/to/file.ts',
          content: 'Sample file content'
        },
        result: 'Operation completed successfully'
      }),
      ...(event_type === 'error' && {
        error_message: 'Something went wrong',
        error_type: 'RuntimeError'
      }),
      ...(event_type === 'notification' && {
        title: 'System Notification',
        message: 'Event processed successfully'
      }),
      ...Math.random() > 0.5 && {
        additional_context: {
          nested_data: {
            deep_value: 'test',
            array: [1, 2, 3],
            boolean: true,
            null_value: null
          }
        }
      }
    },
    tool_name: isToolEvent ? tools[Math.floor(Math.random() * tools.length)] : undefined,
    duration_ms: event_type === 'post_tool_use' ? Math.floor(Math.random() * TIME_CONSTANTS.MILLISECONDS_PER_SECOND) + 50 : undefined,
    created_at: new Date().toISOString()
  };
};

const generateSessionContext = () => ({
  projectPath: '/Users/developer/my-project',
  gitBranch: 'feature/new-component',
  lastActivity: new Date().toISOString()
});

interface DemoEventDashboardProps {
  className?: string;
}

export const DemoEventDashboard: React.FC<DemoEventDashboardProps> = ({ className }) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set());
  const [autoGenerate, setAutoGenerate] = useState(false);
  
  // Timeout manager for proper cleanup
  const timeoutManager = useRef(new TimeoutManager());
  
  const { 
    status, 
    lastUpdate, 
    updateStatus, 
    recordUpdate, 
    retry 
  } = useConnectionStatus('disconnected');

  // Auto-generate events for demo
  useEffect(() => {
    if (!autoGenerate) return;

    const interval = setInterval(() => {
      const newEvent = generateMockEvent(`event-${Date.now()}`);
      setEvents(prev => [newEvent, ...prev.slice(0, 19)]); // Keep only 20 events
      setNewEventIds(prev => new Set([...prev, newEvent.id]));
      recordUpdate();
      
      // Remove from new events after 5 seconds
      timeoutManager.current.set(`highlight-${newEvent.id}`, () => {
        setNewEventIds(prev => {
          const updated = new Set(prev);
          updated.delete(newEvent.id);
          return updated;
        });
      }, 5000);
    }, 2000 + Math.random() * 3000); // Random interval between 2-5 seconds

    return () => {
      clearInterval(interval);
      timeoutManager.current.clearAll();
    };
  }, [autoGenerate, recordUpdate]);

  const handleEventClick = useCallback((event: Event) => {
    setSelectedEvent(event);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedEvent(null);
  }, []);

  const handleAddEvent = useCallback(() => {
    const newEvent = generateMockEvent(`event-${Date.now()}`);
    setEvents(prev => [newEvent, ...prev]);
    setNewEventIds(prev => new Set([...prev, newEvent.id]));
    recordUpdate();

    timeoutManager.current.set(`manual-highlight-${newEvent.id}`, () => {
      setNewEventIds(prev => {
        const updated = new Set(prev);
        updated.delete(newEvent.id);
        return updated;
      });
    }, 5000);
  }, [recordUpdate]);

  const handleToggleConnection = useCallback(() => {
    if (status === 'connected') {
      updateStatus('disconnected');
      setAutoGenerate(false);
    } else if (status === 'disconnected') {
      updateStatus('connecting');
      timeoutManager.current.set('reconnect', () => {
        updateStatus('connected');
        setAutoGenerate(true);
      }, TIME_CONSTANTS.DEMO_EVENT_INTERVAL);
    } else if (status === 'error') {
      retry();
      timeoutManager.current.set('error-recovery', () => {
        updateStatus('connected');
        setAutoGenerate(true);
      }, TIME_CONSTANTS.DEMO_EVENT_INTERVAL);
    }
  }, [status, updateStatus, retry]);

  const handleSimulateError = useCallback(() => {
    updateStatus('error');
    setAutoGenerate(false);
  }, [updateStatus]);

  const getRelatedEvents = useCallback((event: Event | null) => {
    if (!event) return [];
    return events.filter(e => e.session_id === event.session_id);
  }, [events]);

  return (
    <div className={`w-full max-w-6xl mx-auto p-6 space-y-6 ${className}`}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-text-primary">
                Chronicle Dashboard Demo
              </h1>
              <p className="text-text-muted">
                Demonstrating real-time event animations and modal interactions
              </p>
            </div>
            <ConnectionStatus 
              status={status}
              lastUpdate={lastUpdate}
              onRetry={handleToggleConnection}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 flex-wrap">
            <Button
              onClick={handleToggleConnection}
              variant={status === 'connected' ? 'destructive' : 'default'}
              size="sm"
            >
              {status === 'connected' ? 'Disconnect' : 
               status === 'connecting' ? 'Connecting...' : 'Connect'}
            </Button>
            <Button
              onClick={handleAddEvent}
              variant="outline"
              size="sm"
            >
              Add Single Event
            </Button>
            <Button
              onClick={handleSimulateError}
              variant="outline"
              size="sm"
            >
              Simulate Error
            </Button>
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <span>Auto-generate:</span>
              <span className={autoGenerate ? 'text-accent-green' : 'text-text-muted'}>
                {autoGenerate ? 'ON' : 'OFF'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Event Feed */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-text-primary">
            Live Event Feed ({events.length})
          </h2>
        </CardHeader>
        <CardContent className="max-h-96 overflow-y-auto space-y-2">
          {events.length === 0 ? (
            <div className="text-center py-8 text-text-muted">
              <div className="text-4xl mb-2">📭</div>
              <p>No events yet. Click &quot;Add Single Event&quot; or &quot;Connect&quot; to see events.</p>
            </div>
          ) : (
            events.map((event, index) => (
              <AnimatedEventCard
                key={event.id}
                event={event}
                onClick={handleEventClick}
                isNew={newEventIds.has(event.id)}
                animateIn={index < 3} // Animate first 3 events
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* Event Detail Modal */}
      <EventDetailModal
        event={selectedEvent}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        relatedEvents={getRelatedEvents(selectedEvent)}
        sessionContext={selectedEvent ? generateSessionContext() : undefined}
      />
    </div>
  );
};