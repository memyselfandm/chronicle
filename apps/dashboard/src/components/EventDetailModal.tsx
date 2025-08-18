"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { format } from "date-fns";
import { Modal, ModalContent, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { cn, TimeoutManager, logger } from "@/lib/utils";
import { UI_DELAYS } from "@/lib/constants";
import type { Event } from "@/types/events";
import { formatDuration } from "@/lib/utils";

interface EventDetailModalProps {
  event: Event | null;
  isOpen: boolean;
  onClose: () => void;
  relatedEvents?: Event[];
  sessionContext?: {
    projectPath?: string;
    gitBranch?: string;
    lastActivity?: string;
  };
}

interface JSONViewerProps {
  data: any;
  level?: number;
}

const JSONViewer: React.FC<JSONViewerProps> = ({ data, level = 0 }) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleCollapse = (key: string) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const renderValue = (value: any, key?: string): React.ReactNode => {
    if (value === null) {
      return <span className="text-text-muted italic">null</span>;
    }
    
    if (value === undefined) {
      return <span className="text-text-muted italic">undefined</span>;
    }

    if (typeof value === "boolean") {
      return <span className="text-accent-blue">{String(value)}</span>;
    }

    if (typeof value === "number") {
      return <span className="text-accent-green">{String(value)}</span>;
    }

    if (typeof value === "string") {
      // Handle special string types
      if (value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
        // Looks like a timestamp
        return (
          <span className="text-accent-yellow">
            "{value}"
            <span className="text-xs text-text-muted ml-2">
              ({format(new Date(value), "MMM d, HH:mm:ss")})
            </span>
          </span>
        );
      }
      return <span className="text-accent-yellow">"{value}"</span>;
    }

    if (Array.isArray(value)) {
      const isCollapsed = key ? collapsed[key] : false;
      return (
        <div className="inline-block">
          <button
            onClick={() => key && toggleCollapse(key)}
            className="text-text-primary hover:text-accent-blue transition-colors"
            type="button"
          >
            [{isCollapsed ? '...' : ''}
          </button>
          {!isCollapsed && (
            <div className="ml-4 mt-1">
              {value.map((item, index) => (
                <div key={index} className="mb-1">
                  <span className="text-text-muted">{index}: </span>
                  {renderValue(item, `${key}.${index}`)}
                  {index < value.length - 1 && <span className="text-text-muted">,</span>}
                </div>
              ))}
            </div>
          )}
          <span className="text-text-primary">]</span>
        </div>
      );
    }

    if (typeof value === "object") {
      const keys = Object.keys(value);
      const isCollapsed = key ? collapsed[key] : false;
      
      return (
        <div className="inline-block">
          <button
            onClick={() => key && toggleCollapse(key)}
            className="text-text-primary hover:text-accent-blue transition-colors"
            type="button"
          >
            {isCollapsed ? `{ ${keys.length} keys }` : '{'}
          </button>
          {!isCollapsed && (
            <div className={cn("mt-1", level < 3 ? "ml-4" : "ml-2")}>
              {keys.map((objKey, index) => (
                <div key={objKey} className="mb-1">
                  <span className="text-accent-purple">"{objKey}"</span>
                  <span className="text-text-muted">: </span>
                  {renderValue(value[objKey], `${key}.${objKey}`)}
                  {index < keys.length - 1 && <span className="text-text-muted">,</span>}
                </div>
              ))}
            </div>
          )}
          {!isCollapsed && <span className="text-text-primary">{"}"}</span>}
        </div>
      );
    }

    return <span className="text-text-primary">{String(value)}</span>;
  };

  return (
    <div className="font-mono text-sm bg-bg-tertiary p-4 rounded-lg overflow-auto max-h-96">
      {renderValue(data, "root")}
    </div>
  );
};

const EventDetailModal: React.FC<EventDetailModalProps> = ({
  event,
  isOpen,
  onClose,
  relatedEvents = [],
  sessionContext,
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  // Timeout manager for proper cleanup
  const timeoutManager = useRef(new TimeoutManager());
  
  // Cleanup timeouts when component unmounts or modal closes
  useEffect(() => {
    if (!isOpen) {
      timeoutManager.current.clearAll();
    }
    
    return () => {
      timeoutManager.current.clearAll();
    };
  }, [isOpen]);

  const copyToClipboard = useCallback(async (data: any, field: string) => {
    try {
      const textToCopy = typeof data === "string" ? data : JSON.stringify(data, null, 2);
      await navigator.clipboard.writeText(textToCopy);
      setCopiedField(field);
      timeoutManager.current.set('copy-notification', () => setCopiedField(null), UI_DELAYS.NOTIFICATION_DISMISS_DELAY);
    } catch (error) {
      logger.error("Failed to copy to clipboard", { 
        component: 'EventDetailModal',
        action: 'copyToClipboard',
        field 
      }, error as Error);
    }
  }, []);

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'session_start':
        return 'purple';
      case 'pre_tool_use':
      case 'post_tool_use':
        return 'success';
      case 'user_prompt_submit':
        return 'info';
      case 'stop':
      case 'subagent_stop':
        return 'warning';
      case 'pre_compact':
        return 'secondary';
      case 'error':
        return 'destructive';
      case 'notification':
        return 'default';
      default:
        return 'default';
    }
  };

  const getSuccessColor = (success: boolean | undefined) => {
    if (success === true) {
      return 'success';
    } else if (success === false) {
      return 'destructive';
    } else {
      return 'default';
    }
  };

  if (!event) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Event Details"
      size="xl"
      className="max-h-[90vh] overflow-hidden"
    >
      <ModalContent className="space-y-6 max-h-[calc(90vh-200px)] overflow-y-auto">
        {/* Event Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant={getEventTypeColor(event.event_type)} className="font-medium">
                {event.event_type.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())}
              </Badge>
              {/* Status badge removed as it's not in the new schema */}
            </div>
            <div className="text-sm text-text-muted">
              Event ID: <span className="font-mono text-xs">{event.id}</span>
            </div>
            <div className="text-sm text-text-muted">
              Session: <span className="font-mono text-xs">{event.session_id}</span>
            </div>
          </div>
          <div className="text-right text-sm text-text-muted">
            <div>{format(new Date(event.timestamp), "MMM d, yyyy")}</div>
            <div className="font-mono">{format(new Date(event.timestamp), "HH:mm:ss.SSS")}</div>
            {/* Tool name for tool events */}
            {(event.event_type === 'pre_tool_use' || event.event_type === 'post_tool_use') && event.tool_name && (
              <div className="text-sm text-text-muted">
                Tool: <span className="font-mono text-xs text-text-primary">{event.tool_name}</span>
              </div>
            )}
            {/* Duration for post tool use events */}
            {event.event_type === 'post_tool_use' && event.duration_ms && (
              <div className="text-sm text-text-muted">
                Duration: <span className="font-mono text-xs text-text-primary">{formatDuration(event.duration_ms)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Session Context */}
        {sessionContext && (
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold text-text-primary">Session Context</h3>
            </CardHeader>
            <CardContent className="space-y-2">
              {sessionContext.projectPath && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-muted">Project Path:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-text-secondary">
                      {sessionContext.projectPath}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(sessionContext.projectPath, "projectPath")}
                      className="h-6 w-6 p-0"
                    >
                      {copiedField === "projectPath" ? (
                        <svg className="h-3 w-3 text-accent-green" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </Button>
                  </div>
                </div>
              )}
              {sessionContext.gitBranch && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-muted">Git Branch:</span>
                  <span className="font-mono text-xs text-text-secondary">
                    {sessionContext.gitBranch}
                  </span>
                </div>
              )}
              {sessionContext.lastActivity && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-muted">Last Activity:</span>
                  <span className="text-xs text-text-secondary">
                    {format(new Date(sessionContext.lastActivity), "MMM d, HH:mm:ss")}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Event Data */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">Event Data</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(event.metadata, "eventData")}
                className="text-xs"
              >
                {copiedField === "eventData" ? "Copied!" : "Copy JSON"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <JSONViewer data={event.metadata} />
          </CardContent>
        </Card>

        {/* Full Event JSON */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">Full Event</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(event, "fullEvent")}
                className="text-xs"
              >
                {copiedField === "fullEvent" ? "Copied!" : "Copy All"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <JSONViewer data={event} />
          </CardContent>
        </Card>

        {/* Related Events Timeline */}
        {relatedEvents.length > 0 && (
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold text-text-primary">
                Related Events ({relatedEvents.length})
              </h3>
              <p className="text-sm text-text-muted">
                Other events from the same session
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {relatedEvents
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                  .map((relatedEvent) => (
                    <div
                      key={relatedEvent.id}
                      className={cn(
                        "flex items-center justify-between p-2 rounded-md border",
                        relatedEvent.id === event.id
                          ? "border-accent-blue bg-accent-blue/10"
                          : "border-border bg-bg-tertiary"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={getEventTypeColor(relatedEvent.event_type)}
                          className="text-xs"
                        >
                          {relatedEvent.event_type.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())}
                        </Badge>
                        <span className="text-sm text-text-secondary">
                          {(relatedEvent.event_type === "pre_tool_use" || relatedEvent.event_type === "post_tool_use") && relatedEvent.tool_name
                            ? relatedEvent.tool_name
                            : relatedEvent.event_type.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())}
                        </span>
                        {relatedEvent.event_type === "post_tool_use" && relatedEvent.duration_ms && (
                          <span className="text-xs text-text-muted">({formatDuration(relatedEvent.duration_ms)})</span>
                        )}
                      </div>
                      <div className="text-xs text-text-muted font-mono">
                        {format(new Date(relatedEvent.timestamp), "HH:mm:ss")}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </ModalContent>

      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export { EventDetailModal };
export type { EventDetailModalProps };