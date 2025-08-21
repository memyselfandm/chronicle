/**
 * Session utility functions for the Chronicle Dashboard
 * Handles session formatting, filtering, and display logic
 */

import { SessionData } from '../stores/dashboardStore';
import { Session } from '../types/events';

/**
 * Format a session for display as "folder-name / branch"
 * Uses project_path and git_branch from session metadata or database fields
 */
export function formatSessionDisplay(session: SessionData | Session): string {
  // Handle both SessionData and Session types
  const projectPath = 'project_path' in session 
    ? session.project_path 
    : session.metadata?.project_path;
  const gitBranch = 'git_branch' in session 
    ? session.git_branch 
    : session.metadata?.git_branch;

  // Extract folder name from project path
  const folderName = projectPath 
    ? projectPath.split('/').pop() || projectPath
    : 'unknown';

  // Use branch or fallback
  const branchName = gitBranch || 'no git';

  return `${folderName} / ${branchName}`;
}

/**
 * Format session display with short ID for disambiguation
 * Example: "chronicle / main #a3f2"
 */
export function formatSessionDisplayWithId(session: SessionData | Session): string {
  const baseDisplay = formatSessionDisplay(session);
  const shortId = session.id.slice(-4);
  
  return `${baseDisplay} #${shortId}`;
}

/**
 * Extract project folder name from project path
 */
export function extractProjectFolder(projectPath?: string): string {
  if (!projectPath) return 'unknown';
  
  // Handle both absolute and relative paths
  const normalizedPath = projectPath.replace(/\\/g, '/');
  const parts = normalizedPath.split('/').filter(Boolean);
  
  return parts.length > 0 ? parts[parts.length - 1] : 'unknown';
}

/**
 * Truncate session ID for compact display
 */
export function truncateSessionId(sessionId: string, length: number = 8): string {
  return sessionId.length > length 
    ? `${sessionId.slice(0, length)}...` 
    : sessionId;
}

/**
 * Get session status badge variant based on status
 */
export function getSessionStatusVariant(
  status: 'active' | 'idle' | 'completed' | 'error'
): 'success' | 'warning' | 'secondary' | 'destructive' {
  switch (status) {
    case 'active':
      return 'success';
    case 'idle':
      return 'warning';
    case 'completed':
      return 'secondary';
    case 'error':
      return 'destructive';
    default:
      return 'secondary';
  }
}

/**
 * Get session status icon
 */
export function getSessionStatusIcon(
  status: 'active' | 'idle' | 'completed' | 'error'
): string {
  switch (status) {
    case 'active':
      return '🟢';
    case 'idle':
      return '🟡';
    case 'completed':
      return '⚪';
    case 'error':
      return '🔴';
    default:
      return '⚪';
  }
}

/**
 * Sort sessions by most recent activity
 */
export function sortSessionsByActivity(sessions: SessionData[]): SessionData[] {
  return [...sessions].sort((a, b) => {
    const aTime = a.lastActivity || a.startTime;
    const bTime = b.lastActivity || b.startTime;
    return bTime.getTime() - aTime.getTime();
  });
}

/**
 * Filter sessions by search term (searches project path and git branch)
 */
export function filterSessionsBySearch(
  sessions: SessionData[], 
  searchTerm: string
): SessionData[] {
  if (!searchTerm.trim()) return sessions;
  
  const search = searchTerm.toLowerCase();
  
  return sessions.filter(session => {
    const display = formatSessionDisplay(session).toLowerCase();
    const sessionId = session.id.toLowerCase();
    
    return display.includes(search) || sessionId.includes(search);
  });
}

/**
 * Group sessions by project folder
 */
export function groupSessionsByProject(sessions: SessionData[]): Record<string, SessionData[]> {
  return sessions.reduce((groups, session) => {
    const projectPath = session.metadata?.project_path as string;
    const folder = extractProjectFolder(projectPath);
    
    if (!groups[folder]) {
      groups[folder] = [];
    }
    
    groups[folder].push(session);
    return groups;
  }, {} as Record<string, SessionData[]>);
}

/**
 * Check if session matches the current workspace/project
 */
export function isSessionInCurrentProject(
  session: SessionData | Session, 
  currentProjectPath?: string
): boolean {
  if (!currentProjectPath) return true;
  
  const sessionProjectPath = 'project_path' in session 
    ? session.project_path 
    : session.metadata?.project_path;
    
  if (!sessionProjectPath) return false;
  
  // Normalize paths for comparison
  const normalize = (path: string) => path.replace(/\\/g, '/').toLowerCase();
  
  return normalize(sessionProjectPath).includes(normalize(currentProjectPath));
}

/**
 * Get session display props for UI components
 */
export interface SessionDisplayProps {
  displayName: string;
  displayNameWithId: string;
  statusIcon: string;
  statusVariant: 'success' | 'warning' | 'secondary' | 'destructive';
  projectFolder: string;
  gitBranch: string;
  shortId: string;
}

export function getSessionDisplayProps(session: SessionData | Session): SessionDisplayProps {
  const projectPath = 'project_path' in session 
    ? session.project_path 
    : session.metadata?.project_path;
  const gitBranch = 'git_branch' in session 
    ? session.git_branch 
    : session.metadata?.git_branch;
  const status = 'status' in session 
    ? session.status 
    : 'completed'; // Default for Session type

  return {
    displayName: formatSessionDisplay(session),
    displayNameWithId: formatSessionDisplayWithId(session),
    statusIcon: getSessionStatusIcon(status),
    statusVariant: getSessionStatusVariant(status),
    projectFolder: extractProjectFolder(projectPath),
    gitBranch: gitBranch || 'no git',
    shortId: session.id.slice(-4),
  };
}

/**
 * Validate session has required fields for display
 */
export function isValidSessionForDisplay(session: any): session is SessionData | Session {
  return session && 
    typeof session.id === 'string' && 
    (session.metadata || session.project_path !== undefined);
}