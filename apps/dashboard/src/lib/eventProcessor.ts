import { Event } from '@/types/events';
import { EventType, isValidEventType } from '@/types/filters';
import { logger } from './utils';

/**
 * Sensitive data keys that should be redacted
 */
const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'api_key',
  'secret',
  'auth',
  'authorization',
  'bearer',
  'key',
  'credential',
  'private_key',
  'client_secret',
]);

/**
 * Processing metrics for monitoring
 */
interface ProcessingMetrics {
  totalProcessed: number;
  successCount: number;
  errorCount: number;
  lastProcessed: Date | null;
}

/**
 * Batch processing configuration
 */
interface BatchConfig {
  delay: number;
  maxSize: number;
}

/**
 * Batch processor interface
 */
interface BatchProcessor {
  addEvent: (event: Event) => void;
  flush: () => void;
}

/**
 * Transforms and validates event data before display
 * @param event - Raw event from database
 * @returns Processed event or null if invalid
 */
export const processEvent = (event: Event): Event | null => {
  if (!validateEventData(event)) {
    return null;
  }

  // Transform and sanitize the event
  const processedEvent: Event = {
    ...event,
    data: sanitizeEventData(event.data),
    timestamp: new Date(event.timestamp),
    created_at: new Date(event.created_at),
  };

  return processedEvent;
};

/**
 * Sanitizes event data by redacting sensitive information
 * @param data - Raw event data
 * @returns Sanitized event data
 */
export const sanitizeEventData = (data: Record<string, any>): Record<string, any> => {
  const sanitized = JSON.parse(JSON.stringify(data)); // Deep clone

  const sanitizeObject = (obj: any): any => {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }

    const result: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      
      if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('password') || lowerKey.includes('secret')) {
        result[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        result[key] = sanitizeObject(value);
      } else {
        result[key] = value;
      }
    }

    return result;
  };

  return sanitizeObject(sanitized);
};

/**
 * Validates event data structure and types
 * @param event - Event to validate
 * @returns True if event is valid
 */
export const validateEventData = (event: any): event is Event => {
  if (!event || typeof event !== 'object') {
    return false;
  }

  // Check required fields
  if (!event.id || typeof event.id !== 'string') {
    return false;
  }

  if (!event.session_id || typeof event.session_id !== 'string') {
    return false;
  }

  if (!isValidEventType(event.event_type)) {
    return false;
  }

  // Validate timestamps
  if (!event.timestamp || isNaN(new Date(event.timestamp).getTime())) {
    return false;
  }

  if (!event.created_at || isNaN(new Date(event.created_at).getTime())) {
    return false;
  }

  // Validate data field
  if (!event.data || typeof event.data !== 'object') {
    return false;
  }

  return true;
};

/**
 * Groups events by session ID for easier processing
 * @param events - Array of events
 * @returns Map of session ID to events
 */
export const groupEventsBySession = (events: Event[]): Map<string, Event[]> => {
  const grouped = new Map<string, Event[]>();

  for (const event of events) {
    const sessionId = event.session_id;
    if (!grouped.has(sessionId)) {
      grouped.set(sessionId, []);
    }
    grouped.get(sessionId)!.push(event);
  }

  return grouped;
};

/**
 * Removes duplicate events based on ID
 * @param events - Array of events
 * @returns Deduplicated events
 */
export const deduplicateEvents = (events: Event[]): Event[] => {
  const seen = new Set<string>();
  const deduplicated: Event[] = [];

  for (const event of events) {
    if (!seen.has(event.id)) {
      seen.add(event.id);
      deduplicated.push(event);
    }
  }

  return deduplicated;
};

/**
 * Creates a batch processor for handling multiple events efficiently
 * @param processor - Function to process batched events
 * @param config - Batch configuration
 * @returns Batch processor interface
 */
export const batchEvents = (
  processor: (events: Event[]) => void,
  config: BatchConfig = { delay: 100, maxSize: 50 }
): BatchProcessor => {
  let batch: Event[] = [];
  let timeout: NodeJS.Timeout | null = null;

  const processBatch = () => {
    if (batch.length > 0) {
      processor([...batch]);
      batch = [];
    }
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  const addEvent = (event: Event) => {
    batch.push(event);

    // Process immediately if batch size reached
    if (batch.length >= config.maxSize) {
      processBatch();
      return;
    }

    // Schedule batch processing
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(processBatch, config.delay);
  };

  const flush = () => {
    processBatch();
  };

  return { addEvent, flush };
};

/**
 * Main event processor class for handling all event transformations
 */
export class EventProcessor {
  private metrics: ProcessingMetrics = {
    totalProcessed: 0,
    successCount: 0,
    errorCount: 0,
    lastProcessed: null,
  };

  /**
   * Processes a single event
   * @param event - Raw event data
   * @returns Processed event or null if invalid
   */
  process(event: Event): Event | null {
    this.metrics.totalProcessed++;
    this.metrics.lastProcessed = new Date();

    try {
      const processed = processEvent(event);
      
      if (processed) {
        this.metrics.successCount++;
      } else {
        this.metrics.errorCount++;
      }

      return processed;
    } catch (error) {
      this.metrics.errorCount++;
      logger.error('Event processing error', {
        component: 'eventProcessor',
        action: 'processBatch',
        data: { batchSize: queue.length }
      }, error as Error);
      return null;
    }
  }

  /**
   * Processes multiple events in batch
   * @param events - Array of raw events
   * @returns Array of processed events (null for invalid events)
   */
  processBatch(events: Event[]): (Event | null)[] {
    return events.map(event => this.process(event));
  }

  /**
   * Gets processing metrics
   * @returns Current metrics
   */
  getMetrics(): ProcessingMetrics {
    return { ...this.metrics };
  }

  /**
   * Resets processing metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalProcessed: 0,
      successCount: 0,
      errorCount: 0,
      lastProcessed: null,
    };
  }
}