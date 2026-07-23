/**
 * Stats charts component
 * Provides reusable chart rendering utilities for statistics visualization
 */

import { setIcon } from 'obsidian';
import type { FileTypeStats, FolderStats } from '../../sections/stats/types';
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
 * Render a horizontal bar chart for folder distribution
 */
export function renderBarChart(
  container: HTMLElement,
  data: FolderStats[],
  title: string,
  maxItems: number = 10,
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
    value.textContent = t('stats.fileCount', { count: item.count });
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

  if (icon) {
    const iconEl = card.createDiv({ cls: 'stats-card-icon' });
    setIcon(iconEl, icon);
  }

  card.createDiv({ text: title, cls: 'stats-card-title' });
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
function getChartColor(index: number): string {
  // Try to get color from CSS variable first
  const cssVar = `--db-chart-color-${(index % 10) + 1}`;
  const cssColor = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();

  if (cssColor) {
    return cssColor;
  }

  // Fallback to default colors
  return DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length] ?? '#3498db';
}
