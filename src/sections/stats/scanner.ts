import type { App, TFile } from 'obsidian';
import type { StatsRuntimeConfig, FileMetadata } from './types';
import { shouldIncludeFile, getFileExtension, getFileName, getFolder } from '../../utils/stats/file-utils';

export class StatsScanner {
  private app: App;
  private settings: StatsRuntimeConfig;

  constructor(app: App, settings: StatsRuntimeConfig) {
    this.app = app;
    this.settings = settings;
  }

  scan(): FileMetadata[] {
    const files: FileMetadata[] = [];
    const allFiles = this.app.vault.getFiles();

    for (const file of allFiles) {
      if (shouldIncludeFile(file.path, this.settings.fileType)) {
        files.push(this.getFileMetadata(file));
      }
    }

    return files;
  }

  private getFileMetadata(file: TFile): FileMetadata {
    return {
      path: file.path,
      name: getFileName(file.path),
      extension: getFileExtension(file.path),
      size: file.stat.size,
      created: file.stat.ctime,
      modified: file.stat.mtime,
      folder: getFolder(file.path),
    };
  }

  /**
   * Perform incremental scan to detect created, modified, and deleted files.
   * @param lastScanTime - Timestamp of the last scan
   * @param previousPaths - Set of file paths from the previous scan (used for deleted detection)
   */
  scanIncremental(
    lastScanTime: number,
    previousPaths?: Set<string>
  ): { created: FileMetadata[]; modified: FileMetadata[]; deleted: string[] } {
    const created: FileMetadata[] = [];
    const modified: FileMetadata[] = [];
    const currentPaths = new Set<string>();

    const allFiles = this.app.vault.getFiles();

    for (const file of allFiles) {
      if (!shouldIncludeFile(file.path, this.settings.fileType)) {
        continue;
      }

      currentPaths.add(file.path);
      const metadata = this.getFileMetadata(file);

      if (file.stat.ctime > lastScanTime) {
        created.push(metadata);
      } else if (file.stat.mtime > lastScanTime) {
        modified.push(metadata);
      }
    }

    // Detect deleted files by comparing with previous paths
    const deleted: string[] = [];
    if (previousPaths) {
      for (const path of previousPaths) {
        if (!currentPaths.has(path)) {
          deleted.push(path);
        }
      }
    }

    return { created, modified, deleted };
  }
}
