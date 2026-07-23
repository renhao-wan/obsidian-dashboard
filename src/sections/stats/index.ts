import type { App } from 'obsidian';
import type { DashboardSettings } from '../../core/types';
import type { StatsSettings, OverviewStats } from './types';
import { StatsScanner } from './scanner';
import { StatsAnalyzer } from './analyzer';
import { StatsCache } from './cache';
import { renderOverview } from './views/overview';

export class StatsSection {
  private app: App;
  private settings: DashboardSettings;
  private statsSettings: StatsSettings;
  private scanner: StatsScanner;
  private analyzer: StatsAnalyzer;
  private cache: StatsCache;

  constructor(app: App, settings: DashboardSettings) {
    this.app = app;
    this.settings = settings;
    this.statsSettings = this.getDefaultStatsSettings();
    this.scanner = new StatsScanner(app, this.statsSettings);
    this.analyzer = new StatsAnalyzer();
    this.cache = new StatsCache();
  }

  private getDefaultStatsSettings(): StatsSettings {
    return {
      fileType: {
        enabled: true,
        extensions: ['.md', '.txt', '.org'],
        excludePatterns: ['node_modules', '.git', '.obsidian'],
      },
      stats: {
        fileCount: true,
        fileSize: true,
        timeline: true,
        contentAnalysis: true,
        heatmap: true,
      },
      performance: {
        useWebWorkers: true,
        cacheEnabled: true,
        cacheTTL: 5 * 60 * 1000, // 5 minutes
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

  private async getStats(): Promise<OverviewStats> {
    // Check cache first
    if (this.statsSettings.performance.cacheEnabled) {
      const cached = this.cache.get();
      if (cached) {
        return cached.data;
      }
    }

    // Scan files and analyze
    const files = await this.scanner.scan();
    const stats = this.analyzer.analyze(files);

    // Update cache
    if (this.statsSettings.performance.cacheEnabled) {
      this.cache.set(stats, '');
    }

    return stats;
  }
}

export function renderStatsSection(
  container: HTMLElement,
  app: App,
  settings: DashboardSettings
): void {
  const statsSection = new StatsSection(app, settings);
  statsSection.render(container);
}
