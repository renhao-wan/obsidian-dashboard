# 笔记统计功能 - 阶段一：基础统计功能 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现基础的文件数量和大小统计功能，包括概览卡片、文件类型分布和文件夹分布。

**Architecture:** 采用混合架构，核心统计功能独立开发，UI 部分复用现有架构。使用模块化设计，将功能拆分为 scanner、analyzer、cache、views 等模块。

**Tech Stack:** TypeScript, Obsidian API, Chart.js (for charts), CSS

---

## 文件结构

### 新建文件

1. **`src/sections/stats/index.ts`** - 入口文件，导出渲染函数
2. **`src/sections/stats/types.ts`** - 类型定义
3. **`src/sections/stats/scanner.ts`** - 文件系统扫描器
4. **`src/sections/stats/analyzer.ts`** - 数据分析器
5. **`src/sections/stats/cache.ts`** - 缓存管理
6. **`src/sections/stats/views/overview.ts`** - 概览视图
7. **`src/components/stats/charts.ts`** - 自定义图表组件
8. **`src/utils/stats/file-utils.ts`** - 文件处理工具
9. **`src/utils/stats/math-utils.ts`** - 数学计算工具

### 修改文件

1. **`src/core/types.ts`** - 添加统计功能相关的类型定义
2. **`src/core/settings.ts`** - 添加统计功能的配置选项
3. **`src/renderers/dashboard.ts`** - 集成统计功能的渲染
4. **`src/core/view.ts`** - 集成统计功能的视图
5. **`src/utils/i18n/en.ts`** - 添加英文翻译
6. **`src/utils/i18n/zh.ts`** - 添加中文翻译

---

## 任务清单

### Task 1: 创建项目结构和基础文件

**Files:**
- Create: `src/sections/stats/index.ts`
- Create: `src/sections/stats/types.ts`
- Create: `src/sections/stats/scanner.ts`
- Create: `src/sections/stats/analyzer.ts`
- Create: `src/sections/stats/cache.ts`
- Create: `src/sections/stats/views/overview.ts`
- Create: `src/components/stats/charts.ts`
- Create: `src/utils/stats/file-utils.ts`
- Create: `src/utils/stats/math-utils.ts`

- [ ] **Step 1: 创建目录结构**

```bash
mkdir -p src/sections/stats/views
mkdir -p src/components/stats
mkdir -p src/utils/stats
```

- [ ] **Step 2: 创建类型定义文件**

```typescript
// src/sections/stats/types.ts
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

export interface StatsCache {
  data: OverviewStats;
  timestamp: number;
  fileHash: string;
}
```

- [ ] **Step 3: 创建入口文件**

```typescript
// src/sections/stats/index.ts
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
```

- [ ] **Step 4: 提交代码**

```bash
git add src/sections/stats/
git commit -m "feat(stats): 创建笔记统计功能的基础项目结构"
```

### Task 2: 实现 Scanner 模块

**Files:**
- Create: `src/sections/stats/scanner.ts`
- Create: `src/utils/stats/file-utils.ts`

- [ ] **Step 1: 创建文件处理工具**

```typescript
// src/utils/stats/file-utils.ts
import type { FileTypeConfig } from '../sections/stats/types';

export function shouldIncludeFile(
  filePath: string,
  config: FileTypeConfig
): boolean {
  // Check if file extension is enabled
  const extension = getFileExtension(filePath);
  if (!config.extensions.includes(extension)) {
    return false;
  }

  // Check if file matches exclude patterns
  for (const pattern of config.excludePatterns) {
    if (filePath.includes(pattern)) {
      return false;
    }
  }

  return true;
}

export function getFileExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.');
  if (lastDot === -1) {
    return '';
  }
  return filePath.slice(lastDot).toLowerCase();
}

export function getFileName(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1];
}

export function getFolder(filePath: string): string {
  const parts = filePath.split('/');
  if (parts.length <= 1) {
    return '';
  }
  return parts.slice(0, -1).join('/');
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
```

- [ ] **Step 2: 实现 Scanner 模块**

```typescript
// src/sections/stats/scanner.ts
import type { App, TFile } from 'obsidian';
import type { StatsSettings, FileMetadata } from './types';
import { shouldIncludeFile, getFileExtension, getFileName, getFolder } from '../../utils/stats/file-utils';

export class StatsScanner {
  private app: App;
  private settings: StatsSettings;

  constructor(app: App, settings: StatsSettings) {
    this.app = app;
    this.settings = settings;
  }

  async scan(): Promise<FileMetadata[]> {
    const files: FileMetadata[] = [];
    const allFiles = this.app.vault.getFiles();

    for (const file of allFiles) {
      if (shouldIncludeFile(file.path, this.settings.fileType)) {
        const metadata = await this.getFileMetadata(file);
        files.push(metadata);
      }
    }

    return files;
  }

  private async getFileMetadata(file: TFile): Promise<FileMetadata> {
    const stat = await this.app.vault.adapter.stat(file.path);
    
    return {
      path: file.path,
      name: getFileName(file.path),
      extension: getFileExtension(file.path),
      size: stat?.size || 0,
      created: file.stat.ctime,
      modified: file.stat.mtime,
      folder: getFolder(file.path),
    };
  }

  async scanIncremental(
    lastScanTime: number
  ): Promise<{ created: FileMetadata[]; modified: FileMetadata[]; deleted: string[] }> {
    const created: FileMetadata[] = [];
    const modified: FileMetadata[] = [];
    const deleted: string[] = [];

    const allFiles = this.app.vault.getFiles();

    for (const file of allFiles) {
      if (!shouldIncludeFile(file.path, this.settings.fileType)) {
        continue;
      }

      const metadata = await this.getFileMetadata(file);
      
      if (file.stat.ctime > lastScanTime) {
        created.push(metadata);
      } else if (file.stat.mtime > lastScanTime) {
        modified.push(metadata);
      }
    }

    return { created, modified, deleted };
  }
}
```

- [ ] **Step 3: 提交代码**

```bash
git add src/utils/stats/file-utils.ts src/sections/stats/scanner.ts
git commit -m "feat(stats): 实现文件系统扫描器和文件处理工具"
```

### Task 3: 实现 Analyzer 模块

**Files:**
- Create: `src/sections/stats/analyzer.ts`
- Create: `src/utils/stats/math-utils.ts`

- [ ] **Step 1: 创建数学计算工具**

```typescript
// src/utils/stats/math-utils.ts
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

export function groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const key = keyFn(item);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

export function sumBy<T>(array: T[], valueFn: (item: T) => number): number {
  return array.reduce((sum, item) => sum + valueFn(item), 0);
}

export function sortBy<T>(array: T[], keyFn: (item: T) => number, desc = false): T[] {
  return [...array].sort((a, b) => {
    const aVal = keyFn(a);
    const bVal = keyFn(b);
    return desc ? bVal - aVal : aVal - bVal;
  });
}

export function isToday(timestamp: number): boolean {
  const today = new Date();
  const date = new Date(timestamp);
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export function isThisWeek(timestamp: number): boolean {
  const now = new Date();
  const date = new Date(timestamp);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  
  return date >= startOfWeek;
}
```

- [ ] **Step 2: 实现 Analyzer 模块**

```typescript
// src/sections/stats/analyzer.ts
import type { FileMetadata, OverviewStats, FileTypeStats, FolderStats } from './types';
import { groupBy, sumBy, sortBy, isToday, isThisWeek } from '../../utils/stats/math-utils';

export class StatsAnalyzer {
  analyze(files: FileMetadata[]): OverviewStats {
    const totalFiles = files.length;
    const totalSize = sumBy(files, f => f.size);
    const todayCreated = files.filter(f => isToday(f.created)).length;
    const weekCreated = files.filter(f => isThisWeek(f.created)).length;

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
```

- [ ] **Step 3: 提交代码**

```bash
git add src/utils/stats/math-utils.ts src/sections/stats/analyzer.ts
git commit -m "feat(stats): 实现数据分析器和数学计算工具"
```

### Task 4: 实现 Cache 模块

**Files:**
- Create: `src/sections/stats/cache.ts`

- [ ] **Step 1: 实现 Cache 模块**

```typescript
// src/sections/stats/cache.ts
import type { OverviewStats, StatsCache } from './types';

export class StatsCacheManager {
  private cache: StatsCache | null = null;
  private ttl: number;

  constructor(ttl: number = 5 * 60 * 1000) {
    this.ttl = ttl;
  }

  get(): StatsCache | null {
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
```

- [ ] **Step 2: 提交代码**

```bash
git add src/sections/stats/cache.ts
git commit -m "feat(stats): 实现缓存管理模块"
```

### Task 5: 实现基础图表组件

**Files:**
- Create: `src/components/stats/charts.ts`

- [ ] **Step 1: 实现基础图表组件**

```typescript
// src/components/stats/charts.ts
import type { FileTypeStats, FolderStats } from '../../sections/stats/types';
import { formatFileSize } from '../../utils/stats/file-utils';
import { calculatePercentage } from '../../utils/stats/math-utils';

export function renderPieChart(
  container: HTMLElement,
  data: FileTypeStats[],
  title: string
): void {
  const wrapper = container.createDiv({ cls: 'stats-chart-wrapper' });
  wrapper.createEl('h3', { text: title, cls: 'stats-chart-title' });

  const chartContainer = wrapper.createDiv({ cls: 'stats-pie-chart' });
  const total = data.reduce((sum, item) => sum + item.count, 0);

  // Create simple pie chart using CSS
  let cumulativePercentage = 0;
  const gradientParts: string[] = [];

  data.forEach((item, index) => {
    const percentage = calculatePercentage(item.count, total);
    const color = getChartColor(index);
    gradientParts.push(`${color} ${cumulativePercentage}% ${cumulativePercentage + percentage}%`);
    cumulativePercentage += percentage;
  });

  chartContainer.style.background = `conic-gradient(${gradientParts.join(', ')})`;

  // Create legend
  const legend = wrapper.createDiv({ cls: 'stats-chart-legend' });
  data.forEach((item, index) => {
    const legendItem = legend.createDiv({ cls: 'stats-legend-item' });
    const colorBox = legendItem.createDiv({ cls: 'stats-legend-color' });
    colorBox.style.backgroundColor = getChartColor(index);
    legendItem.createSpan({ text: `${item.extension}: ${item.count} (${formatFileSize(item.totalSize)})` });
  });
}

export function renderBarChart(
  container: HTMLElement,
  data: FolderStats[],
  title: string,
  maxItems: number = 10
): void {
  const wrapper = container.createDiv({ cls: 'stats-chart-wrapper' });
  wrapper.createEl('h3', { text: title, cls: 'stats-chart-title' });

  const chartContainer = wrapper.createDiv({ cls: 'stats-bar-chart' });
  const maxValue = Math.max(...data.slice(0, maxItems).map(item => item.count));

  data.slice(0, maxItems).forEach((item, index) => {
    const barWrapper = chartContainer.createDiv({ cls: 'stats-bar-wrapper' });
    const label = barWrapper.createDiv({ cls: 'stats-bar-label' });
    label.textContent = item.path || 'Root';
    label.title = item.path || 'Root';

    const barContainer = barWrapper.createDiv({ cls: 'stats-bar-container' });
    const bar = barContainer.createDiv({ cls: 'stats-bar' });
    const percentage = calculatePercentage(item.count, maxValue);
    bar.style.width = `${percentage}%`;
    bar.style.backgroundColor = getChartColor(index);

    const value = barWrapper.createDiv({ cls: 'stats-bar-value' });
    value.textContent = `${item.count} files`;
  });
}

export function renderStatCard(
  container: HTMLElement,
  title: string,
  value: string | number,
  subtitle?: string
): void {
  const card = container.createDiv({ cls: 'stats-card' });
  card.createDiv({ text: title, cls: 'stats-card-title' });
  card.createDiv({ text: String(value), cls: 'stats-card-value' });
  if (subtitle) {
    card.createDiv({ text: subtitle, cls: 'stats-card-subtitle' });
  }
}

function getChartColor(index: number): string {
  const colors = [
    '#3498db',
    '#2ecc71',
    '#e74c3c',
    '#f39c12',
    '#9b59b6',
    '#1abc9c',
    '#e67e22',
    '#34495e',
    '#16a085',
    '#c0392b',
  ];
  return colors[index % colors.length];
}
```

- [ ] **Step 2: 提交代码**

```bash
git add src/components/stats/charts.ts
git commit -m "feat(stats): 实现基础图表组件（饼图、柱状图、统计卡片）"
```

### Task 6: 实现概览视图

**Files:**
- Create: `src/sections/stats/views/overview.ts`

- [ ] **Step 1: 实现概览视图**

```typescript
// src/sections/stats/views/overview.ts
import type { OverviewStats, StatsSettings } from '../types';
import { renderPieChart, renderBarChart, renderStatCard } from '../../../components/stats/charts';
import { formatFileSize } from '../../../utils/stats/file-utils';

export function renderOverview(
  container: HTMLElement,
  stats: OverviewStats,
  settings: StatsSettings
): void {
  // Clear container
  container.empty();
  container.addClass('stats-overview');

  // Render stat cards
  const cardsContainer = container.createDiv({ cls: 'stats-cards' });
  renderStatCard(cardsContainer, 'Total Notes', stats.totalFiles);
  renderStatCard(cardsContainer, 'Total Size', formatFileSize(stats.totalSize));
  renderStatCard(cardsContainer, 'Today Created', stats.todayCreated);
  renderStatCard(cardsContainer, 'This Week', stats.weekCreated);

  // Render charts
  const chartsContainer = container.createDiv({ cls: 'stats-charts' });

  // File type distribution pie chart
  if (stats.fileTypeStats.length > 0) {
    renderPieChart(chartsContainer, stats.fileTypeStats, 'File Type Distribution');
  }

  // Folder distribution bar chart
  if (stats.folderStats.length > 0) {
    renderBarChart(chartsContainer, stats.folderStats, 'Folder Distribution');
  }

  // Add styles
  addOverviewStyles();
}

function addOverviewStyles(): void {
  const styleId = 'stats-overview-styles';
  if (document.getElementById(styleId)) {
    return;
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .stats-overview {
      padding: 20px;
    }

    .stats-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .stats-card {
      background: var(--background-secondary);
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }

    .stats-card-title {
      font-size: 14px;
      color: var(--text-muted);
      margin-bottom: 8px;
    }

    .stats-card-value {
      font-size: 24px;
      font-weight: bold;
      color: var(--text-normal);
    }

    .stats-card-subtitle {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 4px;
    }

    .stats-charts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 24px;
    }

    .stats-chart-wrapper {
      background: var(--background-secondary);
      border-radius: 8px;
      padding: 16px;
    }

    .stats-chart-title {
      font-size: 16px;
      color: var(--text-normal);
      margin-bottom: 16px;
    }

    .stats-pie-chart {
      width: 200px;
      height: 200px;
      border-radius: 50%;
      margin: 0 auto 16px;
    }

    .stats-chart-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
    }

    .stats-legend-item {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: var(--text-muted);
    }

    .stats-legend-color {
      width: 12px;
      height: 12px;
      border-radius: 2px;
    }

    .stats-bar-chart {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .stats-bar-wrapper {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .stats-bar-label {
      width: 100px;
      font-size: 12px;
      color: var(--text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .stats-bar-container {
      flex: 1;
      height: 20px;
      background: var(--background-primary);
      border-radius: 4px;
      overflow: hidden;
    }

    .stats-bar {
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .stats-bar-value {
      width: 60px;
      font-size: 12px;
      color: var(--text-muted);
      text-align: right;
    }
  `;

  document.head.appendChild(style);
}
```

- [ ] **Step 2: 提交代码**

```bash
git add src/sections/stats/views/overview.ts
git commit -m "feat(stats): 实现概览视图，展示统计卡片和图表"
```

### Task 7: 集成到现有架构

**Files:**
- Modify: `src/core/types.ts`
- Modify: `src/core/settings.ts`
- Modify: `src/renderers/dashboard.ts`
- Modify: `src/core/view.ts`
- Modify: `src/utils/i18n/en.ts`
- Modify: `src/utils/i18n/zh.ts`

- [ ] **Step 1: 修改类型定义**

```typescript
// src/core/types.ts - 添加以下内容
export interface StatsSettings {
  enabled: boolean;
  fileType: {
    enabled: boolean;
    extensions: string[];
    excludePatterns: string[];
  };
  performance: {
    useWebWorkers: boolean;
    cacheEnabled: boolean;
    cacheTTL: number;
  };
}

// 在 DashboardSettings 接口添加
export interface DashboardSettings {
  // ... 现有设置
  stats: StatsSettings;
}

// 在 DEFAULT_SETTINGS 添加
export const DEFAULT_SETTINGS: DashboardSettings = {
  // ... 现有默认设置
  stats: {
    enabled: true,
    fileType: {
      enabled: true,
      extensions: ['.md', '.txt', '.org'],
      excludePatterns: ['node_modules', '.git', '.obsidian'],
    },
    performance: {
      useWebWorkers: true,
      cacheEnabled: true,
      cacheTTL: 5 * 60 * 1000,
    },
  },
};
```

- [ ] **Step 2: 修改设置界面**

```typescript
// src/core/settings.ts - 添加以下内容
import { StatsSettings } from './types';

// 在设置界面中添加笔记统计配置部分
function renderStatsSettings(containerEl: HTMLElement, settings: DashboardSettings): void {
  containerEl.createEl('h3', { text: 'Note Statistics' });

  new Setting(containerEl)
    .setName('Enable Statistics')
    .setDesc('Enable note statistics feature')
    .addToggle(toggle => toggle
      .setValue(settings.stats.enabled)
      .onChange(async value => {
        settings.stats.enabled = value;
        await this.plugin.saveSettings();
      }));

  new Setting(containerEl)
    .setName('File Extensions')
    .setDesc('File extensions to include in statistics')
    .addText(text => text
      .setPlaceholder('.md, .txt, .org')
      .setValue(settings.stats.fileType.extensions.join(', '))
      .onChange(async value => {
        settings.stats.fileType.extensions = value.split(',').map(s => s.trim());
        await this.plugin.saveSettings();
      }));

  new Setting(containerEl)
    .setName('Exclude Patterns')
    .setDesc('Patterns to exclude from statistics')
    .addText(text => text
      .setPlaceholder('node_modules, .git, .obsidian')
      .setValue(settings.stats.fileType.excludePatterns.join(', '))
      .onChange(async value => {
        settings.stats.fileType.excludePatterns = value.split(',').map(s => s.trim());
        await this.plugin.saveSettings();
      }));
}
```

- [ ] **Step 3: 修改仪表板渲染器**

```typescript
// src/renderers/dashboard.ts - 添加以下内容
import { renderStatsSection } from '../sections/stats';

// 在 renderDashboard 函数中添加
export function renderDashboard(
  container: HTMLElement,
  data: DashboardData,
  callbacks: RenderCallbacks,
  app: App,
  settings?: DashboardSettings,
  hoverParent: HoverParent | null = null,
): void {
  // ... 现有代码

  // Render stats section if enabled
  if (settings?.stats?.enabled) {
    const statsContainer = container.createDiv({ cls: 'dashboard-stats-section' });
    renderStatsSection(statsContainer, app, settings);
  }

  // ... 现有代码
}
```

- [ ] **Step 4: 修改视图**

```typescript
// src/core/view.ts - 添加以下内容
import { StatsSection } from '../sections/stats';

// 在 DashboardView 类中添加
export class DashboardView extends ItemView implements HoverParent {
  // ... 现有属性
  private statsSection: StatsSection | null = null;

  // 在 onOpen 方法中添加
  async onOpen(): Promise<void> {
    // ... 现有代码

    // Initialize stats section
    if (this.plugin.settings.stats.enabled) {
      this.statsSection = new StatsSection(this.app, this.plugin.settings);
    }
  }

  // 在 render 方法中添加
  private render(): void {
    // ... 现有代码

    // Render stats section
    if (this.statsSection) {
      const statsContainer = this.contentEl.createDiv({ cls: 'dashboard-stats' });
      this.statsSection.render(statsContainer);
    }
  }
}
```

- [ ] **Step 5: 添加翻译**

```typescript
// src/utils/i18n/en.ts - 添加以下内容
export const en = {
  // ... 现有翻译
  'stats.title': 'Note Statistics',
  'stats.totalNotes': 'Total Notes',
  'stats.totalSize': 'Total Size',
  'stats.todayCreated': 'Today Created',
  'stats.thisWeek': 'This Week',
  'stats.fileTypeDistribution': 'File Type Distribution',
  'stats.folderDistribution': 'Folder Distribution',
  'stats.settings.enable': 'Enable Statistics',
  'stats.settings.enableDesc': 'Enable note statistics feature',
  'stats.settings.fileExtensions': 'File Extensions',
  'stats.settings.fileExtensionsDesc': 'File extensions to include in statistics',
  'stats.settings.excludePatterns': 'Exclude Patterns',
  'stats.settings.excludePatternsDesc': 'Patterns to exclude from statistics',
};

// src/utils/i18n/zh.ts - 添加以下内容
export const zh = {
  // ... 现有翻译
  'stats.title': '笔记统计',
  'stats.totalNotes': '总笔记数',
  'stats.totalSize': '总大小',
  'stats.todayCreated': '今日新增',
  'stats.thisWeek': '本周新增',
  'stats.fileTypeDistribution': '文件类型分布',
  'stats.folderDistribution': '文件夹分布',
  'stats.settings.enable': '启用统计',
  'stats.settings.enableDesc': '启用笔记统计功能',
  'stats.settings.fileExtensions': '文件扩展名',
  'stats.settings.fileExtensionsDesc': '要统计的文件扩展名',
  'stats.settings.excludePatterns': '排除模式',
  'stats.settings.excludePatternsDesc': '要排除的文件模式',
};
```

- [ ] **Step 6: 提交代码**

```bash
git add src/core/types.ts src/core/settings.ts src/renderers/dashboard.ts src/core/view.ts src/utils/i18n/en.ts src/utils/i18n/zh.ts
git commit -m "feat(stats): 将笔记统计功能集成到现有架构"
```

### Task 8: 编写单元测试

**Files:**
- Create: `tests/sections/stats/scanner.test.ts`
- Create: `tests/sections/stats/analyzer.test.ts`
- Create: `tests/utils/stats/file-utils.test.ts`
- Create: `tests/utils/stats/math-utils.test.ts`

- [ ] **Step 1: 创建测试目录**

```bash
mkdir -p tests/sections/stats
mkdir -p tests/utils/stats
```

- [ ] **Step 2: 编写文件处理工具测试**

```typescript
// tests/utils/stats/file-utils.test.ts
import { shouldIncludeFile, getFileExtension, getFileName, getFolder, formatFileSize } from '../../../src/utils/stats/file-utils';

describe('file-utils', () => {
  describe('shouldIncludeFile', () => {
    it('should include file with enabled extension', () => {
      const config = {
        enabled: true,
        extensions: ['.md', '.txt'],
        excludePatterns: [],
      };
      expect(shouldIncludeFile('test.md', config)).toBe(true);
    });

    it('should exclude file with disabled extension', () => {
      const config = {
        enabled: true,
        extensions: ['.md'],
        excludePatterns: [],
      };
      expect(shouldIncludeFile('test.txt', config)).toBe(false);
    });

    it('should exclude file matching pattern', () => {
      const config = {
        enabled: true,
        extensions: ['.md'],
        excludePatterns: ['node_modules'],
      };
      expect(shouldIncludeFile('node_modules/test.md', config)).toBe(false);
    });
  });

  describe('getFileExtension', () => {
    it('should return extension', () => {
      expect(getFileExtension('test.md')).toBe('.md');
    });

    it('should return empty string for no extension', () => {
      expect(getFileExtension('test')).toBe('');
    });
  });

  describe('getFileName', () => {
    it('should return file name', () => {
      expect(getFileName('path/to/test.md')).toBe('test.md');
    });
  });

  describe('getFolder', () => {
    it('should return folder path', () => {
      expect(getFolder('path/to/test.md')).toBe('path/to');
    });

    it('should return empty string for root file', () => {
      expect(getFolder('test.md')).toBe('');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
    });

    it('should format zero', () => {
      expect(formatFileSize(0)).toBe('0 B');
    });
  });
});
```

- [ ] **Step 3: 编写数学计算工具测试**

```typescript
// tests/utils/stats/math-utils.test.ts
import { calculatePercentage, groupBy, sumBy, sortBy, isToday, isThisWeek } from '../../../src/utils/stats/math-utils';

describe('math-utils', () => {
  describe('calculatePercentage', () => {
    it('should calculate percentage', () => {
      expect(calculatePercentage(50, 100)).toBe(50);
    });

    it('should handle zero total', () => {
      expect(calculatePercentage(0, 0)).toBe(0);
    });
  });

  describe('groupBy', () => {
    it('should group items by key', () => {
      const items = [
        { type: 'a', value: 1 },
        { type: 'b', value: 2 },
        { type: 'a', value: 3 },
      ];
      const result = groupBy(items, item => item.type);
      expect(result).toEqual({
        a: [
          { type: 'a', value: 1 },
          { type: 'a', value: 3 },
        ],
        b: [{ type: 'b', value: 2 }],
      });
    });
  });

  describe('sumBy', () => {
    it('should sum values', () => {
      const items = [{ value: 1 }, { value: 2 }, { value: 3 }];
      expect(sumBy(items, item => item.value)).toBe(6);
    });
  });

  describe('sortBy', () => {
    it('should sort ascending', () => {
      const items = [{ value: 3 }, { value: 1 }, { value: 2 }];
      const result = sortBy(items, item => item.value);
      expect(result).toEqual([{ value: 1 }, { value: 2 }, { value: 3 }]);
    });

    it('should sort descending', () => {
      const items = [{ value: 3 }, { value: 1 }, { value: 2 }];
      const result = sortBy(items, item => item.value, true);
      expect(result).toEqual([{ value: 3 }, { value: 2 }, { value: 1 }]);
    });
  });

  describe('isToday', () => {
    it('should return true for today', () => {
      expect(isToday(Date.now())).toBe(true);
    });

    it('should return false for yesterday', () => {
      const yesterday = Date.now() - 24 * 60 * 60 * 1000;
      expect(isToday(yesterday)).toBe(false);
    });
  });

  describe('isThisWeek', () => {
    it('should return true for this week', () => {
      expect(isThisWeek(Date.now())).toBe(true);
    });

    it('should return false for last week', () => {
      const lastWeek = Date.now() - 7 * 24 * 60 * 60 * 1000;
      expect(isThisWeek(lastWeek)).toBe(false);
    });
  });
});
```

- [ ] **Step 4: 编写 Scanner 测试**

```typescript
// tests/sections/stats/scanner.test.ts
import { StatsScanner } from '../../../src/sections/stats/scanner';

// Mock Obsidian API
const mockApp = {
  vault: {
    getFiles: jest.fn(),
  },
  adapter: {
    stat: jest.fn(),
  },
};

describe('StatsScanner', () => {
  let scanner: StatsScanner;

  beforeEach(() => {
    scanner = new StatsScanner(mockApp as any, {
      fileType: {
        enabled: true,
        extensions: ['.md'],
        excludePatterns: [],
      },
    });
  });

  it('should scan files', async () => {
    mockApp.vault.getFiles.mockReturnValue([
      { path: 'test.md', stat: { ctime: Date.now(), mtime: Date.now() } },
    ]);
    mockApp.adapter.stat.mockResolvedValue({ size: 1024 });

    const result = await scanner.scan();
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('test.md');
    expect(result[0].size).toBe(1024);
  });

  it('should filter files by extension', async () => {
    mockApp.vault.getFiles.mockReturnValue([
      { path: 'test.md', stat: { ctime: Date.now(), mtime: Date.now() } },
      { path: 'test.txt', stat: { ctime: Date.now(), mtime: Date.now() } },
    ]);
    mockApp.adapter.stat.mockResolvedValue({ size: 1024 });

    const result = await scanner.scan();
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('test.md');
  });
});
```

- [ ] **Step 5: 编写 Analyzer 测试**

```typescript
// tests/sections/stats/analyzer.test.ts
import { StatsAnalyzer } from '../../../src/sections/stats/analyzer';

describe('StatsAnalyzer', () => {
  let analyzer: StatsAnalyzer;

  beforeEach(() => {
    analyzer = new StatsAnalyzer();
  });

  it('should analyze files', () => {
    const files = [
      {
        path: 'test1.md',
        name: 'test1.md',
        extension: '.md',
        size: 1024,
        created: Date.now(),
        modified: Date.now(),
        folder: '',
      },
      {
        path: 'test2.md',
        name: 'test2.md',
        extension: '.md',
        size: 2048,
        created: Date.now(),
        modified: Date.now(),
        folder: 'subfolder',
      },
    ];

    const result = analyzer.analyze(files);
    expect(result.totalFiles).toBe(2);
    expect(result.totalSize).toBe(3072);
    expect(result.fileTypeStats).toHaveLength(1);
    expect(result.fileTypeStats[0].extension).toBe('.md');
    expect(result.fileTypeStats[0].count).toBe(2);
    expect(result.folderStats).toHaveLength(2);
  });
});
```

- [ ] **Step 6: 运行测试**

```bash
npm test
```

- [ ] **Step 7: 提交代码**

```bash
git add tests/
git commit -m "test(stats): 添加笔记统计功能的单元测试"
```

### Task 9: 集成测试和最终提交

**Files:**
- Modify: `package.json` (if needed)
- Modify: `tsconfig.json` (if needed)

- [ ] **Step 1: 运行所有测试**

```bash
npm test
```

- [ ] **Step 2: 运行 TypeScript 检查**

```bash
npm run lint
```

- [ ] **Step 3: 构建项目**

```bash
npm run build
```

- [ ] **Step 4: 提交最终代码**

```bash
git add .
git commit -m "feat(stats): 完成笔记统计功能阶段一 - 基础统计功能"
```

- [ ] **Step 5: 创建 Pull Request**

```bash
git push origin feature/note-stats-phase1
```

---

## 里程碑

- **里程碑 1**: 项目结构创建完成（Task 1）
- **里程碑 2**: Scanner 和 Analyzer 模块完成（Task 2-3）
- **里程碑 3**: Cache 和图表组件完成（Task 4-5）
- **里程碑 4**: 概览视图完成（Task 6）
- **里程碑 5**: 集成到现有架构完成（Task 7）
- **里程碑 6**: 单元测试完成（Task 8）
- **里程碑 7**: 集成测试和最终提交完成（Task 9）

## 风险和应对措施

1. **技术风险**: 自定义图表组件开发复杂度高
   - **应对措施**: 先实现简单的 CSS 图表，后续再考虑使用 Chart.js

2. **性能风险**: 大型 vault 处理性能不佳
   - **应对措施**: 实现增量扫描和缓存机制

3. **集成风险**: 与现有架构集成困难
   - **应对措施**: 遵循现有架构模式，逐步集成

## 总结

本计划详细描述了笔记统计功能阶段一的实现步骤。通过分阶段开发、模块化设计、单元测试等方法，确保功能的稳定性和可维护性。每个任务都包含详细的代码示例和测试用例，便于工程师理解和实现。
