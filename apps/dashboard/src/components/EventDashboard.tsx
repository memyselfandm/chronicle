"use client";

import { useState, useEffect, useCallback } from 'react';
import { AnimatedEventCard } from './AnimatedEventCard';
import { EventDetailModal } from './EventDetailModal';
import { ConnectionStatus, useConnectionStatus } from './ConnectionStatus';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader } from './ui/Card';
import type { Event } from '@/types/events';

// Mock data generator for demo
const generateMockEvent = (id: string): Event => {
  const types = ['tool_use', 'prompt', 'session', 'error', 'file_op'] as const;
  const statuses = ['success', 'error', 'pending', 'warning'] as const;
  const tools = ['Read', 'Write', 'Edit', 'Bash', 'Search', 'WebFetch'];
  
  const type = types[Math.floor(Math.random() * types.length)];
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  
  return {
    id,
    type,
    timestamp: new Date().toISOString(),
    session_id: `session-${Math.random().toString(36).substring(2, 15)}`,
    status,
    data: {
      tool_name: type === 'tool_use' ? tools[Math.floor(Math.random() * tools.length)] : undefined,
      parameters: type === 'tool_use' ? { 
        file_path: '/path/to/file.ts',
        content: 'Sample file content'
      } : undefined,
      result: status === 'success' ? 'Operation completed successfully' : undefined,
      error_message: status === 'error' ? 'Something went wrong' : undefined,
      duration_ms: Math.floor(Math.random() * 1000) + 50,
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
    }
  };
};

const generateSessionContext = (sessionId: string) => ({
  projectPath: '/Users/developer/my-project',
  gitBranch: 'feature/new-component',
  lastActivity: new Date().toISOString()
});

interface EventDashboardProps {
  className?: string;
}

export const EventDashboard: React.FC<EventDashboardProps> = ({ className }) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set());
  const [autoGenerate, setAutoGenerate] = useState(false);
  
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
      setTimeout(() => {
        setNewEventIds(prev => {
          const updated = new Set(prev);
          updated.delete(newEvent.id);
          return updated;
        });
      }, 5000);
    }, 2000 + Math.random() * 3000); // Random interval between 2-5 seconds

    return () => clearInterval(interval);
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

    setTimeout(() => {
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
      setTimeout(() => {
        updateStatus('connected');
        setAutoGenerate(true);
      }, 1500);
    } else if (status === 'error') {
      retry();
      setTimeout(() => {
        updateStatus('connected');
        setAutoGenerate(true);
      }, 1500);
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
              <p>No events yet. Click "Add Single Event" or "Connect" to see events.</p>
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
        sessionContext={selectedEvent ? generateSessionContext(selectedEvent.session_id) : undefined}
      />
    </div>
  );
};