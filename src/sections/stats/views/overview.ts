import type { OverviewStats, StatsRuntimeConfig } from '../types';
import { renderPieChart, renderBarChart, renderStatCard } from '../../../components/stats/charts';
import { formatFileSize } from '../../../utils/stats/file-utils';
import { t } from '../../../utils/i18n';

export function renderOverview(
  container: HTMLElement,
  stats: OverviewStats,
  settings: StatsRuntimeConfig
): void {
  // Clear container
  container.empty();
  container.addClass('stats-overview');

  // Render stat cards
  const cardsContainer = container.createDiv({ cls: 'stats-cards' });
  renderStatCard(cardsContainer, t('stats.totalNotes'), stats.totalFiles, undefined, 'file-text');
  renderStatCard(cardsContainer, t('stats.totalSize'), formatFileSize(stats.totalSize), undefined, 'hard-drive');
  renderStatCard(cardsContainer, t('stats.todayCreated'), stats.todayCreated, undefined, 'calendar-plus');
  renderStatCard(cardsContainer, t('stats.thisWeek'), stats.weekCreated, undefined, 'calendar-range');

  // Render charts
  const chartsContainer = container.createDiv({ cls: 'stats-charts' });

  // File type distribution pie chart
  if (stats.fileTypeStats.length > 0) {
    renderPieChart(chartsContainer, stats.fileTypeStats, t('stats.fileTypeDistribution'), 'pie-chart');
  }

  // Folder distribution bar chart
  if (stats.folderStats.length > 0) {
    renderBarChart(chartsContainer, stats.folderStats, t('stats.folderDistribution'), 10, 'folder-tree');
  }
}
