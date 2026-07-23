import type { OverviewStats, StatsSettings } from '../types';
import { formatFileSize } from '../../../utils/stats/file-utils';
import { t } from '../../../utils/i18n';

export function renderOverview(
  container: HTMLElement,
  stats: OverviewStats,
  settings: StatsSettings
): void {
  container.empty();

  const wrapper = container.createDiv({ cls: 'dashboard-stats-overview' });

  // Summary cards
  const summaryRow = wrapper.createDiv({ cls: 'dashboard-stats-summary-row' });
  renderSummaryCard(summaryRow, t('stats.totalFiles'), stats.totalFiles.toString());
  renderSummaryCard(summaryRow, t('stats.totalSize'), formatFileSize(stats.totalSize));
  renderSummaryCard(summaryRow, t('stats.today'), stats.todayCreated.toString());
  renderSummaryCard(summaryRow, t('stats.thisWeek'), stats.weekCreated.toString());

  // File type distribution
  if (settings.stats.fileCount && stats.fileTypeStats.length > 0) {
    const section = wrapper.createDiv({ cls: 'dashboard-stats-section' });
    section.createEl('h3', { text: t('stats.fileTypes') });
    renderFileTypeList(section, stats.fileTypeStats);
  }

  // Folder distribution
  if (settings.stats.fileSize && stats.folderStats.length > 0) {
    const section = wrapper.createDiv({ cls: 'dashboard-stats-section' });
    section.createEl('h3', { text: t('stats.topFolders') });
    renderFolderList(section, stats.folderStats.slice(0, 10));
  }
}

function renderSummaryCard(container: HTMLElement, label: string, value: string): void {
  const card = container.createDiv({ cls: 'dashboard-stats-summary-card' });
  card.createDiv({ cls: 'dashboard-stats-summary-value', text: value });
  card.createDiv({ cls: 'dashboard-stats-summary-label', text: label });
}

function renderFileTypeList(container: HTMLElement, stats: Array<{ extension: string; count: number; totalSize: number }>): void {
  const list = container.createDiv({ cls: 'dashboard-stats-file-type-list' });
  for (const stat of stats) {
    const item = list.createDiv({ cls: 'dashboard-stats-file-type-item' });
    item.createSpan({ cls: 'dashboard-stats-file-type-ext', text: `.${stat.extension}` });
    item.createSpan({ cls: 'dashboard-stats-file-type-count', text: t('stats.fileCount', { count: stat.count.toString() }) });
    item.createSpan({ cls: 'dashboard-stats-file-type-size', text: formatFileSize(stat.totalSize) });
  }
}

function renderFolderList(container: HTMLElement, stats: Array<{ path: string; count: number; totalSize: number }>): void {
  const list = container.createDiv({ cls: 'dashboard-stats-folder-list' });
  for (const stat of stats) {
    const item = list.createDiv({ cls: 'dashboard-stats-folder-item' });
    item.createSpan({ cls: 'dashboard-stats-folder-path', text: stat.path || '/' });
    item.createSpan({ cls: 'dashboard-stats-folder-count', text: t('stats.fileCount', { count: stat.count.toString() }) });
    item.createSpan({ cls: 'dashboard-stats-folder-size', text: formatFileSize(stat.totalSize) });
  }
}
