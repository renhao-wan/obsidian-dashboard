import type { App } from 'obsidian';
import type { DashboardSettings, StatsSettings as CoreStatsSettings } from '../../core/types';
import type { StatsRuntimeConfig, OverviewStats, FileMetadata } from './types';
import { StatsScanner } from './scanner';
import { StatsAnalyzer } from './analyzer';
import { StatsCacheManager } from './cache';
import { renderOverview } from './views/overview';

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
        enabled: coreSettings.fileType.enabled,
        extensions: coreSettings.fileType.extensions,
        excludePatterns: coreSettings.fileType.excludePatterns,
      },
      stats: {
        fileCount: true,
        fileSize: true,
        timeline: true,
        contentAnalysis: true,
        heatmap: true,
      },
      performance: {
        useWebWorkers: coreSettings.performance.useWebWorkers,
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
    const { stats, files } = await this.getStatsWithFiles();
    renderOverview(container, stats, this.statsSettings, files);
  }

  destroy(): void {
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

  private async getStatsWithFiles(): Promise<{ stats: OverviewStats; files: FileMetadata[] }> {
    // Check cache first
    if (this.statsSettings.performance.cacheEnabled) {
      const cached = this.cache.get();
      if (cached) {
        return { stats: cached.data, files: this.scanner.scan() };
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

    return { stats, files };
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
