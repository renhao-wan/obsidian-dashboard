import type { FileMetadata, OverviewStats, FileTypeStats, FolderStats } from './types';
import { isCreatedToday, isCreatedThisWeek } from '../../utils/stats/file-utils';

export class StatsAnalyzer {
  analyze(files: FileMetadata[]): OverviewStats {
    const totalFiles = files.length;
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const todayCreated = files.filter(f => isCreatedToday(f.created)).length;
    const weekCreated = files.filter(f => isCreatedThisWeek(f.created)).length;
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
