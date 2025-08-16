"use client";

import { forwardRef, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

interface Event {
  id: string;
  timestamp: string;
  type: 'prompt' | 'tool_use' | 'session' | 'lifecycle' | 'error' | 'file_op' | 'system' | 'notification';
  session_id: string;
  data: {
    tool_name?: string;
    status?: 'success' | 'error' | 'pending' | 'warning';
    [key: string]: unknown;
  } | null;
}

interface AnimatedEventCardProps {
  event: Event;
  onClick?: (event: Event) => void;
  className?: string;
  isNew?: boolean;
  animateIn?: boolean;
}

const AnimatedEventCard = forwardRef<HTMLButtonElement, AnimatedEventCardProps>(
  ({ event, onClick, className, isNew = false, animateIn = false }, ref) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const [showNewHighlight, setShowNewHighlight] = useState(isNew);
    const [hasAnimatedIn, setHasAnimatedIn] = useState(!animateIn);

    // Handle initial animation
    useEffect(() => {
      if (animateIn && !hasAnimatedIn) {
        const timer = setTimeout(() => {
          setHasAnimatedIn(true);
        }, 50); // Small delay to ensure the element is mounted
        return () => clearTimeout(timer);
      }
    }, [animateIn, hasAnimatedIn]);

    // Handle new event highlight pulse
    useEffect(() => {
      if (isNew) {
        setShowNewHighlight(true);
        const timer = setTimeout(() => {
          setShowNewHighlight(false);
        }, 3000); // Highlight for 3 seconds
        return () => clearTimeout(timer);
      }
    }, [isNew]);

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
        case 'lifecycle':
          return 'purple'; // purple
        case 'error':
          return 'destructive'; // red
        case 'file_op':
          return 'warning'; // yellow
        case 'system':
        case 'notification':
          return 'default'; // gray
        default:
          return 'default';
      }
    };

    const getEventIcon = (type: string) => {
      switch (type) {
        case 'prompt': return '💬';
        case 'tool_use': return '🔧';
        case 'session': return '🎯';
        case 'lifecycle': return '🔄';
        case 'error': return '❌';
        case 'file_op': return '📁';
        case 'system': return '⚙️';
        case 'notification': return '🔔';
        default: return '📄';
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

    const truncatedSessionId = truncateSessionId(event.session_id, 16);
    const relativeTime = formatTimestamp(event.timestamp);
    const absoluteTime = formatAbsoluteTimestamp(event.timestamp);

    return (
      <button
        ref={ref}
        onClick={handleClick}
        className={cn(
          'w-full text-left mb-3',
          'rounded-lg border border-border bg-bg-secondary text-text-primary shadow-sm',
          'cursor-pointer transition-all duration-300 ease-out',
          'hover:shadow-md hover:border-accent-blue/20 hover:scale-[1.02]',
          'focus:outline-none focus:ring-2 focus:ring-accent-blue focus:ring-offset-2 focus:ring-offset-bg-primary',
          // Animation classes
          !hasAnimatedIn && animateIn && 'opacity-0 transform translate-y-4 scale-95',
          hasAnimatedIn && 'opacity-100 transform translate-y-0 scale-100',
          // New event highlight pulse
          showNewHighlight && 'animate-pulse shadow-lg shadow-accent-blue/30 border-accent-blue/50',
          className
        )}
        type="button"
        data-testid={`animated-event-card-${event.id}`}
        style={{
          transition: animateIn 
            ? 'opacity 0.5s ease-out, transform 0.5s ease-out, box-shadow 0.3s ease-out, border-color 0.3s ease-out'
            : 'all 0.3s ease-out'
        }}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg flex-shrink-0" role="img" aria-label={`${event.type} event`}>
                {getEventIcon(event.type)}
              </span>
              <Badge 
                variant={getEventTypeColor(event.type)}
                className="text-xs font-medium"
              >
                {event.type.replace('_', ' ')}
              </Badge>
              {showNewHighlight && (
                <span 
                  className="text-xs font-medium text-accent-blue animate-pulse"
                  data-testid="new-indicator"
                >
                  NEW
                </span>
              )}
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

AnimatedEventCard.displayName = 'AnimatedEventCard';

export { AnimatedEventCard, type Event };