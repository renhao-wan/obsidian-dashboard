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
