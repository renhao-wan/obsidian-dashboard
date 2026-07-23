import type { OverviewStats, StatsSettings } from '../types';

export function renderOverview(
  container: HTMLElement,
  stats: OverviewStats,
  settings: StatsSettings
): void {
  container.empty();

  const wrapper = container.createDiv({ cls: 'stats-overview' });

  // Summary cards
  const summaryRow = wrapper.createDiv({ cls: 'stats-summary-row' });
  renderSummaryCard(summaryRow, 'Total Files', stats.totalFiles.toString());
  renderSummaryCard(summaryRow, 'Total Size', formatSize(stats.totalSize));
  renderSummaryCard(summaryRow, 'Today', stats.todayCreated.toString());
  renderSummaryCard(summaryRow, 'This Week', stats.weekCreated.toString());

  // File type distribution
  if (settings.stats.fileCount && stats.fileTypeStats.length > 0) {
    const section = wrapper.createDiv({ cls: 'stats-section' });
    section.createEl('h3', { text: 'File Types' });
    renderFileTypeList(section, stats.fileTypeStats);
  }

  // Folder distribution
  if (settings.stats.fileSize && stats.folderStats.length > 0) {
    const section = wrapper.createDiv({ cls: 'stats-section' });
    section.createEl('h3', { text: 'Top Folders' });
    renderFolderList(section, stats.folderStats.slice(0, 10));
  }
}

function renderSummaryCard(container: HTMLElement, label: string, value: string): void {
  const card = container.createDiv({ cls: 'stats-summary-card' });
  card.createDiv({ cls: 'stats-summary-value', text: value });
  card.createDiv({ cls: 'stats-summary-label', text: label });
}

function renderFileTypeList(container: HTMLElement, stats: Array<{ extension: string; count: number; totalSize: number }>): void {
  const list = container.createDiv({ cls: 'stats-file-type-list' });
  for (const stat of stats) {
    const item = list.createDiv({ cls: 'stats-file-type-item' });
    item.createSpan({ cls: 'stats-file-type-ext', text: `.${stat.extension}` });
    item.createSpan({ cls: 'stats-file-type-count', text: `${stat.count} files` });
    item.createSpan({ cls: 'stats-file-type-size', text: formatSize(stat.totalSize) });
  }
}

function renderFolderList(container: HTMLElement, stats: Array<{ path: string; count: number; totalSize: number }>): void {
  const list = container.createDiv({ cls: 'stats-folder-list' });
  for (const stat of stats) {
    const item = list.createDiv({ cls: 'stats-folder-item' });
    item.createSpan({ cls: 'stats-folder-path', text: stat.path || '/' });
    item.createSpan({ cls: 'stats-folder-count', text: `${stat.count} files` });
    item.createSpan({ cls: 'stats-folder-size', text: formatSize(stat.totalSize) });
  }
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
