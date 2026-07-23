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

  scanIncremental(
    lastScanTime: number
  ): { created: FileMetadata[]; modified: FileMetadata[]; deleted: string[] } {
    const created: FileMetadata[] = [];
    const modified: FileMetadata[] = [];
    // TODO: deleted 检测尚未实现——需要将上次扫描结果与当前文件列表进行比对
    const deleted: string[] = [];

    const allFiles = this.app.vault.getFiles();

    for (const file of allFiles) {
      if (!shouldIncludeFile(file.path, this.settings.fileType)) {
        continue;
      }

      const metadata = this.getFileMetadata(file);

      if (file.stat.ctime > lastScanTime) {
        created.push(metadata);
      } else if (file.stat.mtime > lastScanTime) {
        modified.push(metadata);
      }
    }

    return { created, modified, deleted };
  }
}
