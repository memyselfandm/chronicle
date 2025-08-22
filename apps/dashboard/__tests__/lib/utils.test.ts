import {
  formatTimestamp,
  formatDuration,
  formatBytes,
  formatCurrency,
  truncateText,
  debounce,
  throttle,
  generateId,
  validateEmail,
  sanitizeInput,
  parseEventData,
  calculatePercentage,
  getTimeAgo,
  isValidUrl,
  formatNumber,
} from '../../src/lib/utils';

describe('Utility Functions', () => {
  describe('formatTimestamp', () => {
    it('should format ISO timestamp correctly', () => {
      const timestamp = '2024-01-15T10:30:00.000Z';
      const result = formatTimestamp(timestamp);
      expect(result).toMatch(/Jan 15, 2024/);
    });

    it('should handle invalid timestamps gracefully', () => {
      expect(formatTimestamp('invalid')).toBe('Invalid Date');
      expect(formatTimestamp('')).toBe('Invalid Date');
      expect(formatTimestamp(null)).toBe('Invalid Date');
    });

    it('should format with custom format', () => {
      const timestamp = '2024-01-15T10:30:00.000Z';
      const result = formatTimestamp(timestamp, 'yyyy-MM-dd');
      expect(result).toBe('2024-01-15');
    });

    it('should handle timezone differences', () => {
      const timestamp = '2024-01-15T10:30:00.000Z';
      const result = formatTimestamp(timestamp, 'HH:mm', 'UTC');
      expect(result).toBe('10:30');
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds correctly', () => {
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(1500)).toBe('1.5s');
      expect(formatDuration(65000)).toBe('1m 5s');
      expect(formatDuration(3665000)).toBe('1h 1m 5s');
    });

    it('should handle zero duration', () => {
      expect(formatDuration(0)).toBe('0ms');
    });

    it('should handle negative durations', () => {
      expect(formatDuration(-1000)).toBe('0ms');
    });

    it('should format large durations', () => {
      const oneDay = 24 * 60 * 60 * 1000;
      expect(formatDuration(oneDay)).toBe('1d');
      expect(formatDuration(oneDay + 3600000)).toBe('1d 1h');
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1048576)).toBe('1 MB');
      expect(formatBytes(1073741824)).toBe('1 GB');
    });

    it('should handle decimal places', () => {
      expect(formatBytes(1536, 1)).toBe('1.5 KB');
      expect(formatBytes(1536, 2)).toBe('1.50 KB');
    });

    it('should handle negative values', () => {
      expect(formatBytes(-1024)).toBe('0 B');
    });

    it('should handle very large values', () => {
      const terabyte = 1024 * 1024 * 1024 * 1024;
      expect(formatBytes(terabyte)).toBe('1 TB');
    });
  });

  describe('formatCurrency', () => {
    it('should format USD currency correctly', () => {
      expect(formatCurrency(10.99)).toBe('$10.99');
      expect(formatCurrency(1000)).toBe('$1,000.00');
      expect(formatCurrency(0.05)).toBe('$0.05');
    });

    it('should handle different currencies', () => {
      expect(formatCurrency(10.99, 'EUR')).toBe('€10.99');
      expect(formatCurrency(10.99, 'GBP')).toBe('£10.99');
    });

    it('should handle zero and negative values', () => {
      expect(formatCurrency(0)).toBe('$0.00');
      expect(formatCurrency(-10.50)).toBe('-$10.50');
    });

    it('should handle very large amounts', () => {
      expect(formatCurrency(1000000.99)).toBe('$1,000,000.99');
    });
  });

  describe('truncateText', () => {
    const longText = 'This is a very long text that should be truncated';

    it('should truncate text correctly', () => {
      expect(truncateText(longText, 20)).toBe('This is a very long...');
    });

    it('should not truncate if text is shorter than limit', () => {
      expect(truncateText('Short text', 20)).toBe('Short text');
    });

    it('should handle custom suffix', () => {
      expect(truncateText(longText, 20, ' [more]')).toBe('This is a very long [more]');
    });

    it('should handle empty or null text', () => {
      expect(truncateText('', 10)).toBe('');
      expect(truncateText(null, 10)).toBe('');
      expect(truncateText(undefined, 10)).toBe('');
    });

    it('should handle zero or negative length', () => {
      expect(truncateText(longText, 0)).toBe('...');
      expect(truncateText(longText, -5)).toBe('...');
    });
  });

  describe('debounce', () => {
    jest.useFakeTimers();

    it('should debounce function calls', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 300);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(300);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should reset debounce timer on new calls', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 300);

      debouncedFn();
      jest.advanceTimersByTime(200);
      debouncedFn();
      jest.advanceTimersByTime(200);
      
      expect(mockFn).not.toHaveBeenCalled();
      
      jest.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments correctly', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 300);

      debouncedFn('arg1', 'arg2');
      jest.advanceTimersByTime(300);

      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    afterEach(() => {
      jest.clearAllTimers();
    });
  });

  describe('throttle', () => {
    jest.useFakeTimers();

    it('should throttle function calls', () => {
      const mockFn = jest.fn();
      const throttledFn = throttle(mockFn, 300);

      throttledFn();
      throttledFn();
      throttledFn();

      expect(mockFn).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(300);
      throttledFn();

      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should execute immediately on first call', () => {
      const mockFn = jest.fn();
      const throttledFn = throttle(mockFn, 300);

      throttledFn();
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    afterEach(() => {
      jest.clearAllTimers();
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
    });

    it('should generate IDs with custom prefix', () => {
      const id = generateId('test');
      expect(id).toMatch(/^test_/);
    });

    it('should generate IDs with custom length', () => {
      const id = generateId('', 16);
      expect(id.length).toBe(16);
    });
  });

  describe('validateEmail', () => {
    it('should validate correct email addresses', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name+tag@domain.co.uk')).toBe(true);
      expect(validateEmail('user123@test-domain.org')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('@domain.com')).toBe(false);
      expect(validateEmail('test.domain.com')).toBe(false);
      expect(validateEmail('')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(validateEmail(null)).toBe(false);
      expect(validateEmail(undefined)).toBe(false);
      expect(validateEmail('test@@domain.com')).toBe(false);
    });
  });

  describe('sanitizeInput', () => {
    it('should remove dangerous HTML tags', () => {
      const malicious = '<script>alert("xss")</script>Hello<b>World</b>';
      const sanitized = sanitizeInput(malicious);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert');
      expect(sanitized).toContain('Hello');
    });

    it('should preserve safe HTML tags', () => {
      const safe = 'Hello <b>bold</b> and <i>italic</i> text';
      const sanitized = sanitizeInput(safe, { allowedTags: ['b', 'i'] });
      
      expect(sanitized).toBe(safe);
    });

    it('should handle empty or null input', () => {
      expect(sanitizeInput('')).toBe('');
      expect(sanitizeInput(null)).toBe('');
      expect(sanitizeInput(undefined)).toBe('');
    });
  });

  describe('parseEventData', () => {
    it('should parse valid JSON event data', () => {
      const jsonData = '{"type": "user_input", "message": "test"}';
      const parsed = parseEventData(jsonData);
      
      expect(parsed).toEqual({ type: 'user_input', message: 'test' });
    });

    it('should handle invalid JSON gracefully', () => {
      const invalidJson = '{"invalid": json}';
      const parsed = parseEventData(invalidJson);
      
      expect(parsed).toEqual({ raw: invalidJson, error: 'Invalid JSON' });
    });

    it('should handle non-string input', () => {
      const objectData = { type: 'test' };
      const parsed = parseEventData(objectData);
      
      expect(parsed).toEqual(objectData);
    });

    it('should handle null or undefined', () => {
      expect(parseEventData(null)).toEqual({});
      expect(parseEventData(undefined)).toEqual({});
    });
  });

  describe('calculatePercentage', () => {
    it('should calculate percentage correctly', () => {
      expect(calculatePercentage(25, 100)).toBe(25);
      expect(calculatePercentage(1, 3)).toBe(33.33);
      expect(calculatePercentage(2, 3, 1)).toBe(66.7);
    });

    it('should handle zero denominator', () => {
      expect(calculatePercentage(10, 0)).toBe(0);
    });

    it('should handle negative numbers', () => {
      expect(calculatePercentage(-10, 100)).toBe(-10);
      expect(calculatePercentage(10, -100)).toBe(-10);
    });

    it('should handle decimal precision', () => {
      expect(calculatePercentage(1, 3, 0)).toBe(33);
      expect(calculatePercentage(1, 3, 5)).toBe(33.33333);
    });
  });

  describe('getTimeAgo', () => {
    const now = new Date('2024-01-15T12:00:00.000Z');
    
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(now);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should format recent times correctly', () => {
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      expect(getTimeAgo(fiveMinutesAgo.toISOString())).toBe('5 minutes ago');
      
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      expect(getTimeAgo(oneHourAgo.toISOString())).toBe('1 hour ago');
    });

    it('should handle very recent times', () => {
      const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000);
      expect(getTimeAgo(thirtySecondsAgo.toISOString())).toBe('just now');
    });

    it('should format older dates', () => {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      expect(getTimeAgo(yesterday.toISOString())).toBe('1 day ago');
    });

    it('should handle invalid dates', () => {
      expect(getTimeAgo('invalid')).toBe('unknown');
      expect(getTimeAgo('')).toBe('unknown');
    });
  });

  describe('isValidUrl', () => {
    it('should validate correct URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://test.org')).toBe(true);
      expect(isValidUrl('https://sub.domain.com/path?query=1')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('ftp://example.com')).toBe(false);
      expect(isValidUrl('')).toBe(false);
      expect(isValidUrl('https://')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(isValidUrl(null)).toBe(false);
      expect(isValidUrl(undefined)).toBe(false);
      expect(isValidUrl('javascript:alert(1)')).toBe(false);
    });
  });

  describe('formatNumber', () => {
    it('should format numbers with commas', () => {
      expect(formatNumber(1000)).toBe('1,000');
      expect(formatNumber(1234567)).toBe('1,234,567');
      expect(formatNumber(42)).toBe('42');
    });

    it('should handle decimal places', () => {
      expect(formatNumber(1234.56, 2)).toBe('1,234.56');
      expect(formatNumber(1000.1, 1)).toBe('1,000.1');
    });

    it('should handle negative numbers', () => {
      expect(formatNumber(-1000)).toBe('-1,000');
      expect(formatNumber(-1234.56, 2)).toBe('-1,234.56');
    });

    it('should handle zero', () => {
      expect(formatNumber(0)).toBe('0');
      expect(formatNumber(0, 2)).toBe('0.00');
    });

    it('should handle very large numbers', () => {
      expect(formatNumber(1000000000)).toBe('1,000,000,000');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null and undefined inputs gracefully', () => {
      // Test all functions with null/undefined where applicable
      expect(() => formatTimestamp(null)).not.toThrow();
      expect(() => formatDuration(null)).not.toThrow();
      expect(() => truncateText(null, 10)).not.toThrow();
      expect(() => validateEmail(null)).not.toThrow();
      expect(() => sanitizeInput(null)).not.toThrow();
    });

    it('should handle extreme numeric values', () => {
      expect(formatBytes(Number.MAX_SAFE_INTEGER)).toBeTruthy();
      expect(formatCurrency(Number.MAX_SAFE_INTEGER)).toBeTruthy();
      expect(calculatePercentage(Number.MAX_SAFE_INTEGER, 1)).toBeTruthy();
    });

    it('should handle non-string inputs for string functions', () => {
      expect(() => truncateText(123, 5)).not.toThrow();
      expect(() => sanitizeInput(123)).not.toThrow();
      expect(() => validateEmail(123)).not.toThrow();
    });
  });
});