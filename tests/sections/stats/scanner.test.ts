import { StatsScanner } from '../../../src/sections/stats/scanner';
import type { StatsSettings } from '../../../src/sections/stats/types';

// Mock Obsidian TFile
function createMockFile(path: string, size: number, ctime: number, mtime?: number) {
  return {
    path,
    stat: {
      size,
      ctime,
      mtime: mtime ?? ctime,
    },
  };
}

describe('StatsScanner', () => {
  const defaultSettings: StatsSettings = {
    fileType: {
      enabled: true,
      extensions: ['.md'],
      excludePatterns: [],
    },
    stats: {
      fileCount: true,
      fileSize: true,
      timeline: true,
      contentAnalysis: false,
      heatmap: false,
    },
    performance: {
      useWebWorkers: false,
      cacheEnabled: false,
      cacheTTL: 60,
      maxConcurrentScans: 1,
    },
    ui: {
      defaultView: 'overview',
      theme: 'auto',
      chartLibrary: 'chartjs',
    },
  };

  function createMockApp(files: ReturnType<typeof createMockFile>[]) {
    return {
      vault: {
        getFiles: () => files,
      },
    };
  }

  describe('scan', () => {
    it('should scan files matching the extension filter', () => {
      const files = [
        createMockFile('test.md', 1024, Date.now()),
        createMockFile('notes.md', 2048, Date.now()),
      ];
      const app = createMockApp(files);
      const scanner = new StatsScanner(app as any, defaultSettings);

      const result = scanner.scan();
      expect(result).toHaveLength(2);
      expect(result[0].path).toBe('test.md');
      expect(result[0].name).toBe('test.md');
      expect(result[0].size).toBe(1024);
      expect(result[1].path).toBe('notes.md');
    });

    it('should filter out files with non-matching extensions', () => {
      const files = [
        createMockFile('test.md', 1024, Date.now()),
        createMockFile('image.png', 512, Date.now()),
        createMockFile('data.json', 256, Date.now()),
      ];
      const app = createMockApp(files);
      const scanner = new StatsScanner(app as any, defaultSettings);

      const result = scanner.scan();
      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('test.md');
    });

    it('should return empty array when no files match', () => {
      const files = [
        createMockFile('image.png', 512, Date.now()),
        createMockFile('data.json', 256, Date.now()),
      ];
      const app = createMockApp(files);
      const scanner = new StatsScanner(app as any, defaultSettings);

      const result = scanner.scan();
      expect(result).toHaveLength(0);
    });

    it('should return empty array when vault has no files', () => {
      const app = createMockApp([]);
      const scanner = new StatsScanner(app as any, defaultSettings);

      const result = scanner.scan();
      expect(result).toHaveLength(0);
    });

    it('should correctly populate all metadata fields', () => {
      const now = Date.now();
      const files = [
        createMockFile('folder/note.md', 1024, now, now + 1000),
      ];
      const app = createMockApp(files);
      const scanner = new StatsScanner(app as any, defaultSettings);

      const result = scanner.scan();
      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('folder/note.md');
      expect(result[0].name).toBe('note.md');
      expect(result[0].extension).toBe('.md');
      expect(result[0].size).toBe(1024);
      expect(result[0].created).toBe(now);
      expect(result[0].modified).toBe(now + 1000);
      expect(result[0].folder).toBe('folder');
    });

    it('should handle multiple extensions in config', () => {
      const settings: StatsSettings = {
        ...defaultSettings,
        fileType: {
          ...defaultSettings.fileType,
          extensions: ['.md', '.txt'],
        },
      };
      const files = [
        createMockFile('note.md', 1024, Date.now()),
        createMockFile('readme.txt', 512, Date.now()),
        createMockFile('image.png', 256, Date.now()),
      ];
      const app = createMockApp(files);
      const scanner = new StatsScanner(app as any, settings);

      const result = scanner.scan();
      expect(result).toHaveLength(2);
      expect(result[0].path).toBe('note.md');
      expect(result[1].path).toBe('readme.txt');
    });
  });

  describe('scanIncremental', () => {
    it('should detect created files after lastScanTime', () => {
      const now = Date.now();
      const files = [
        createMockFile('old.md', 1024, now - 10000, now - 5000),
        createMockFile('new.md', 512, now, now),
      ];
      const app = createMockApp(files);
      const scanner = new StatsScanner(app as any, defaultSettings);

      const result = scanner.scanIncremental(now - 8000);
      expect(result.created).toHaveLength(1);
      expect(result.created[0].path).toBe('new.md');
    });

    it('should detect modified files after lastScanTime', () => {
      const now = Date.now();
      const files = [
        createMockFile('modified.md', 1024, now - 20000, now), // modified recently
        createMockFile('stale.md', 512, now - 20000, now - 15000), // not modified recently
      ];
      const app = createMockApp(files);
      const scanner = new StatsScanner(app as any, defaultSettings);

      const result = scanner.scanIncremental(now - 8000);
      expect(result.modified).toHaveLength(1);
      expect(result.modified[0].path).toBe('modified.md');
    });

    it('should exclude files not matching extension filter', () => {
      const now = Date.now();
      const files = [
        createMockFile('new.md', 1024, now, now),
        createMockFile('new.png', 512, now, now),
      ];
      const app = createMockApp(files);
      const scanner = new StatsScanner(app as any, defaultSettings);

      const result = scanner.scanIncremental(now - 1000);
      expect(result.created).toHaveLength(1);
      expect(result.created[0].path).toBe('new.md');
    });

    it('should return empty arrays when no changes', () => {
      const now = Date.now();
      const files = [
        createMockFile('old.md', 1024, now - 10000, now - 5000),
      ];
      const app = createMockApp(files);
      const scanner = new StatsScanner(app as any, defaultSettings);

      const result = scanner.scanIncremental(now);
      expect(result.created).toHaveLength(0);
      expect(result.modified).toHaveLength(0);
      expect(result.deleted).toHaveLength(0);
    });
  });
});
