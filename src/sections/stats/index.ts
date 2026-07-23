import type { App } from 'obsidian';
import { TFile } from 'obsidian';
import type { DashboardSettings, StatsSettings as CoreStatsSettings } from '../../core/types';
import type { StatsRuntimeConfig, OverviewStats, FileMetadata } from './types';
import { StatsScanner } from './scanner';
import { StatsAnalyzer } from './analyzer';
import { StatsCacheManager } from './cache';
import { renderOverview } from './views/overview';
import type { TagData, KeywordData, ContentStats, WordLengthDistribution } from '../../components/stats/content-analysis';

export class StatsSection {
  private app: App;
  private settings: DashboardSettings;
  private statsSettings: StatsRuntimeConfig;
  private scanner: StatsScanner;
  private analyzer: StatsAnalyzer;
  private cache: StatsCacheManager;

  constructor(app: App, settings: DashboardSettings) {
    this.app = app;
    this.settings = settings;
    this.statsSettings = this.buildStatsSettings(settings.stats);
    this.scanner = new StatsScanner(app, this.statsSettings);
    this.analyzer = new StatsAnalyzer();
    this.cache = new StatsCacheManager(settings.stats.performance.cacheTTL);
  }

  private buildStatsSettings(coreSettings: CoreStatsSettings): StatsRuntimeConfig {
    return {
      fileType: {
        extensions: coreSettings.fileType.extensions,
      },
      stats: {
        fileCount: true,
        fileSize: true,
        timeline: true,
        contentAnalysis: true,
        heatmap: true,
      },
      performance: {
        cacheEnabled: coreSettings.performance.cacheEnabled,
        cacheTTL: coreSettings.performance.cacheTTL,
        maxConcurrentScans: 4,
      },
      ui: {
        defaultView: 'overview',
        theme: 'auto',
        chartLibrary: 'custom',
      },
    };
  }

  async render(container: HTMLElement): Promise<void> {
    const { stats, files, contentData } = await this.getStatsWithFiles();

    // Analyze content data
    const tags = this.analyzer.analyzeTags(contentData);
    const keywords = this.analyzer.analyzeKeywords(contentData);
    const contentStats = this.analyzer.analyzeContentStats(contentData);
    const wordDistribution = this.analyzer.analyzeWordLengthDistribution(contentData);

    renderOverview(container, stats, this.statsSettings, files, {
      tags,
      keywords,
      contentStats,
      wordDistribution,
    });
  }

  destroy(): void {
    this.cache.invalidate();
  }

  /**
   * Invalidate cache when files change
   */
  invalidateCache(): void {
    this.cache.invalidate();
  }

  /**
   * Calculate a hash based on stats data for cache invalidation.
   * Includes multiple fields to detect various types of changes.
   */
  private calculateStatsHash(stats: OverviewStats): string {
    const parts = [
      stats.totalFiles,
      stats.totalSize,
      stats.todayCreated,
      stats.weekCreated,
      stats.fileTypeStats.length,
      stats.folderStats.length,
    ];
    return parts.join('-');
  }

  private async getStats(): Promise<OverviewStats> {
    // Check cache first
    if (this.statsSettings.performance.cacheEnabled) {
      const cached = this.cache.get();
      if (cached) {
        return cached.data;
      }
    }

    // Scan files and analyze
    const files = this.scanner.scan();
    const stats = this.analyzer.analyze(files);

    // Update cache with a hash based on stats data
    if (this.statsSettings.performance.cacheEnabled) {
      const hash = this.calculateStatsHash(stats);
      this.cache.set(stats, hash);
    }

    return stats;
  }

  private async getStatsWithFiles(): Promise<{
    stats: OverviewStats;
    files: FileMetadata[];
    contentData: Array<{ path: string; content: string }>;
  }> {
    // Scan files first (always needed for rendering)
    const files = this.scanner.scan();

    // Check cache for stats
    if (this.statsSettings.performance.cacheEnabled) {
      const cached = this.cache.get();
      if (cached) {
        // Cache hit - only load file contents for content analysis
        const contentData = await this.loadFileContents(files);
        return { stats: cached.data, files, contentData };
      }
    }

    // Cache miss - analyze and cache
    const stats = this.analyzer.analyze(files);
    const contentData = await this.loadFileContents(files);

    // Update cache
    if (this.statsSettings.performance.cacheEnabled) {
      const hash = this.calculateStatsHash(stats);
      this.cache.set(stats, hash);
    }

    return { stats, files, contentData };
  }

  /**
   * Load file contents for content analysis
   */
  private async loadFileContents(files: FileMetadata[]): Promise<Array<{ path: string; content: string }>> {
    const contentData: Array<{ path: string; content: string }> = [];
    const maxFiles = 1000; // Limit to prevent performance issues

    for (let i = 0; i < Math.min(files.length, maxFiles); i++) {
      const file = files[i];
      if (!file) continue;

      try {
        const tFile = this.app.vault.getAbstractFileByPath(file.path);
        if (tFile instanceof TFile) {
          const content = await this.app.vault.read(tFile);
          contentData.push({ path: file.path, content });
        }
      } catch (error) {
        // Skip files that can't be read
        console.warn(`Failed to read file ${file.path}:`, error);
      }
    }

    return contentData;
  }
}

export function renderStatsSection(
  el: HTMLElement,
  app: App,
  settings: DashboardSettings
): () => void {
  const statsSection = new StatsSection(app, settings);
  void statsSection.render(el);
  return () => {
    statsSection.destroy();
  };
}
