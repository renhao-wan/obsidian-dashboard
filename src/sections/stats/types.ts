export interface FileTypeConfig {
  extensions: string[];
}

export interface StatsConfig {
  fileCount: boolean;
  fileSize: boolean;
  timeline: boolean;
  contentAnalysis: boolean;
  heatmap: boolean;
}

export interface PerformanceConfig {
  cacheEnabled: boolean;
  cacheTTL: number;
  maxConcurrentScans: number;
}

export interface UIConfig {
  defaultView: 'overview' | 'timeline' | 'content' | 'heatmap';
  theme: 'auto' | 'light' | 'dark';
  chartLibrary: 'custom' | 'chartjs';
}

/**
 * Runtime configuration for the stats module.
 * This is derived from the core DashboardSettings.stats but includes additional runtime fields.
 */
export interface StatsRuntimeConfig {
  fileType: FileTypeConfig;
  stats: StatsConfig;
  performance: PerformanceConfig;
  ui: UIConfig;
}

/** @deprecated Use StatsRuntimeConfig instead */
export type StatsSettings = StatsRuntimeConfig;

export interface FileMetadata {
  path: string;
  name: string;
  extension: string;
  size: number;
  created: number;
  modified: number;
  folder: string;
}

export interface FileTypeStats {
  extension: string;
  count: number;
  totalSize: number;
}

export interface FolderStats {
  path: string;
  count: number;
  totalSize: number;
}

export interface SizeDistribution {
  range: string;
  count: number;
  percentage: number;
}

export interface DepthDistribution {
  depth: number;
  count: number;
  percentage: number;
}

export interface OverviewStats {
  totalFiles: number;
  totalSize: number;
  todayCreated: number;
  weekCreated: number;
  fileTypeStats: FileTypeStats[];
  folderStats: FolderStats[];
  sizeDistribution: SizeDistribution[];
  depthDistribution: DepthDistribution[];
}

export interface CachedStatsData {
  data: OverviewStats;
  timestamp: number;
  fileHash: string;
}
