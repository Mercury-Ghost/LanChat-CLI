// Mock uuid module
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234')
}));

import {
  formatTimestamp,
  formatFileSize,
  truncateString,
  escapeHtml,
  sanitizeFileName,
  safeJsonParse,
  safeJsonStringify,
  debounce,
  throttle
} from '../shared/utils';

describe('utils', () => {
  describe('formatTimestamp', () => {
    it('should format timestamp correctly', () => {
      const date = new Date('2026-06-03T10:30:45');
      const result = formatTimestamp(date);
      expect(result).toBe('2026-06-03 10:30:45');
    });

    it('should format numeric timestamp correctly', () => {
      const date = new Date('2026-06-03T10:30:45');
      const result = formatTimestamp(date.getTime());
      expect(result).toBe('2026-06-03 10:30:45');
    });

    it('should support custom format', () => {
      const date = new Date('2026-06-03T10:30:45');
      const result = formatTimestamp(date, 'YYYY/MM/DD');
      expect(result).toBe('2026/06/03');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(500)).toBe('500 B');
    });

    it('should format KB correctly', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('should format MB correctly', () => {
      expect(formatFileSize(1048576)).toBe('1 MB');
    });
  });

  describe('truncateString', () => {
    it('should not truncate short strings', () => {
      expect(truncateString('Hello', 10)).toBe('Hello');
    });

    it('should truncate long strings with default suffix', () => {
      expect(truncateString('Hello World', 8)).toBe('Hello...');
    });

    it('should truncate long strings with custom suffix', () => {
      expect(truncateString('Hello World', 8, '***')).toBe('Hello***');
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      const result = escapeHtml('<div>"Hello" & \'World\'</div>');
      expect(result).toBe('&lt;div&gt;&quot;Hello&quot; &amp; &#039;World&#039;&lt;/div&gt;');
    });
  });

  describe('sanitizeFileName', () => {
    it('should remove invalid characters', () => {
      expect(sanitizeFileName('file<name>.txt')).toBe('file_name_.txt');
    });

    it('should trim whitespace', () => {
      expect(sanitizeFileName('  filename.txt  ')).toBe('filename.txt');
    });
  });

  describe('safeJsonParse', () => {
    it('should parse valid JSON', () => {
      expect(safeJsonParse('{"name":"test"}', {})).toEqual({ name: 'test' });
    });

    it('should return default value for invalid JSON', () => {
      expect(safeJsonParse('invalid json', {})).toEqual({});
    });
  });

  describe('safeJsonStringify', () => {
    it('should stringify valid objects', () => {
      expect(safeJsonStringify({ name: 'test' })).toBe('{"name":"test"}');
    });

    it('should return default value for circular objects', () => {
      const obj: Record<string, unknown> = {};
      obj.self = obj;
      expect(safeJsonStringify(obj)).toBe('{}');
    });
  });

  describe('debounce', () => {
    it('should debounce function calls', (done) => {
      let callCount = 0;
      const debouncedFn = debounce(() => {
        callCount++;
      }, 50);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      expect(callCount).toBe(0);

      setTimeout(() => {
        expect(callCount).toBe(1);
        done();
      }, 100);
    }, 1000);
  });

  describe('throttle', () => {
    it('should throttle function calls', (done) => {
      let callCount = 0;
      const throttledFn = throttle(() => {
        callCount++;
      }, 50);

      throttledFn();
      throttledFn();
      throttledFn();

      expect(callCount).toBe(1);

      setTimeout(() => {
        throttledFn();
        expect(callCount).toBe(2);
        done();
      }, 100);
    }, 1000);
  });
});
