import {
  formatSessionDisplay,
  formatSessionDisplayWithId,
  extractProjectFolder,
  truncateSessionId,
  getSessionStatusVariant,
  getSessionStatusIcon,
  sortSessionsByActivity,
  filterSessionsBySearch,
  groupSessionsByProject,
  isSessionInCurrentProject,
  getSessionDisplayProps,
  isValidSessionForDisplay,
  SessionDisplayProps,
} from '../../src/lib/sessionUtils';
import { SessionData } from '../../src/stores/dashboardStore';
import { Session } from '../../src/types/events';

describe('sessionUtils', () => {
  // Mock SessionData for testing
  const mockSessionData: SessionData = {
    id: 'session-12345678-abcd',
    projectPath: '/Users/developer/workspace/my-project',
    gitBranch: 'feature/new-dashboard',
    status: 'active',
    startTime: new Date('2024-01-01T10:00:00Z'),
    lastActivity: new Date('2024-01-01T10:30:00Z'),
    metadata: {
      project_path: '/Users/developer/workspace/my-project',
      git_branch: 'feature/new-dashboard',
    },
  };

  // Mock Session for testing
  const mockSession: Session = {
    id: 'session-87654321-dcba',
    project_path: '/home/user/projects/chronicle-app',
    git_branch: 'main',
    start_time: new Date('2024-01-01T09:00:00Z'),
    end_time: null,
    status: 'completed',
    event_count: 0,
    created_at: new Date('2024-01-01T09:00:00Z'),
    updated_at: new Date('2024-01-01T09:30:00Z'),
    metadata: {
      project_path: '/home/user/projects/chronicle-app',
      git_branch: 'main',
    },
  };

  describe('formatSessionDisplay', () => {
    it('should format SessionData correctly', () => {
      const result = formatSessionDisplay(mockSessionData);
      expect(result).toBe('my-project / feature/new-dashboard');
    });

    it('should format Session correctly', () => {
      const result = formatSessionDisplay(mockSession);
      expect(result).toBe('chronicle-app / main');
    });

    it('should handle missing project path', () => {
      const session = { ...mockSessionData, projectPath: undefined };
      const result = formatSessionDisplay(session);
      expect(result).toBe('my-project / feature/new-dashboard'); // Falls back to metadata
    });

    it('should handle missing git branch', () => {
      const session = { ...mockSessionData, gitBranch: undefined };
      const result = formatSessionDisplay(session);
      expect(result).toBe('my-project / no git');
    });

    it('should handle completely missing project info', () => {
      const session = { 
        ...mockSessionData, 
        projectPath: undefined,
        metadata: {} 
      };
      const result = formatSessionDisplay(session);
      expect(result).toBe('unknown / feature/new-dashboard');
    });

    it('should handle root directory paths', () => {
      const session = { ...mockSessionData, projectPath: '/' };
      const result = formatSessionDisplay(session);
      expect(result).toBe('/ / feature/new-dashboard');
    });

    it('should handle Windows paths', () => {
      const session = { 
        ...mockSessionData, 
        projectPath: 'C:\\Users\\Developer\\Projects\\MyApp'
      };
      const result = formatSessionDisplay(session);
      expect(result).toBe('MyApp / feature/new-dashboard');
    });
  });

  describe('formatSessionDisplayWithId', () => {
    it('should include short ID in display', () => {
      const result = formatSessionDisplayWithId(mockSessionData);
      expect(result).toBe('my-project / feature/new-dashboard #abcd');
    });

    it('should handle short session IDs', () => {
      const shortSession = { ...mockSessionData, id: 'abc' };
      const result = formatSessionDisplayWithId(shortSession);
      expect(result).toBe('my-project / feature/new-dashboard #abc');
    });

    it('should work with Session objects', () => {
      const result = formatSessionDisplayWithId(mockSession);
      expect(result).toBe('chronicle-app / main #dcba');
    });
  });

  describe('extractProjectFolder', () => {
    it('should extract folder from Unix path', () => {
      const result = extractProjectFolder('/home/user/projects/my-app');
      expect(result).toBe('my-app');
    });

    it('should extract folder from Windows path', () => {
      const result = extractProjectFolder('C:\\Users\\Developer\\Projects\\MyApp');
      expect(result).toBe('MyApp');
    });

    it('should handle relative paths', () => {
      const result = extractProjectFolder('./my-project');
      expect(result).toBe('my-project');
    });

    it('should handle paths ending with slash', () => {
      const result = extractProjectFolder('/path/to/project/');
      expect(result).toBe('project');
    });

    it('should handle single folder name', () => {
      const result = extractProjectFolder('project');
      expect(result).toBe('project');
    });

    it('should handle empty or undefined path', () => {
      expect(extractProjectFolder('')).toBe('unknown');
      expect(extractProjectFolder(undefined)).toBe('unknown');
    });

    it('should handle root path', () => {
      const result = extractProjectFolder('/');
      expect(result).toBe('unknown');
    });
  });

  describe('truncateSessionId', () => {
    it('should truncate long session IDs', () => {
      const longId = 'session-12345678-abcd-efgh-ijkl-mnop';
      const result = truncateSessionId(longId, 8);
      expect(result).toBe('session-...');
    });

    it('should not truncate short session IDs', () => {
      const shortId = 'abc123';
      const result = truncateSessionId(shortId, 8);
      expect(result).toBe('abc123');
    });

    it('should use default length of 8', () => {
      const longId = 'abcdefghijklmnop';
      const result = truncateSessionId(longId);
      expect(result).toBe('abcdefgh...');
    });

    it('should handle empty string', () => {
      const result = truncateSessionId('');
      expect(result).toBe('');
    });

    it('should handle exact length match', () => {
      const exactId = '12345678';
      const result = truncateSessionId(exactId, 8);
      expect(result).toBe('12345678');
    });
  });

  describe('getSessionStatusVariant', () => {
    it('should return correct variant for each status', () => {
      expect(getSessionStatusVariant('active')).toBe('success');
      expect(getSessionStatusVariant('idle')).toBe('warning');
      expect(getSessionStatusVariant('completed')).toBe('secondary');
      expect(getSessionStatusVariant('error')).toBe('destructive');
    });

    it('should return secondary for unknown status', () => {
      expect(getSessionStatusVariant('unknown' as any)).toBe('secondary');
    });
  });

  describe('getSessionStatusIcon', () => {
    it('should return correct icon for each status', () => {
      expect(getSessionStatusIcon('active')).toBe('🟢');
      expect(getSessionStatusIcon('idle')).toBe('🟡');
      expect(getSessionStatusIcon('completed')).toBe('⚪');
      expect(getSessionStatusIcon('error')).toBe('🔴');
    });

    it('should return default icon for unknown status', () => {
      expect(getSessionStatusIcon('unknown' as any)).toBe('⚪');
    });
  });

  describe('sortSessionsByActivity', () => {
    it('should sort by last activity first', () => {
      const sessions: SessionData[] = [
        {
          ...mockSessionData,
          id: 'session-1',
          lastActivity: new Date('2024-01-01T08:00:00Z'),
        },
        {
          ...mockSessionData,
          id: 'session-2',
          lastActivity: new Date('2024-01-01T10:00:00Z'),
        },
        {
          ...mockSessionData,
          id: 'session-3',
          lastActivity: new Date('2024-01-01T09:00:00Z'),
        },
      ];

      const result = sortSessionsByActivity(sessions);

      expect(result[0].id).toBe('session-2'); // Most recent
      expect(result[1].id).toBe('session-3');
      expect(result[2].id).toBe('session-1'); // Oldest
    });

    it('should fall back to start time when no last activity', () => {
      const sessions: SessionData[] = [
        {
          ...mockSessionData,
          id: 'session-1',
          startTime: new Date('2024-01-01T08:00:00Z'),
          lastActivity: undefined,
        },
        {
          ...mockSessionData,
          id: 'session-2',
          startTime: new Date('2024-01-01T10:00:00Z'),
          lastActivity: new Date('2024-01-01T10:30:00Z'),
        },
      ];

      const result = sortSessionsByActivity(sessions);

      expect(result[0].id).toBe('session-2'); // Has lastActivity
      expect(result[1].id).toBe('session-1'); // Only startTime
    });

    it('should not mutate original array', () => {
      const sessions = [mockSessionData];
      const result = sortSessionsByActivity(sessions);

      expect(result).not.toBe(sessions);
      expect(sessions).toHaveLength(1); // Original unchanged
    });

    it('should handle empty array', () => {
      const result = sortSessionsByActivity([]);
      expect(result).toEqual([]);
    });
  });

  describe('filterSessionsBySearch', () => {
    const sessions: SessionData[] = [
      {
        ...mockSessionData,
        id: 'session-dashboard-123',
        projectPath: '/workspace/dashboard-app',
        gitBranch: 'feature/new-ui',
      },
      {
        ...mockSessionData,
        id: 'session-api-456',
        projectPath: '/workspace/api-server',
        gitBranch: 'main',
      },
      {
        ...mockSessionData,
        id: 'session-mobile-789',
        projectPath: '/workspace/mobile-client',
        gitBranch: 'feature/authentication',
      },
    ];

    it('should filter by project folder name', () => {
      const result = filterSessionsBySearch(sessions, 'dashboard');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('session-dashboard-123');
    });

    it('should filter by git branch', () => {
      const result = filterSessionsBySearch(sessions, 'feature');
      expect(result).toHaveLength(2);
    });

    it('should filter by session ID', () => {
      const result = filterSessionsBySearch(sessions, 'api');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('session-api-456');
    });

    it('should be case insensitive', () => {
      const result = filterSessionsBySearch(sessions, 'DASHBOARD');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('session-dashboard-123');
    });

    it('should return all sessions for empty search', () => {
      expect(filterSessionsBySearch(sessions, '')).toEqual(sessions);
      expect(filterSessionsBySearch(sessions, '   ')).toEqual(sessions);
    });

    it('should return empty array for no matches', () => {
      const result = filterSessionsBySearch(sessions, 'nonexistent');
      expect(result).toEqual([]);
    });

    it('should handle partial matches', () => {
      const result = filterSessionsBySearch(sessions, 'dash');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('session-dashboard-123');
    });
  });

  describe('groupSessionsByProject', () => {
    const sessions: SessionData[] = [
      {
        ...mockSessionData,
        id: 'session-1',
        projectPath: '/workspace/dashboard-app',
      },
      {
        ...mockSessionData,
        id: 'session-2',
        projectPath: '/workspace/dashboard-app',
      },
      {
        ...mockSessionData,
        id: 'session-3',
        projectPath: '/workspace/api-server',
      },
      {
        ...mockSessionData,
        id: 'session-4',
        metadata: { project_path: '/workspace/mobile-client' },
        projectPath: undefined,
      },
    ];

    it('should group sessions by project folder', () => {
      const result = groupSessionsByProject(sessions);

      expect(Object.keys(result)).toHaveLength(3);
      expect(result['dashboard-app']).toHaveLength(2);
      expect(result['api-server']).toHaveLength(1);
      expect(result['mobile-client']).toHaveLength(1);
    });

    it('should handle sessions without project path', () => {
      const sessionsWithMissing = [
        ...sessions,
        {
          ...mockSessionData,
          id: 'session-5',
          projectPath: undefined,
          metadata: {},
        },
      ];

      const result = groupSessionsByProject(sessionsWithMissing);
      expect(result['unknown']).toHaveLength(1);
    });

    it('should handle empty array', () => {
      const result = groupSessionsByProject([]);
      expect(result).toEqual({});
    });
  });

  describe('isSessionInCurrentProject', () => {
    it('should return true for matching project paths', () => {
      const result = isSessionInCurrentProject(
        mockSession, 
        '/home/user/projects/chronicle-app'
      );
      expect(result).toBe(true);
    });

    it('should return true for partial path matches', () => {
      const result = isSessionInCurrentProject(
        mockSession, 
        'chronicle-app'
      );
      expect(result).toBe(true);
    });

    it('should return false for non-matching paths', () => {
      const result = isSessionInCurrentProject(
        mockSession, 
        '/different/project'
      );
      expect(result).toBe(false);
    });

    it('should return true when no current project path provided', () => {
      const result = isSessionInCurrentProject(mockSession, undefined);
      expect(result).toBe(true);
    });

    it('should return false when session has no project path', () => {
      const sessionWithoutPath = { ...mockSession, project_path: undefined };
      const result = isSessionInCurrentProject(
        sessionWithoutPath, 
        '/some/project'
      );
      expect(result).toBe(false);
    });

    it('should handle case insensitive matching', () => {
      const result = isSessionInCurrentProject(
        mockSession, 
        'CHRONICLE-APP'
      );
      expect(result).toBe(true);
    });

    it('should handle Windows vs Unix path separators', () => {
      const windowsSession = { 
        ...mockSession, 
        project_path: 'C:\\Projects\\Chronicle-App'
      };
      const result = isSessionInCurrentProject(
        windowsSession, 
        '/projects/chronicle-app'
      );
      expect(result).toBe(true);
    });

    it('should work with SessionData objects', () => {
      const result = isSessionInCurrentProject(
        mockSessionData, 
        'my-project'
      );
      expect(result).toBe(true);
    });
  });

  describe('getSessionDisplayProps', () => {
    it('should return complete display props for SessionData', () => {
      const result = getSessionDisplayProps(mockSessionData);

      expect(result).toEqual({
        displayName: 'my-project / feature/new-dashboard',
        displayNameWithId: 'my-project / feature/new-dashboard #abcd',
        statusIcon: '🟢',
        statusVariant: 'success',
        projectFolder: 'my-project',
        gitBranch: 'feature/new-dashboard',
        shortId: 'abcd',
      });
    });

    it('should return display props for Session with default status', () => {
      const result = getSessionDisplayProps(mockSession);

      expect(result).toEqual({
        displayName: 'chronicle-app / main',
        displayNameWithId: 'chronicle-app / main #dcba',
        statusIcon: '⚪',
        statusVariant: 'secondary',
        projectFolder: 'chronicle-app',
        gitBranch: 'main',
        shortId: 'dcba',
      });
    });

    it('should handle missing git branch', () => {
      const sessionWithoutBranch = { 
        ...mockSessionData, 
        gitBranch: undefined,
        metadata: { ...mockSessionData.metadata, git_branch: undefined }
      };
      const result = getSessionDisplayProps(sessionWithoutBranch);

      expect(result.gitBranch).toBe('no git');
      expect(result.displayName).toContain('no git');
    });

    it('should handle error status', () => {
      const errorSession = { ...mockSessionData, status: 'error' as const };
      const result = getSessionDisplayProps(errorSession);

      expect(result.statusIcon).toBe('🔴');
      expect(result.statusVariant).toBe('destructive');
    });
  });

  describe('isValidSessionForDisplay', () => {
    it('should return true for valid SessionData', () => {
      expect(isValidSessionForDisplay(mockSessionData)).toBe(true);
    });

    it('should return true for valid Session', () => {
      expect(isValidSessionForDisplay(mockSession)).toBe(true);
    });

    it('should return false for null/undefined', () => {
      expect(isValidSessionForDisplay(null)).toBe(false);
      expect(isValidSessionForDisplay(undefined)).toBe(false);
    });

    it('should return false for missing id', () => {
      const invalidSession = { ...mockSessionData, id: undefined };
      expect(isValidSessionForDisplay(invalidSession)).toBe(false);
    });

    it('should return false for non-string id', () => {
      const invalidSession = { ...mockSessionData, id: 123 };
      expect(isValidSessionForDisplay(invalidSession)).toBe(false);
    });

    it('should return false for missing metadata and project_path', () => {
      const invalidSession = { 
        id: 'valid-id',
        // no metadata or project_path
      };
      expect(isValidSessionForDisplay(invalidSession)).toBe(false);
    });

    it('should return true for Session with project_path but no metadata', () => {
      const validSession = {
        id: 'valid-id',
        project_path: '/some/path',
        git_branch: 'main',
      };
      expect(isValidSessionForDisplay(validSession)).toBe(true);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large session arrays efficiently', () => {
      const largeSessions = Array.from({ length: 1000 }, (_, i) => ({
        ...mockSessionData,
        id: `session-${i}`,
        projectPath: `/project-${i % 10}`,
        lastActivity: new Date(Date.now() - i * 1000),
      }));

      const start = performance.now();
      const sorted = sortSessionsByActivity(largeSessions);
      const filtered = filterSessionsBySearch(sorted, 'project-5');
      const grouped = groupSessionsByProject(filtered);
      const end = performance.now();

      expect(sorted).toHaveLength(1000);
      expect(filtered.length).toBeGreaterThan(0);
      expect(Object.keys(grouped)).toHaveLength(1);
      expect(end - start).toBeLessThan(100); // Should complete quickly
    });

    it('should handle malformed session objects gracefully', () => {
      const malformedSessions = [
        { id: 'valid', metadata: {} },
        { id: null, metadata: {} },
        { metadata: {} }, // missing id
        null,
        undefined,
        { id: 'valid', projectPath: 'valid-path' },
      ];

      expect(() => {
        malformedSessions.forEach(session => {
          if (isValidSessionForDisplay(session)) {
            formatSessionDisplay(session);
            getSessionDisplayProps(session);
          }
        });
      }).not.toThrow();
    });

    it('should maintain type safety with mixed session types', () => {
      const mixedSessions = [mockSessionData, mockSession];

      mixedSessions.forEach(session => {
        expect(typeof formatSessionDisplay(session)).toBe('string');
        expect(typeof getSessionDisplayProps(session)).toBe('object');
      });
    });

    it('should handle Unicode and special characters in paths', () => {
      const unicodeSession = {
        ...mockSessionData,
        projectPath: '/Users/开发者/项目/my-app',
        gitBranch: 'feature/测试分支',
      };

      expect(() => {
        formatSessionDisplay(unicodeSession);
        extractProjectFolder(unicodeSession.projectPath);
      }).not.toThrow();

      const result = formatSessionDisplay(unicodeSession);
      expect(result).toContain('my-app');
      expect(result).toContain('测试分支');
    });

    it('should handle very long project paths and branch names', () => {
      const longPath = '/very/long/path/with/many/nested/directories/that/might/cause/issues/my-project';
      const longBranch = 'feature/this-is-a-very-long-branch-name-that-exceeds-normal-limits';
      
      const longSession = {
        ...mockSessionData,
        projectPath: longPath,
        gitBranch: longBranch,
      };

      expect(() => {
        formatSessionDisplay(longSession);
        getSessionDisplayProps(longSession);
      }).not.toThrow();

      const result = formatSessionDisplay(longSession);
      expect(result).toContain('my-project');
      expect(result).toContain(longBranch);
    });
  });
});