import type { OverviewStats, StatsRuntimeConfig } from '../types';
import type { FileMetadata } from '../types';
import { renderPieChart, renderBarChart, renderStatCard } from '../../../components/stats/charts';
import { renderHeatmap, generateHeatmapData } from '../../../components/stats/heatmap';
import { formatFileSize } from '../../../utils/stats/file-utils';
import { t } from '../../../utils/i18n';

export function renderOverview(
  container: HTMLElement,
  stats: OverviewStats,
  settings: StatsRuntimeConfig,
  files?: FileMetadata[]
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

  // Render heatmap section
  if (files && files.length > 0) {
    const heatmapSection = container.createDiv({ cls: 'stats-heatmap-section' });

    // Created time heatmap
    const createdData = generateHeatmapData(files, 'created');
    renderHeatmap(heatmapSection, createdData, t('stats.createdHeatmap') || 'Note Creation Activity', {
      weeks: 52,
      colorScheme: 'green',
    });

    // Modified time heatmap
    const modifiedData = generateHeatmapData(files, 'modified');
    renderHeatmap(heatmapSection, modifiedData, t('stats.modifiedHeatmap') || 'Note Modification Activity', {
      weeks: 52,
      colorScheme: 'blue',
    });
  }

  // Render charts section
  const chartsSection = container.createDiv({ cls: 'stats-charts-section' });
  chartsSection.createEl('h2', { text: t('stats.chartsTitle') || 'Statistics Charts', cls: 'stats-charts-title' });

  const chartsContainer = chartsSection.createDiv({ cls: 'stats-charts' });

  // File type distribution pie chart
  if (stats.fileTypeStats.length > 0) {
    renderPieChart(chartsContainer, stats.fileTypeStats, t('stats.fileTypeDistribution'), 'pie-chart');
  } else {
    // Show placeholder when no data
    const placeholder = chartsContainer.createDiv({ cls: 'stats-chart-placeholder' });
    placeholder.createDiv({ text: t('stats.noData') || 'No file type data available', cls: 'stats-chart-placeholder-text' });
  }

  // Folder distribution bar chart
  if (stats.folderStats.length > 0) {
    renderBarChart(chartsContainer, stats.folderStats, t('stats.folderDistribution'), 10, 'folder-tree');
  } else {
    // Show placeholder when no data
    const placeholder = chartsContainer.createDiv({ cls: 'stats-chart-placeholder' });
    placeholder.createDiv({ text: t('stats.noData') || 'No folder data available', cls: 'stats-chart-placeholder-text' });
  }
}
