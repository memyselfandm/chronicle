'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useDashboardStore } from '@/stores/dashboardStore';
import { formatSessionDisplay } from '@/lib/sessionUtils';

export interface FilterBadgesProps {
  className?: string;
  maxVisible?: number; // Maximum number of badges to show before "and X more"
}

interface FilterBadgeProps {
  sessionId: string;
  onRemove: (sessionId: string) => void;
  className?: string;
}

// Individual filter badge component
function FilterBadge({ sessionId, onRemove, className }: FilterBadgeProps) {
  const sessions = useDashboardStore((state) => state.sessions);
  
  const session = useMemo(() => 
    sessions.find(s => s.id === sessionId), 
    [sessions, sessionId]
  );

  if (!session) {
    // Session not found, possibly removed - remove from filters
    onRemove(sessionId);
    return null;
  }

  const displayName = formatSessionDisplay(session);

  return (
    <Badge
      variant="info"
      className={cn(
        'flex items-center gap-1.5 px-3 py-1 text-sm',
        'border border-accent-blue/30 bg-accent-blue/10',
        'hover:bg-accent-blue/20 transition-colors',
        'animate-in fade-in-0 slide-in-from-left-2 duration-200',
        className
      )}
    >
      <span className="truncate max-w-[200px]" title={displayName}>
        {displayName}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(sessionId);
        }}
        className={cn(
          'ml-1 p-0.5 rounded-full transition-colors',
          'hover:bg-accent-blue/30 focus:bg-accent-blue/30',
          'focus:outline-none'
        )}
        aria-label={`Remove ${displayName} filter`}
      >
        <span className="text-xs">×</span>
      </button>
    </Badge>
  );
}

// Collapse badge for "and X more"
function CollapseBadge({ 
  count, 
  onClick,
  expanded 
}: { 
  count: number; 
  onClick: () => void;
  expanded: boolean; 
}) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        'cursor-pointer px-3 py-1 text-sm',
        'hover:bg-bg-tertiary transition-colors',
        'flex items-center gap-1'
      )}
      onClick={onClick}
    >
      {expanded ? (
        <>
          <span className="material-icons text-xs">expand_less</span>
          Show less
        </>
      ) : (
        <>
          +{count} more
          <span className="material-icons text-xs">expand_more</span>
        </>
      )}
    </Badge>
  );
}

// Main FilterBadges component
export function FilterBadges({ 
  className, 
  maxVisible = 3 
}: FilterBadgesProps) {
  const { 
    getSelectedSessionsArray, 
    toggleSessionSelection,
    clearSelectedSessions 
  } = useDashboardStore();
  
  const selectedSessions = getSelectedSessionsArray();
  const [expanded, setExpanded] = useState(false);

  // Memoize visible and hidden sessions
  const { visibleSessions, hiddenCount } = useMemo(() => {
    if (expanded || selectedSessions.length <= maxVisible) {
      return {
        visibleSessions: selectedSessions,
        hiddenCount: 0
      };
    }
    
    return {
      visibleSessions: selectedSessions.slice(0, maxVisible),
      hiddenCount: selectedSessions.length - maxVisible
    };
  }, [selectedSessions, maxVisible, expanded]);

  const handleRemoveSession = (sessionId: string) => {
    toggleSessionSelection(sessionId, true); // Remove from multi-selection
  };

  const handleClearAll = () => {
    clearSelectedSessions();
    setExpanded(false);
  };
  
  const handleExpandCollapsed = () => {
    setExpanded(!expanded);
  };

  // Don't render if no sessions selected
  if (selectedSessions.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {/* Filter label */}
      <span className="text-sm text-text-muted font-medium">
        Filtered by:
      </span>

      {/* Visible filter badges */}
      {visibleSessions.map((sessionId) => (
        <FilterBadge
          key={sessionId}
          sessionId={sessionId}
          onRemove={handleRemoveSession}
        />
      ))}

      {/* Collapsed indicator or Show less button */}
      {(hiddenCount > 0 || expanded) && (
        <CollapseBadge 
          count={hiddenCount} 
          onClick={handleExpandCollapsed}
          expanded={expanded}
        />
      )}

      {/* Clear all button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClearAll}
        className={cn(
          'h-7 px-2 text-xs text-text-muted',
          'hover:text-text-secondary hover:bg-bg-tertiary',
          'focus:outline-none focus:ring-2 focus:ring-accent-blue focus:ring-offset-1'
        )}
        aria-label="Clear all session filters"
      >
        Clear all
      </Button>
    </div>
  );
}

// Alternative compact version for tight spaces
export function CompactFilterBadges({ className }: { className?: string }) {
  const selectedSessions = useDashboardStore((state) => state.getSelectedSessionsArray());
  const clearSelectedSessions = useDashboardStore((state) => state.clearSelectedSessions);

  if (selectedSessions.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Badge variant="info" className="text-xs">
        {selectedSessions.length} session{selectedSessions.length > 1 ? 's' : ''} filtered
      </Badge>
      <button
        type="button"
        onClick={clearSelectedSessions}
        className={cn(
          'text-xs text-text-muted hover:text-text-secondary',
          'underline focus:outline-none'
        )}
      >
        Clear
      </button>
    </div>
  );
}

// Filter summary for analytics
export function FilterSummary() {
  const selectedSessions = useDashboardStore((state) => state.getSelectedSessionsArray());
  const getFilteredEventsBySelectedSessions = useDashboardStore(
    (state) => state.getFilteredEventsBySelectedSessions
  );
  
  const filteredEvents = getFilteredEventsBySelectedSessions();

  if (selectedSessions.length === 0) {
    return null;
  }

  return (
    <div className="text-xs text-text-muted">
      Showing {filteredEvents.length} events from {selectedSessions.length} selected session{selectedSessions.length > 1 ? 's' : ''}
    </div>
  );
}