import type { App } from 'obsidian';
import type { StatsSettings, FileMetadata } from './types';

export class StatsScanner {
  private app: App;
  private settings: StatsSettings;

  constructor(app: App, settings: StatsSettings) {
    this.app = app;
    this.settings = settings;
  }

  async scan(): Promise<FileMetadata[]> {
    const files: FileMetadata[] = [];
    const allFiles = this.app.vault.getFiles();

    for (const file of allFiles) {
      if (this.shouldIncludeFile(file.path)) {
        files.push({
          path: file.path,
          name: file.name,
          extension: file.extension,
          size: file.stat.size,
          created: file.stat.ctime,
          modified: file.stat.mtime,
          folder: file.parent?.path ?? '',
        });
      }
    }

    return files;
  }

  private shouldIncludeFile(path: string): boolean {
    // Check exclude patterns
    for (const pattern of this.settings.fileType.excludePatterns) {
      if (path.includes(pattern)) {
        return false;
      }
    }

    // Check file extensions
    if (this.settings.fileType.enabled) {
      const ext = '.' + path.split('.').pop()?.toLowerCase();
      return this.settings.fileType.extensions.includes(ext);
    }

    return true;
  }
}
