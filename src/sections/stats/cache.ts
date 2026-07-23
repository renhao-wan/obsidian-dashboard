import type { OverviewStats, CachedStatsData } from './types';

export class StatsCache {
  private cache: CachedStatsData | null = null;
  private ttl: number = 5 * 60 * 1000; // 5 minutes default

  get(): CachedStatsData | null {
    if (!this.cache) {
      return null;
    }

    // Check if cache is expired
    const now = Date.now();
    if (now - this.cache.timestamp > this.ttl) {
      this.cache = null;
      return null;
    }

    return this.cache;
  }

  set(data: OverviewStats, fileHash: string): void {
    this.cache = {
      data,
      timestamp: Date.now(),
      fileHash,
    };
  }

  invalidate(): void {
    this.cache = null;
  }

  setTTL(ttl: number): void {
    this.ttl = ttl;
  }
}
