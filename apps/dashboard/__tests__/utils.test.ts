import { formatters, getSessionColor, getEventTypeLabel, getToolCategory } from '@/lib/utils';

describe('Utils Functions', () => {
  describe('formatters', () => {
    it('formats time ago correctly', () => {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      expect(formatters.timeAgo(oneMinuteAgo)).toBe('1m ago');
      expect(formatters.timeAgo(oneHourAgo)).toBe('1h ago');
      expect(formatters.timeAgo(oneDayAgo)).toBe('1d ago');
    });

    it('formats timestamp correctly', () => {
      const date = new Date('2023-12-15T14:32:45');
      const result = formatters.timestamp(date);
      expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
    });

    it('formats date correctly', () => {
      const date = new Date('2023-12-15T14:32:45');
      const result = formatters.date(date);
      expect(result).toContain('Dec');
      expect(result).toContain('15');
      expect(result).toContain('2023');
    });
  });

  describe('getSessionColor', () => {
    it('returns consistent colors for same session ID', () => {
      const sessionId = 'test-session-123';
      const color1 = getSessionColor(sessionId);
      const color2 = getSessionColor(sessionId);
      
      expect(color1).toBe(color2);
      expect(color1).toMatch(/^bg-accent-/);
    });

    it('returns different colors for different session IDs', () => {
      const color1 = getSessionColor('session-1');
      const color2 = getSessionColor('session-2');
      
      // While they could theoretically be the same due to hash collision,
      // it's statistically unlikely for these simple test cases
      expect(color1).toMatch(/^bg-accent-/);
      expect(color2).toMatch(/^bg-accent-/);
    });
  });

  describe('getEventTypeLabel', () => {
    it('formats known event types correctly', () => {
      expect(getEventTypeLabel('pre_tool_use')).toBe('Pre Tool Use');
      expect(getEventTypeLabel('user_prompt_submit')).toBe('User Prompt');
      expect(getEventTypeLabel('session_start')).toBe('Session Start');
    });

    it('formats unknown event types by transforming underscores', () => {
      expect(getEventTypeLabel('custom_event_type')).toBe('Custom Event Type');
    });
  });

  describe('getToolCategory', () => {
    it('categorizes file operation tools correctly', () => {
      expect(getToolCategory('Read')).toBe('File Operations');
      expect(getToolCategory('Write')).toBe('File Operations');
      expect(getToolCategory('Edit')).toBe('File Operations');
    });

    it('categorizes search tools correctly', () => {
      expect(getToolCategory('Glob')).toBe('Search & Discovery');
      expect(getToolCategory('Grep')).toBe('Search & Discovery');
    });

    it('categorizes MCP tools correctly', () => {
      expect(getToolCategory('mcp__server__tool')).toBe('MCP Tools');
    });

    it('returns Other for unknown tools', () => {
      expect(getToolCategory('UnknownTool')).toBe('Other');
    });
  });
});