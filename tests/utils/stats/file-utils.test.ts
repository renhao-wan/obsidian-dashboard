import {
  shouldIncludeFile,
  getFileExtension,
  getFileName,
  getFolder,
  formatFileSize,
  isCreatedToday,
  isCreatedThisWeek,
  isCreatedThisMonth,
  formatDate,
  groupFilesByDate,
  groupFilesByExtension,
} from '../../../src/utils/stats/file-utils';
import type { FileTypeConfig } from '../../../src/sections/stats/types';

describe('file-utils', () => {
  describe('shouldIncludeFile', () => {
    it('should include file with enabled extension', () => {
      const config: FileTypeConfig = {
        enabled: true,
        extensions: ['.md', '.txt'],
        excludePatterns: [],
      };
      expect(shouldIncludeFile('test.md', config)).toBe(true);
    });

    it('should exclude file with disabled extension', () => {
      const config: FileTypeConfig = {
        enabled: true,
        extensions: ['.md'],
        excludePatterns: [],
      };
      expect(shouldIncludeFile('test.txt', config)).toBe(false);
    });

    it('should exclude file matching pattern', () => {
      const config: FileTypeConfig = {
        enabled: true,
        extensions: ['.md'],
        excludePatterns: ['node_modules'],
      };
      expect(shouldIncludeFile('node_modules/test.md', config)).toBe(false);
    });

    it('should include file not matching exclude patterns', () => {
      const config: FileTypeConfig = {
        enabled: true,
        extensions: ['.md'],
        excludePatterns: ['node_modules', '.git'],
      };
      expect(shouldIncludeFile('docs/notes.md', config)).toBe(true);
    });

    it('should handle case-insensitive extensions', () => {
      const config: FileTypeConfig = {
        enabled: true,
        extensions: ['.md'],
        excludePatterns: [],
      };
      // getFileExtension lowercases the result
      expect(shouldIncludeFile('test.MD', config)).toBe(true);
    });
  });

  describe('getFileExtension', () => {
    it('should return extension with dot', () => {
      expect(getFileExtension('test.md')).toBe('.md');
    });

    it('should return empty string for no extension', () => {
      expect(getFileExtension('test')).toBe('');
    });

    it('should lowercase the extension', () => {
      expect(getFileExtension('file.TXT')).toBe('.txt');
    });

    it('should handle multiple dots in filename', () => {
      expect(getFileExtension('my.file.name.md')).toBe('.md');
    });

    it('should handle path with dots', () => {
      expect(getFileExtension('path/to/file.md')).toBe('.md');
    });
  });

  describe('getFileName', () => {
    it('should return file name from path', () => {
      expect(getFileName('path/to/test.md')).toBe('test.md');
    });

    it('should return file name for root file', () => {
      expect(getFileName('test.md')).toBe('test.md');
    });

    it('should handle deep paths', () => {
      expect(getFileName('a/b/c/d/file.txt')).toBe('file.txt');
    });
  });

  describe('getFolder', () => {
    it('should return folder path', () => {
      expect(getFolder('path/to/test.md')).toBe('path/to');
    });

    it('should return empty string for root file', () => {
      expect(getFolder('test.md')).toBe('');
    });

    it('should handle deep paths', () => {
      expect(getFolder('a/b/c/file.md')).toBe('a/b/c');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(formatFileSize(500)).toBe('500 B');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
    });

    it('should format zero', () => {
      expect(formatFileSize(0)).toBe('0 B');
    });

    it('should format fractional values', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });
  });

  describe('isCreatedToday', () => {
    it('should return true for a timestamp from today', () => {
      expect(isCreatedToday(Date.now())).toBe(true);
    });

    it('should return false for a timestamp from yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      expect(isCreatedToday(yesterday.getTime())).toBe(false);
    });
  });

  describe('isCreatedThisWeek', () => {
    it('should return true for a timestamp from this week', () => {
      expect(isCreatedThisWeek(Date.now())).toBe(true);
    });

    it('should return false for a timestamp from last week', () => {
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      lastWeek.setHours(0, 0, 0, 0);
      // Make sure it's before the start of this week
      const startOfThisWeek = new Date();
      const dayOfWeek = startOfThisWeek.getDay();
      startOfThisWeek.setDate(startOfThisWeek.getDate() - dayOfWeek);
      startOfThisWeek.setHours(0, 0, 0, 0);
      if (lastWeek.getTime() < startOfThisWeek.getTime()) {
        expect(isCreatedThisWeek(lastWeek.getTime())).toBe(false);
      }
    });
  });

  describe('isCreatedThisMonth', () => {
    it('should return true for a timestamp from this month', () => {
      expect(isCreatedThisMonth(Date.now())).toBe(true);
    });

    it('should return false for a timestamp from last month', () => {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      expect(isCreatedThisMonth(lastMonth.getTime())).toBe(false);
    });
  });

  describe('formatDate', () => {
    it('should format date as YYYY-MM-DD', () => {
      // 2024-01-15 00:00:00 UTC
      const timestamp = new Date(2024, 0, 15).getTime();
      expect(formatDate(timestamp)).toBe('2024-01-15');
    });

    it('should pad single digit month and day', () => {
      const timestamp = new Date(2024, 0, 5).getTime();
      expect(formatDate(timestamp)).toBe('2024-01-05');
    });
  });

  describe('groupFilesByDate', () => {
    it('should group files by creation date', () => {
      const files = [
        { created: new Date(2024, 0, 15).getTime() },
        { created: new Date(2024, 0, 15).getTime() },
        { created: new Date(2024, 0, 16).getTime() },
      ];
      const result = groupFilesByDate(files);
      expect(result.get('2024-01-15')).toBe(2);
      expect(result.get('2024-01-16')).toBe(1);
    });

    it('should return empty map for empty array', () => {
      const result = groupFilesByDate([]);
      expect(result.size).toBe(0);
    });
  });

  describe('groupFilesByExtension', () => {
    it('should group files by extension', () => {
      const files = [
        { extension: '.md' },
        { extension: '.md' },
        { extension: '.txt' },
      ];
      const result = groupFilesByExtension(files);
      expect(result.get('.md')).toBe(2);
      expect(result.get('.txt')).toBe(1);
    });

    it('should use "unknown" for files with empty extension', () => {
      const files = [{ extension: '' }];
      const result = groupFilesByExtension(files);
      expect(result.get('unknown')).toBe(1);
    });
  });
});
