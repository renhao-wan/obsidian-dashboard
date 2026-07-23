/**
 * Timeline component for stats module
 * Renders time-based statistics charts
 */

import { setIcon } from 'obsidian';
import { t } from '../../utils/i18n';

export interface TimelineData {
  date: string; // YYYY-MM-DD format
  count: number;
}

export interface TimelineOptions {
  type?: 'line' | 'bar';
  showLabels?: boolean;
  showGrid?: boolean;
  height?: number;
}

/**
 * Format date to YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Generate timeline data from file metadata
 */
export function generateTimelineData(
  files: Array<{ created: number; modified: number }>,
  type: 'created' | 'modified' = 'created',
  days: number = 30
): TimelineData[] {
  const counts = new Map<string, number>();
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  // Initialize all dates with 0
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = formatDate(date);
    counts.set(dateStr, 0);
  }

  // Count files
  for (const file of files) {
    const timestamp = type === 'created' ? file.created : file.modified;
    const date = new Date(timestamp);
    const dateStr = formatDate(date);

    if (counts.has(dateStr)) {
      counts.set(dateStr, (counts.get(dateStr) || 0) + 1);
    }
  }

  // Convert to array and reverse (oldest first)
  return Array.from(counts.entries())
    .map(([date, count]) => ({ date, count }))
    .reverse();
}

/**
 * Render a line chart
 */
function renderLineChart(
  container: HTMLElement,
  data: TimelineData[],
  options: TimelineOptions
): void {
  const { showLabels = true, showGrid = true, height = 200 } = options;

  if (data.length === 0) {
    container.createDiv({ text: t('stats.noData') || 'No data available', cls: 'stats-chart-empty' });
    return;
  }

  const maxCount = Math.max(...data.map(d => d.count), 1);
  const width = container.clientWidth || 600;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const svg = container.createSvg('svg', {
    attr: {
      width: width.toString(),
      height: height.toString(),
      viewBox: `0 0 ${width} ${height}`,
    },
  });

  // Add grid lines
  if (showGrid) {
    const gridGroup = svg.createSvg('g', { cls: 'stats-chart-grid' });
    const gridLines = 5;

    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (chartHeight / gridLines) * i;
      gridGroup.createSvg('line', {
        attr: {
          x1: padding.left.toString(),
          y1: y.toString(),
          x2: (width - padding.right).toString(),
          y2: y.toString(),
          stroke: 'var(--db-border-card)',
          'stroke-width': '1',
          'stroke-dasharray': '4,4',
        },
      });

      // Add value label
      if (showLabels) {
        const value = Math.round(maxCount - (maxCount / gridLines) * i);
        const text = gridGroup.createSvg('text', {
          attr: {
            x: (padding.left - 10).toString(),
            y: (y + 4).toString(),
            fill: 'var(--db-text-muted)',
            'font-size': '10',
            'font-family': 'sans-serif',
            'text-anchor': 'end',
          },
        });
        text.textContent = value.toString();
      }
    }
  }

  // Create line path
  const lineGroup = svg.createSvg('g', { cls: 'stats-chart-line' });
  const points: string[] = [];

  data.forEach((item, index) => {
    const x = padding.left + (chartWidth / (data.length - 1)) * index;
    const y = padding.top + chartHeight - (item.count / maxCount) * chartHeight;
    points.push(`${x},${y}`);
  });

  // Draw line
  lineGroup.createSvg('polyline', {
    attr: {
      points: points.join(' '),
      fill: 'none',
      stroke: 'var(--db-accent)',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    },
  });

  // Draw area
  const areaPoints = [
    `${padding.left},${padding.top + chartHeight}`,
    ...points,
    `${padding.left + chartWidth},${padding.top + chartHeight}`,
  ];
  lineGroup.createSvg('polygon', {
    attr: {
      points: areaPoints.join(' '),
      fill: 'var(--db-accent)',
      opacity: '0.1',
    },
  });

  // Draw dots
  data.forEach((item, index) => {
    const x = padding.left + (chartWidth / (data.length - 1)) * index;
    const y = padding.top + chartHeight - (item.count / maxCount) * chartHeight;

    const dot = lineGroup.createSvg('circle', {
      attr: {
        cx: x.toString(),
        cy: y.toString(),
        r: '4',
        fill: 'var(--db-accent)',
        stroke: 'var(--db-bg-card)',
        'stroke-width': '2',
      },
    });

    // Add tooltip
    const title = dot.createSvg('title');
    title.textContent = `${item.date}: ${item.count}`;
  });

  // Add x-axis labels
  if (showLabels) {
    const labelGroup = svg.createSvg('g', { cls: 'stats-chart-labels' });
    const labelInterval = Math.max(1, Math.floor(data.length / 7));

    data.forEach((item, index) => {
      if (index % labelInterval === 0) {
        const x = padding.left + (chartWidth / (data.length - 1)) * index;
        const y = height - 10;

        const text = labelGroup.createSvg('text', {
          attr: {
            x: x.toString(),
            y: y.toString(),
            fill: 'var(--db-text-muted)',
            'font-size': '10',
            'font-family': 'sans-serif',
            'text-anchor': 'middle',
          },
        });

        // Show short date (MM-DD)
        text.textContent = item.date.substring(5);
      }
    });
  }
}

/**
 * Render a bar chart
 */
function renderBarChart(
  container: HTMLElement,
  data: TimelineData[],
  options: TimelineOptions
): void {
  const { showLabels = true, showGrid = true, height = 200 } = options;

  if (data.length === 0) {
    container.createDiv({ text: t('stats.noData') || 'No data available', cls: 'stats-chart-empty' });
    return;
  }

  const maxCount = Math.max(...data.map(d => d.count), 1);
  const width = container.clientWidth || 600;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const barWidth = Math.max(2, (chartWidth / data.length) - 2);

  const svg = container.createSvg('svg', {
    attr: {
      width: width.toString(),
      height: height.toString(),
      viewBox: `0 0 ${width} ${height}`,
    },
  });

  // Add grid lines
  if (showGrid) {
    const gridGroup = svg.createSvg('g', { cls: 'stats-chart-grid' });
    const gridLines = 5;

    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (chartHeight / gridLines) * i;
      gridGroup.createSvg('line', {
        attr: {
          x1: padding.left.toString(),
          y1: y.toString(),
          x2: (width - padding.right).toString(),
          y2: y.toString(),
          stroke: 'var(--db-border-card)',
          'stroke-width': '1',
          'stroke-dasharray': '4,4',
        },
      });

      // Add value label
      if (showLabels) {
        const value = Math.round(maxCount - (maxCount / gridLines) * i);
        const text = gridGroup.createSvg('text', {
          attr: {
            x: (padding.left - 10).toString(),
            y: (y + 4).toString(),
            fill: 'var(--db-text-muted)',
            'font-size': '10',
            'font-family': 'sans-serif',
            'text-anchor': 'end',
          },
        });
        text.textContent = value.toString();
      }
    }
  }

  // Draw bars
  const barGroup = svg.createSvg('g', { cls: 'stats-chart-bars' });

  data.forEach((item, index) => {
    const x = padding.left + (chartWidth / data.length) * index + 1;
    const barHeight = (item.count / maxCount) * chartHeight;
    const y = padding.top + chartHeight - barHeight;

    const bar = barGroup.createSvg('rect', {
      attr: {
        x: x.toString(),
        y: y.toString(),
        width: barWidth.toString(),
        height: barHeight.toString(),
        fill: 'var(--db-accent)',
        rx: '2',
        ry: '2',
      },
    });

    // Add tooltip
    const title = bar.createSvg('title');
    title.textContent = `${item.date}: ${item.count}`;
  });

  // Add x-axis labels
  if (showLabels) {
    const labelGroup = svg.createSvg('g', { cls: 'stats-chart-labels' });
    const labelInterval = Math.max(1, Math.floor(data.length / 7));

    data.forEach((item, index) => {
      if (index % labelInterval === 0) {
        const x = padding.left + (chartWidth / data.length) * index + barWidth / 2;
        const y = height - 10;

        const text = labelGroup.createSvg('text', {
          attr: {
            x: x.toString(),
            y: y.toString(),
            fill: 'var(--db-text-muted)',
            'font-size': '10',
            'font-family': 'sans-serif',
            'text-anchor': 'middle',
          },
        });

        // Show short date (MM-DD)
        text.textContent = item.date.substring(5);
      }
    });
  }
}

/**
 * Render a timeline chart
 */
export function renderTimeline(
  container: HTMLElement,
  data: TimelineData[],
  title: string,
  options: TimelineOptions = {}
): void {
  const { type = 'line' } = options;

  const wrapper = container.createDiv({ cls: 'stats-timeline-wrapper' });

  // Create title with icon
  const titleEl = wrapper.createEl('h3', { cls: 'stats-timeline-title' });
  const iconEl = titleEl.createSpan({ cls: 'stats-timeline-title-icon' });
  setIcon(iconEl, 'trending-up');
  titleEl.createSpan({ text: title });

  // Create chart container
  const chartContainer = wrapper.createDiv({ cls: 'stats-timeline-chart' });

  if (type === 'line') {
    renderLineChart(chartContainer, data, options);
  } else {
    renderBarChart(chartContainer, data, options);
  }
}

/**
 * Calculate trend statistics
 */
export function calculateTrend(data: TimelineData[]): {
  total: number;
  average: number;
  trend: 'up' | 'down' | 'stable';
  percentage: number;
} {
  if (data.length === 0) {
    return { total: 0, average: 0, trend: 'stable', percentage: 0 };
  }

  const total = data.reduce((sum, d) => sum + d.count, 0);
  const average = total / data.length;

  // Calculate trend (compare first half with second half)
  const mid = Math.floor(data.length / 2);
  const firstHalf = data.slice(0, mid);
  const secondHalf = data.slice(mid);

  const firstTotal = firstHalf.reduce((sum, d) => sum + d.count, 0);
  const secondTotal = secondHalf.reduce((sum, d) => sum + d.count, 0);

  let trend: 'up' | 'down' | 'stable' = 'stable';
  let percentage = 0;

  if (firstTotal > 0) {
    percentage = ((secondTotal - firstTotal) / firstTotal) * 100;
    if (percentage > 10) trend = 'up';
    else if (percentage < -10) trend = 'down';
  } else if (secondTotal > 0) {
    trend = 'up';
    percentage = 100;
  }

  return { total, average, trend, percentage };
}
