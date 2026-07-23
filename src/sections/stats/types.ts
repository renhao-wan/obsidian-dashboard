export interface FileTypeConfig {
  enabled: boolean;
  extensions: string[];
  excludePatterns: string[];
}

export interface StatsConfig {
  fileCount: boolean;
  fileSize: boolean;
  timeline: boolean;
  contentAnalysis: boolean;
  heatmap: boolean;
}

export interface PerformanceConfig {
  useWebWorkers: boolean;
  cacheEnabled: boolean;
  cacheTTL: number;
  maxConcurrentScans: number;
}

export interface UIConfig {
  defaultView: 'overview' | 'timeline' | 'content' | 'heatmap';
  theme: 'auto' | 'light' | 'dark';
  chartLibrary: 'custom' | 'chartjs';
}

export interface StatsSettings {
  fileType: FileTypeConfig;
  stats: StatsConfig;
  performance: PerformanceConfig;
  ui: UIConfig;
}

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

export interface OverviewStats {
  totalFiles: number;
  totalSize: number;
  todayCreated: number;
  weekCreated: number;
  fileTypeStats: FileTypeStats[];
  folderStats: FolderStats[];
}

export interface CachedStatsData {
  data: OverviewStats;
  timestamp: number;
  fileHash: string;
}
