import { forwardRef, useState } from 'react';
import { format } from 'date-fns';
import { CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

interface Event {
  id: string;
  timestamp: string;
  type: 'prompt' | 'tool_use' | 'session';
  sessionId: string;
  data: {
    tool_name?: string;
    status?: 'success' | 'error' | 'pending';
    [key: string]: unknown;
  } | null;
}

interface EventCardProps {
  event: Event;
  onClick?: (event: Event) => void;
  className?: string;
}

const EventCard = forwardRef<HTMLButtonElement, EventCardProps>(
  ({ event, onClick, className }, ref) => {
    const [showTooltip, setShowTooltip] = useState(false);

    const handleClick = () => {
      onClick?.(event);
    };

    const getEventTypeColor = (type: string) => {
      switch (type) {
        case 'prompt':
          return 'info'; // blue
        case 'tool_use':
          return 'success'; // green
        case 'session':
          return 'purple'; // purple
        default:
          return 'default';
      }
    };

    // Custom time formatting to match test expectations
    const formatTimestamp = (timestamp: string) => {
      try {
        const date = new Date(timestamp);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
        
        if (diffInSeconds < 60) {
          return `${diffInSeconds}s ago`;
        }
        
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        if (diffInMinutes < 60) {
          return `${diffInMinutes}m ago`;
        }
        
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) {
          return `${diffInHours}h ago`;
        }
        
        const diffInDays = Math.floor(diffInHours / 24);
        return `${diffInDays}d ago`;
      } catch {
        return 'Unknown time';
      }
    };

    const formatAbsoluteTimestamp = (timestamp: string) => {
      try {
        const date = new Date(timestamp);
        return format(date, 'MMM d, yyyy \'at\' HH:mm:ss');
      } catch {
        return timestamp;
      }
    };

    // Custom truncation that matches test expectations
    const truncateSessionId = (sessionId: string, maxLength: number = 16) => {
      if (sessionId.length <= maxLength) return sessionId;
      return `${sessionId.slice(0, maxLength)}...`;
    };

    const truncatedSessionId = truncateSessionId(event.sessionId, 16);
    const relativeTime = formatTimestamp(event.timestamp);
    const absoluteTime = formatAbsoluteTimestamp(event.timestamp);

    return (
      <button
        ref={ref}
        onClick={handleClick}
        className={cn(
          'w-full text-left',
          'rounded-lg border border-border bg-bg-secondary text-text-primary shadow-sm',
          'cursor-pointer transition-all duration-200 hover:shadow-md hover:border-accent-blue/20 hover:scale-[1.02]',
          className
        )}
        type="button"
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge 
                variant={getEventTypeColor(event.type)}
                className="text-xs font-medium"
              >
                {event.type}
              </Badge>
            </div>
            <div className="text-xs text-text-muted">
              <span 
                className="relative"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
              >
                {relativeTime}
                {showTooltip && (
                  <div className="absolute bottom-full right-0 mb-2 z-10 px-2 py-1 text-xs text-white bg-gray-900 rounded shadow-lg whitespace-nowrap">
                    {absoluteTime}
                  </div>
                )}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            <div className="text-sm text-text-secondary">
              <span className="text-text-muted">Session:</span>{' '}
              <span className="font-mono text-xs">{truncatedSessionId}</span>
            </div>
            {event.data?.tool_name && (
              <div className="text-sm text-text-primary">
                <span className="font-medium">{event.data.tool_name}</span>
              </div>
            )}
          </div>
        </CardContent>
      </button>
    );
  }
);

EventCard.displayName = 'EventCard';

export { EventCard, type Event };