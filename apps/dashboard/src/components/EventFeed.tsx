import { forwardRef } from 'react';
import { EventCard, type Event } from './EventCard';
import { cn } from '@/lib/utils';

interface EventFeedProps {
  events: Event[];
  onEventClick?: (event: Event) => void;
  className?: string;
}

const EventFeed = forwardRef<HTMLDivElement, EventFeedProps>(
  ({ events, onEventClick, className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'space-y-3 overflow-y-auto max-h-[600px] p-4',
          'bg-bg-primary',
          className
        )}
      >
        {events.length === 0 ? (
          <div className="text-center text-text-muted py-8">
            No events to display
          </div>
        ) : (
          events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onClick={onEventClick}
              className="hover:scale-[1.01] transition-transform"
            />
          ))
        )}
      </div>
    );
  }
);

EventFeed.displayName = 'EventFeed';

export { EventFeed };