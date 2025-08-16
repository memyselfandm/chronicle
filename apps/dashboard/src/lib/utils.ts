import { type ClassValue, clsx } from "clsx";

/**
 * Utility function to merge Tailwind CSS classes with proper precedence
 * This function combines clsx for conditional classes with proper class merging
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/**
 * Date formatting utilities using date-fns
 */
export const formatters = {
  /**
   * Format a date to relative time (e.g., "2 hours ago")
   */
  timeAgo: (date: Date): string => {
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
    if (diffInDays < 7) {
      return `${diffInDays}d ago`;
    }
    
    const diffInWeeks = Math.floor(diffInDays / 7);
    return `${diffInWeeks}w ago`;
  },

  /**
   * Format timestamp for display (e.g., "14:32:45")
   */
  timestamp: (date: Date): string => {
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  },

  /**
   * Format date for display (e.g., "Dec 15, 2023")
   */
  date: (date: Date): string => {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  },

  /**
   * Format full datetime (e.g., "Dec 15, 2023 at 14:32:45")
   */
  datetime: (date: Date): string => {
    return `${formatters.date(date)} at ${formatters.timestamp(date)}`;
  },
};

/**
 * Utility to safely parse JSON strings
 */
export function safeJsonParse<T = unknown>(jsonString: string): T | null {
  try {
    return JSON.parse(jsonString);
  } catch {
    return null;
  }
}

/**
 * Utility to truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

/**
 * Utility to generate consistent colors for session IDs
 */
export function getSessionColor(sessionId: string): string {
  const colors = [
    "bg-accent-blue",
    "bg-accent-green", 
    "bg-accent-purple",
    "bg-accent-yellow",
    "bg-accent-red",
  ];
  
  // Simple hash function to consistently map session ID to color
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) {
    const char = sessionId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  const colorIndex = Math.abs(hash) % colors.length;
  return colors[colorIndex] ?? colors[0] ?? "bg-accent-blue";
}

/**
 * Utility to generate readable event type labels
 */
export function getEventTypeLabel(eventType: string): string {
  const labels: Record<string, string> = {
    "pre_tool_use": "Pre Tool Use",
    "post_tool_use": "Post Tool Use",
    "user_prompt_submit": "User Prompt",
    "notification": "Notification",
    "session_start": "Session Start",
    "stop": "Session Stop",
    "subagent_stop": "Subagent Stop",
    "pre_compact": "Pre Compact",
  };
  
  return labels[eventType] || eventType.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Utility to get tool category for grouping
 */
export function getToolCategory(toolName: string): string {
  const categories: Record<string, string[]> = {
    "File Operations": ["Read", "Write", "Edit", "MultiEdit"],
    "Search & Discovery": ["Glob", "Grep", "WebSearch"],
    "System": ["Bash", "Task"],
    "Web": ["WebFetch"],
    "MCP Tools": [], // Will be populated based on mcp__ prefix
  };
  
  // Check for MCP tools
  if (toolName.startsWith("mcp__")) {
    return "MCP Tools";
  }
  
  // Find category for built-in tools
  for (const [category, tools] of Object.entries(categories)) {
    if (tools.includes(toolName)) {
      return category;
    }
  }
  
  return "Other";
}

/**
 * Format duration in milliseconds to human-readable format
 */
export function formatDuration(durationMs: number | undefined | null): string {
  if (durationMs == null || durationMs < 0) {
    return "";
  }

  if (durationMs < 1000) {
    return `${Math.round(durationMs)}ms`;
  }

  const seconds = durationMs / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  
  if (minutes < 60) {
    return remainingSeconds === 0 
      ? `${minutes}m` 
      : `${minutes}m ${remainingSeconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  return remainingMinutes === 0 
    ? `${hours}h` 
    : `${hours}h ${remainingMinutes}m`;
}

/**
 * Generate better descriptions for event types
 */
export function getEventDescription(event: { event_type: string; tool_name?: string; metadata?: any }): string {
  const { event_type, tool_name, metadata } = event;
  
  switch (event_type) {
    case 'session_start':
      return 'Session started';
    case 'pre_tool_use':
      return tool_name ? `Starting to use ${tool_name}` : 'Starting tool use';
    case 'post_tool_use':
      return tool_name ? `Finished using ${tool_name}` : 'Finished tool use';
    case 'user_prompt_submit':
      return 'User submitted a prompt';
    case 'stop':
      return 'Session stopped';
    case 'subagent_stop':
      return 'Subagent stopped';
    case 'pre_compact':
      return 'Starting message compaction';
    case 'notification':
      return metadata?.message || 'Notification received';
    case 'error':
      return metadata?.error || 'Error occurred';
    default:
      return event_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
}

/**
 * Debounce function for search inputs
 */
export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  func: T,
  waitFor: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>): void => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), waitFor);
  };
}