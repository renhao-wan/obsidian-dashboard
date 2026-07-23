import type { FileMetadata, OverviewStats, FileTypeStats, FolderStats } from './types';

export class StatsAnalyzer {
  analyze(files: FileMetadata[]): OverviewStats {
    const totalFiles = files.length;
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const todayCreated = this.countFilesCreatedToday(files);
    const weekCreated = this.countFilesCreatedThisWeek(files);
    const fileTypeStats = this.calculateFileTypeStats(files);
    const folderStats = this.calculateFolderStats(files);

    return {
      totalFiles,
      totalSize,
      todayCreated,
      weekCreated,
      fileTypeStats,
      folderStats,
    };
  }

  private countFilesCreatedToday(files: FileMetadata[]): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    return files.filter(f => f.created >= todayTimestamp).length;
  }

  private countFilesCreatedThisWeek(files: FileMetadata[]): number {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);
    const weekTimestamp = startOfWeek.getTime();

    return files.filter(f => f.created >= weekTimestamp).length;
  }

  private calculateFileTypeStats(files: FileMetadata[]): FileTypeStats[] {
    const statsMap = new Map<string, { count: number; totalSize: number }>();

    for (const file of files) {
      const ext = file.extension || 'unknown';
      const existing = statsMap.get(ext) || { count: 0, totalSize: 0 };
      statsMap.set(ext, {
        count: existing.count + 1,
        totalSize: existing.totalSize + file.size,
      });
    }

    return Array.from(statsMap.entries())
      .map(([ext, stats]) => ({
        extension: ext,
        count: stats.count,
        totalSize: stats.totalSize,
      }))
      .sort((a, b) => b.count - a.count);
  }

  private calculateFolderStats(files: FileMetadata[]): FolderStats[] {
    const statsMap = new Map<string, { count: number; totalSize: number }>();

    for (const file of files) {
      const folder = file.folder || '/';
      const existing = statsMap.get(folder) || { count: 0, totalSize: 0 };
      statsMap.set(folder, {
        count: existing.count + 1,
        totalSize: existing.totalSize + file.size,
      });
    }

    return Array.from(statsMap.entries())
      .map(([path, stats]) => ({
        path,
        count: stats.count,
        totalSize: stats.totalSize,
      }))
      .sort((a, b) => b.count - a.count);
  }
}
