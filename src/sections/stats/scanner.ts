import type { App, TFile } from 'obsidian';
import type { StatsSettings, FileMetadata } from './types';
import { shouldIncludeFile, getFileExtension, getFileName, getFolder } from '../../utils/stats/file-utils';

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
      if (shouldIncludeFile(file.path, this.settings.fileType)) {
        const metadata = await this.getFileMetadata(file);
        files.push(metadata);
      }
    }

    return files;
  }

  private async getFileMetadata(file: TFile): Promise<FileMetadata> {
    const stat = await this.app.vault.adapter.stat(file.path);

    return {
      path: file.path,
      name: getFileName(file.path),
      extension: getFileExtension(file.path),
      size: stat?.size || 0,
      created: file.stat.ctime,
      modified: file.stat.mtime,
      folder: getFolder(file.path),
    };
  }

  async scanIncremental(
    lastScanTime: number
  ): Promise<{ created: FileMetadata[]; modified: FileMetadata[]; deleted: string[] }> {
    const created: FileMetadata[] = [];
    const modified: FileMetadata[] = [];
    const deleted: string[] = [];

    const allFiles = this.app.vault.getFiles();

    for (const file of allFiles) {
      if (!shouldIncludeFile(file.path, this.settings.fileType)) {
        continue;
      }

      const metadata = await this.getFileMetadata(file);

      if (file.stat.ctime > lastScanTime) {
        created.push(metadata);
      } else if (file.stat.mtime > lastScanTime) {
        modified.push(metadata);
      }
    }

    return { created, modified, deleted };
  }
}
