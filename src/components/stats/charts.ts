/**
 * Stats charts component
 * Provides reusable chart rendering utilities for statistics visualization
 */

import { setIcon } from 'obsidian';
import type { FileTypeStats, SizeDistribution, DepthDistribution } from '../../sections/stats/types';
import { formatFileSize } from '../../utils/stats/file-utils';
import { calculatePercentage } from '../../utils/stats/math-utils';
import { t } from '../../utils/i18n';

/**
 * Render a pie chart using CSS conic-gradient
 */
export function renderPieChart(
  container: HTMLElement,
  data: FileTypeStats[],
  title: string,
  icon?: string
): void {
  const wrapper = container.createDiv({ cls: 'stats-chart-wrapper' });
  const titleEl = wrapper.createEl('h3', { cls: 'stats-chart-title' });

  if (icon) {
    const iconEl = titleEl.createSpan({ cls: 'stats-chart-title-icon' });
    setIcon(iconEl, icon);
  }

  titleEl.createSpan({ text: title });

  if (data.length === 0) {
    wrapper.createDiv({ text: t('stats.noData'), cls: 'stats-chart-empty' });
    return;
  }

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

/**
 * Render a statistics card with title, value, and optional subtitle
 */
export function renderStatCard(
  container: HTMLElement,
  title: string,
  value: string | number,
  subtitle?: string,
  icon?: string
): void {
  const card = container.createDiv({ cls: 'stats-card' });

  // Header row: icon + title
  const headerEl = card.createDiv({ cls: 'stats-card-header' });
  if (icon) {
    const iconEl = headerEl.createDiv({ cls: 'stats-card-icon' });
    setIcon(iconEl, icon);
  }
  headerEl.createDiv({ text: title, cls: 'stats-card-title' });

  // Value
  card.createDiv({ text: String(value), cls: 'stats-card-value' });

  if (subtitle) {
    card.createDiv({ text: subtitle, cls: 'stats-card-subtitle' });
  }
}

/**
 * Default chart colors (can be overridden via CSS variables)
 */
const DEFAULT_CHART_COLORS = [
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

/**
 * Get a chart color by index (cycles through predefined colors)
 * Supports CSS custom properties for theme customization
 */
export function getChartColor(index: number): string {
  // Try to get color from CSS variable first
  const cssVar = `--db-chart-color-${(index % 10) + 1}`;
  const cssColor = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();

  if (cssColor) {
    return cssColor;
  }

  // Fallback to default colors
  return DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length] ?? '#3498db';
}

/**
 * Render a size distribution chart with progress bars
 */
export function renderSizeDistributionChart(
  container: HTMLElement,
  data: SizeDistribution[],
  title: string,
  icon?: string
): void {
  const wrapper = container.createDiv({ cls: 'stats-chart-wrapper' });
  const titleEl = wrapper.createEl('h3', { cls: 'stats-chart-title' });

  if (icon) {
    const iconEl = titleEl.createSpan({ cls: 'stats-chart-title-icon' });
    setIcon(iconEl, icon);
  }

  titleEl.createSpan({ text: title });

  if (data.length === 0 || data.every(d => d.count === 0)) {
    wrapper.createDiv({ text: t('stats.noData'), cls: 'stats-chart-empty' });
    return;
  }

  const chartContainer = wrapper.createDiv({ cls: 'stats-progress-chart' });

  data.forEach((item, index) => {
    const row = chartContainer.createDiv({ cls: 'stats-progress-row' });
    if (item.count === 0) {
      row.addClass('stats-progress-row--empty');
    }

    const label = row.createDiv({ cls: 'stats-progress-label' });
    label.textContent = item.range;

    const barContainer = row.createDiv({ cls: 'stats-progress-bar-bg' });
    const bar = barContainer.createDiv({ cls: 'stats-progress-bar-fill' });
    bar.style.width = `${item.percentage}%`;
    bar.style.backgroundColor = getChartColor(index);

    const value = row.createDiv({ cls: 'stats-progress-value' });
    value.textContent = `${item.count}`;
  });
}

/**
 * Render a depth distribution chart with progress bars
 */
export function renderDepthDistributionChart(
  container: HTMLElement,
  data: DepthDistribution[],
  title: string,
  icon?: string
): void {
  const wrapper = container.createDiv({ cls: 'stats-chart-wrapper' });
  const titleEl = wrapper.createEl('h3', { cls: 'stats-chart-title' });

  if (icon) {
    const iconEl = titleEl.createSpan({ cls: 'stats-chart-title-icon' });
    setIcon(iconEl, icon);
  }

  titleEl.createSpan({ text: title });

  if (data.length === 0) {
    wrapper.createDiv({ text: t('stats.noData'), cls: 'stats-chart-empty' });
    return;
  }

  const chartContainer = wrapper.createDiv({ cls: 'stats-progress-chart' });

  data.forEach((item, index) => {
    const row = chartContainer.createDiv({ cls: 'stats-progress-row' });

    const label = row.createDiv({ cls: 'stats-progress-label' });
    // Labels: Root, 1, 2, 3, 4+
    if (item.depth === 0) {
      label.textContent = 'Root';
    } else if (item.depth >= 4) {
      label.textContent = '4+';
    } else {
      label.textContent = String(item.depth);
    }

    const barContainer = row.createDiv({ cls: 'stats-progress-bar-bg' });
    const bar = barContainer.createDiv({ cls: 'stats-progress-bar-fill' });
    bar.style.width = `${item.percentage}%`;
    bar.style.backgroundColor = getChartColor(index);

    const value = row.createDiv({ cls: 'stats-progress-value' });
    value.textContent = `${item.count}`;
  });
}
