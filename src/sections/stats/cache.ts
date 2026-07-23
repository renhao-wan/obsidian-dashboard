import type { OverviewStats, CachedStatsData } from './types';

export class StatsCacheManager {
  private cache: CachedStatsData | null = null;
  private ttl: number;

  constructor(ttl: number = 5 * 60 * 1000) {
    this.ttl = ttl;
  }

  get(): CachedStatsData | null {
    if (!this.cache) {
      return null;
    }

    // Check if cache is expired
    if (Date.now() - this.cache.timestamp > this.ttl) {
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

  isValid(fileHash: string): boolean {
    if (!this.cache) {
      return false;
    }

    // Check if cache is expired
    if (Date.now() - this.cache.timestamp > this.ttl) {
      return false;
    }

    // Check if file hash matches
    if (this.cache.fileHash !== fileHash) {
      return false;
    }

    return true;
  }
}
