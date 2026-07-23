import type { OverviewStats, StatsSettings } from '../types';
import { renderPieChart, renderBarChart, renderStatCard } from '../../../components/stats/charts';
import { formatFileSize } from '../../../utils/stats/file-utils';
import { t } from '../../../utils/i18n';

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
  renderStatCard(cardsContainer, t('stats.totalFiles'), stats.totalFiles);
  renderStatCard(cardsContainer, t('stats.totalSize'), formatFileSize(stats.totalSize));
  renderStatCard(cardsContainer, t('stats.today'), stats.todayCreated);
  renderStatCard(cardsContainer, t('stats.thisWeek'), stats.weekCreated);

  // Render charts
  const chartsContainer = container.createDiv({ cls: 'stats-charts' });

  // File type distribution pie chart
  if (stats.fileTypeStats.length > 0) {
    renderPieChart(chartsContainer, stats.fileTypeStats, t('stats.fileTypes'));
  }

  // Folder distribution bar chart
  if (stats.folderStats.length > 0) {
    renderBarChart(chartsContainer, stats.folderStats, t('stats.topFolders'));
  }
}
