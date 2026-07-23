import type { App } from 'obsidian';
import type { DashboardSettings, DashboardColumn, StatsSettings as CoreStatsSettings } from '../../core/types';
import type { StatsSettings, OverviewStats } from './types';
import { StatsScanner } from './scanner';
import { StatsAnalyzer } from './analyzer';
import { StatsCacheManager } from './cache';
import { renderOverview } from './views/overview';

export class StatsSection {
  private app: App;
  private settings: DashboardSettings;
  private statsSettings: StatsSettings;
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

  private buildStatsSettings(coreSettings: CoreStatsSettings): StatsSettings {
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
    const stats = await this.getStats();
    renderOverview(container, stats, this.statsSettings);
  }

  destroy(): void {
    this.cache.invalidate();
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
      const hash = `${stats.totalFiles}-${stats.totalSize}-${stats.todayCreated}`;
      this.cache.set(stats, hash);
    }

    return stats;
  }
}

export function renderStatsSection(
  el: HTMLElement,
  app: App,
  settings: DashboardSettings
): () => void {
  const statsSection = new StatsSection(app, settings);
  statsSection.render(el);
  return () => {
    statsSection.destroy();
  };
}
