import type { FileMetadata, OverviewStats, FileTypeStats, FolderStats, SizeDistribution, DepthDistribution } from './types';
import { groupBy, sumBy, sortBy } from '../../utils/stats/math-utils';
import { isCreatedToday, isCreatedThisWeek } from '../../utils/stats/file-utils';
import { extractTags, extractKeywords, calculateContentStats, calculateWordLengthDistribution } from '../../components/stats/content-analysis';
import type { TagData, KeywordData, ContentStats, WordLengthDistribution } from '../../components/stats/content-analysis';

export class StatsAnalyzer {
  analyze(files: FileMetadata[]): OverviewStats {
    const totalFiles = files.length;
    const totalSize = sumBy(files, f => f.size);
    const todayCreated = files.filter(f => isCreatedToday(f.created)).length;
    const weekCreated = files.filter(f => isCreatedThisWeek(f.created)).length;

    const fileTypeStats = this.calculateFileTypeStats(files);
    const folderStats = this.calculateFolderStats(files);
    const sizeDistribution = this.calculateSizeDistribution(files);
    const depthDistribution = this.calculateDepthDistribution(files);

    return {
      totalFiles,
      totalSize,
      todayCreated,
      weekCreated,
      fileTypeStats,
      folderStats,
      sizeDistribution,
      depthDistribution,
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

  private calculateSizeDistribution(files: FileMetadata[]): SizeDistribution[] {
    const ranges = [
      { range: '< 1 KB', min: 0, max: 1024 },
      { range: '1 - 10 KB', min: 1024, max: 10240 },
      { range: '10 - 100 KB', min: 10240, max: 102400 },
      { range: '100 KB - 1 MB', min: 102400, max: 1048576 },
      { range: '> 1 MB', min: 1048576, max: Infinity },
    ];

    const total = files.length;
    return ranges.map(({ range, min, max }) => {
      const count = files.filter(f => f.size >= min && f.size < max).length;
      return {
        range,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      };
    });
  }

  private calculateDepthDistribution(files: FileMetadata[]): DepthDistribution[] {
    const depthMap = new Map<number, number>();

    for (const file of files) {
      const depth = file.folder ? file.folder.split('/').length : 0;
      // Group depths >= 4 into "4+"
      const key = depth >= 4 ? 4 : depth;
      depthMap.set(key, (depthMap.get(key) || 0) + 1);
    }

    const total = files.length;
    const result: DepthDistribution[] = [];

    for (const [depth, count] of depthMap.entries()) {
      result.push({
        depth,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      });
    }

    return result.sort((a, b) => a.depth - b.depth);
  }

  /**
   * Extract tags from files
   */
  analyzeTags(files: Array<{ content: string }>): TagData[] {
    const tagCounts = new Map<string, number>();

    for (const file of files) {
      const tags = extractTags(file.content);
      for (const tag of tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Extract keywords from files
   */
  analyzeKeywords(files: Array<{ content: string }>, maxKeywords: number = 50): KeywordData[] {
    const allContent = files.map(f => f.content).join(' ');
    return extractKeywords(allContent, maxKeywords);
  }

  /**
   * Calculate content statistics
   */
  analyzeContentStats(files: Array<{ path: string; content: string }>): ContentStats {
    return calculateContentStats(files);
  }

  /**
   * Calculate word length distribution
   */
  analyzeWordLengthDistribution(files: Array<{ content: string }>): WordLengthDistribution[] {
    return calculateWordLengthDistribution(files);
  }
}
