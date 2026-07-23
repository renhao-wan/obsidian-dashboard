import { StatsAnalyzer } from '../../../src/sections/stats/analyzer';
import type { FileMetadata } from '../../../src/sections/stats/types';

describe('StatsAnalyzer', () => {
  let analyzer: StatsAnalyzer;

  beforeEach(() => {
    analyzer = new StatsAnalyzer();
  });

  describe('analyze', () => {
    it('should calculate total files and total size', () => {
      const files: FileMetadata[] = [
        {
          path: 'test1.md',
          name: 'test1.md',
          extension: '.md',
          size: 1024,
          created: Date.now(),
          modified: Date.now(),
          folder: '',
        },
        {
          path: 'test2.md',
          name: 'test2.md',
          extension: '.md',
          size: 2048,
          created: Date.now(),
          modified: Date.now(),
          folder: 'subfolder',
        },
      ];

      const result = analyzer.analyze(files);
      expect(result.totalFiles).toBe(2);
      expect(result.totalSize).toBe(3072);
    });

    it('should calculate file type stats', () => {
      const now = Date.now();
      const files: FileMetadata[] = [
        {
          path: 'a.md',
          name: 'a.md',
          extension: '.md',
          size: 100,
          created: now,
          modified: now,
          folder: '',
        },
        {
          path: 'b.md',
          name: 'b.md',
          extension: '.md',
          size: 200,
          created: now,
          modified: now,
          folder: '',
        },
        {
          path: 'c.txt',
          name: 'c.txt',
          extension: '.txt',
          size: 300,
          created: now,
          modified: now,
          folder: '',
        },
      ];

      const result = analyzer.analyze(files);
      expect(result.fileTypeStats).toHaveLength(2);

      // Sorted by count descending, .md has 2 files, .txt has 1
      expect(result.fileTypeStats[0].extension).toBe('.md');
      expect(result.fileTypeStats[0].count).toBe(2);
      expect(result.fileTypeStats[0].totalSize).toBe(300);

      expect(result.fileTypeStats[1].extension).toBe('.txt');
      expect(result.fileTypeStats[1].count).toBe(1);
      expect(result.fileTypeStats[1].totalSize).toBe(300);
    });

    it('should calculate folder stats', () => {
      const now = Date.now();
      const files: FileMetadata[] = [
        {
          path: 'folder1/a.md',
          name: 'a.md',
          extension: '.md',
          size: 100,
          created: now,
          modified: now,
          folder: 'folder1',
        },
        {
          path: 'folder1/b.md',
          name: 'b.md',
          extension: '.md',
          size: 200,
          created: now,
          modified: now,
          folder: 'folder1',
        },
        {
          path: 'folder2/c.md',
          name: 'c.md',
          extension: '.md',
          size: 300,
          created: now,
          modified: now,
          folder: 'folder2',
        },
      ];

      const result = analyzer.analyze(files);
      expect(result.folderStats).toHaveLength(2);

      // Sorted by count descending, folder1 has 2 files, folder2 has 1
      expect(result.folderStats[0].path).toBe('folder1');
      expect(result.folderStats[0].count).toBe(2);
      expect(result.folderStats[0].totalSize).toBe(300);

      expect(result.folderStats[1].path).toBe('folder2');
      expect(result.folderStats[1].count).toBe(1);
      expect(result.folderStats[1].totalSize).toBe(300);
    });

    it('should count files created today', () => {
      const now = Date.now();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const files: FileMetadata[] = [
        {
          path: 'today.md',
          name: 'today.md',
          extension: '.md',
          size: 100,
          created: now,
          modified: now,
          folder: '',
        },
        {
          path: 'old.md',
          name: 'old.md',
          extension: '.md',
          size: 100,
          created: todayStart.getTime() - 86400000, // yesterday
          modified: now,
          folder: '',
        },
      ];

      const result = analyzer.analyze(files);
      expect(result.todayCreated).toBe(1);
    });

    it('should count files created this week', () => {
      const now = Date.now();
      const startOfThisWeek = new Date();
      const dayOfWeek = startOfThisWeek.getDay();
      startOfThisWeek.setDate(startOfThisWeek.getDate() - dayOfWeek);
      startOfThisWeek.setHours(0, 0, 0, 0);

      const files: FileMetadata[] = [
        {
          path: 'this-week.md',
          name: 'this-week.md',
          extension: '.md',
          size: 100,
          created: now,
          modified: now,
          folder: '',
        },
        {
          path: 'old.md',
          name: 'old.md',
          extension: '.md',
          size: 100,
          created: startOfThisWeek.getTime() - 86400000 * 8, // over a week ago
          modified: now,
          folder: '',
        },
      ];

      const result = analyzer.analyze(files);
      expect(result.weekCreated).toBeGreaterThanOrEqual(1);
    });

    it('should handle empty file list', () => {
      const result = analyzer.analyze([]);
      expect(result.totalFiles).toBe(0);
      expect(result.totalSize).toBe(0);
      expect(result.todayCreated).toBe(0);
      expect(result.weekCreated).toBe(0);
      expect(result.fileTypeStats).toHaveLength(0);
      expect(result.folderStats).toHaveLength(0);
    });
  });
});
