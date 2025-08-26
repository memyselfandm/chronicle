/**
 * EventDetails - Expandable event metadata display
 * 
 * Features:
 * - Expandable/collapsible event metadata
 * - JSON syntax highlighting
 * - Copy to clipboard functionality
 * - Performance optimized lazy loading
 * - Keyboard accessible
 */

'use client';

import React, { memo, useState, useCallback } from 'react';
import { Event } from '@/types/events';
import { cn } from '@/lib/utils';

export interface EventDetailsProps {
  /** Event to display details for */
  event: Event;
  /** Whether details are initially expanded */
  defaultExpanded?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Copy text to clipboard with fallback
 */
const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const result = document.execCommand('copy');
      textArea.remove();
      return result;
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
};

/**
 * JSON syntax highlighter component
 */
const JsonHighlighter = memo<{ data: any }>(({ data }) => {
  const jsonString = JSON.stringify(data, null, 2);
  
  // Simple syntax highlighting with spans
  const highlightedJson = jsonString
    .replace(/"([^"]+)":/g, '<span class="text-accent-blue">"$1":</span>')
    .replace(/:\s*"([^"]*)"/g, ': <span class="text-accent-green">"$1"</span>')
    .replace(/:\s*(\d+)/g, ': <span class="text-accent-yellow">$1</span>')
    .replace(/:\s*(true|false|null)/g, ': <span class="text-accent-purple">$1</span>');

  return (
    <pre
      className="text-xs font-mono text-text-secondary whitespace-pre-wrap break-words overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: highlightedJson }}
    />
  );
});

JsonHighlighter.displayName = 'JsonHighlighter';

/**
 * Copy button component
 */
const CopyButton = memo<{ text: string }>(({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'inline-flex items-center gap-1 px-2 py-1 rounded text-xs',
        'transition-colors focus:outline-none focus:ring-2 focus:ring-accent-blue',
        copied
          ? 'bg-accent-green/10 text-accent-green border border-accent-green/30'
          : 'bg-bg-secondary text-text-muted border border-border-primary hover:bg-bg-tertiary hover:text-text-secondary'
      )}
      aria-label="Copy to clipboard"
    >
      <span className="material-icons text-sm">
        {copied ? 'check' : 'copy'}
      </span>
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
});

CopyButton.displayName = 'CopyButton';

/**
 * Event metadata field display
 */
const MetadataField = memo<{ label: string; value: any; path: string }>(({ label, value, path }) => {
  if (value === null || value === undefined) {
    return null;
  }

  const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
  const isLong = displayValue.length > 100;

  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 items-start py-1 border-b border-border-primary/30 last:border-b-0">
      <div className="text-xs font-medium text-text-muted truncate" title={label}>
        {label}:
      </div>
      <div className="min-w-0">
        {typeof value === 'object' ? (
          <JsonHighlighter data={value} />
        ) : (
          <div
            className={cn(
              'text-xs text-text-secondary',
              isLong ? 'whitespace-pre-wrap break-words' : 'truncate'
            )}
            title={displayValue}
          >
            {displayValue}
          </div>
        )}
      </div>
    </div>
  );
});

MetadataField.displayName = 'MetadataField';

/**
 * Expandable event details component
 */
export const EventDetails = memo<EventDetailsProps>(({
  event,
  defaultExpanded = false,
  className
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const toggleExpanded = useCallback(() => {
    setExpanded(prev => !prev);
  }, []);

  // Prepare metadata for display
  const metadata = event.metadata || {};
  const hasMetadata = Object.keys(metadata).length > 0;
  
  // Create full event data for copying
  const fullEventData = {
    id: event.id,
    session_id: event.session_id,
    event_type: event.event_type,
    timestamp: event.timestamp,
    tool_name: event.tool_name,
    duration_ms: event.duration_ms,
    metadata,
    created_at: event.created_at
  };

  const fullEventJson = JSON.stringify(fullEventData, null, 2);

  return (
    <div 
      className={cn('border border-border-primary rounded-lg bg-bg-primary', className)}
      data-testid="event-details"
    >
      {/* Header with expand/collapse button */}
      <button
        type="button"
        onClick={toggleExpanded}
        className={cn(
          'w-full flex items-center justify-between p-3',
          'text-left hover:bg-bg-secondary transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-accent-blue focus:ring-inset'
        )}
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Collapse' : 'Expand'} event details`}
      >
        <div className="flex items-center gap-2">
          <span className="material-icons text-sm text-text-muted">
            {expanded ? 'expand_less' : 'expand_more'}
          </span>
          <span className="text-sm font-medium text-text-primary">
            Event Details
          </span>
          <span className="text-xs text-text-muted">
            ({event.event_type})
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted font-mono">
            {event.id.slice(0, 8)}...
          </span>
          <CopyButton text={fullEventJson} />
        </div>
      </button>

      {/* Expandable content */}
      {expanded && (
        <div className="border-t border-border-primary p-3 space-y-3">
          {/* Basic event information */}
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
              Event Information
            </h4>
            <div className="bg-bg-secondary rounded p-2 space-y-1">
              <MetadataField label="ID" value={event.id} path="id" />
              <MetadataField label="Session ID" value={event.session_id} path="session_id" />
              <MetadataField label="Type" value={event.event_type} path="event_type" />
              <MetadataField label="Timestamp" value={event.timestamp} path="timestamp" />
              {event.tool_name && (
                <MetadataField label="Tool" value={event.tool_name} path="tool_name" />
              )}
              {event.duration_ms && (
                <MetadataField 
                  label="Duration" 
                  value={`${event.duration_ms}ms`} 
                  path="duration_ms" 
                />
              )}
              <MetadataField label="Created At" value={event.created_at} path="created_at" />
            </div>
          </div>

          {/* Metadata */}
          {hasMetadata && (
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                Metadata
              </h4>
              <div className="bg-bg-secondary rounded p-2">
                {Object.entries(metadata).map(([key, value]) => (
                  <MetadataField
                    key={key}
                    label={key}
                    value={value}
                    path={`metadata.${key}`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Raw JSON view */}
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
              Raw JSON
            </h4>
            <div className="bg-bg-secondary rounded p-2 max-h-48 overflow-y-auto">
              <JsonHighlighter data={fullEventData} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

EventDetails.displayName = 'memo(EventDetails)';