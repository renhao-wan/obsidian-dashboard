import type { FileMetadata, OverviewStats, FileTypeStats, FolderStats } from './types';
import { groupBy, sumBy, sortBy } from '../../utils/stats/math-utils';
import { isCreatedToday, isCreatedThisWeek } from '../../utils/stats/file-utils';

export class StatsAnalyzer {
  analyze(files: FileMetadata[]): OverviewStats {
    const totalFiles = files.length;
    const totalSize = sumBy(files, f => f.size);
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
    const grouped = groupBy(files, f => f.extension);

    const stats: FileTypeStats[] = Object.entries(grouped).map(([extension, files]) => ({
      extension,
      count: files.length,
      totalSize: sumBy(files, f => f.size),
    }));

    return sortBy(stats, s => s.count, true);
  }

  private calculateFolderStats(files: FileMetadata[]): FolderStats[] {
    const grouped = groupBy(files, f => f.folder);

    const stats: FolderStats[] = Object.entries(grouped).map(([path, files]) => ({
      path,
      count: files.length,
      totalSize: sumBy(files, f => f.size),
    }));

    return sortBy(stats, s => s.count, true);
  }
}
