/**
 * Heatmap component for stats module
 * Renders a GitHub-style contribution heatmap
 */

import { setIcon } from 'obsidian';
import { t } from '../../utils/i18n';

export interface HeatmapData {
  date: string; // YYYY-MM-DD format
  count: number;
}

export interface HeatmapOptions {
  weeks?: number; // Number of weeks to display (default: 52)
  cellSize?: number; // Size of each cell in pixels (default: 12)
  gap?: number; // Gap between cells in pixels (default: 2)
  showLabels?: boolean; // Show month labels (default: true)
  showLegend?: boolean; // Show legend (default: true)
  colorScheme?: 'green' | 'blue' | 'purple' | 'orange'; // Color scheme (default: 'green')
}

const COLOR_SCHEMES = {
  green: [
    'var(--db-heatmap-empty, #ebedf0)',
    'var(--db-heatmap-level-1, #9be9a8)',
    'var(--db-heatmap-level-2, #40c463)',
    'var(--db-heatmap-level-3, #30a14e)',
    'var(--db-heatmap-level-4, #216e39)',
  ],
  blue: [
    'var(--db-heatmap-empty, #ebedf0)',
    'var(--db-heatmap-level-1, #9ecae1)',
    'var(--db-heatmap-level-2, #6baed6)',
    'var(--db-heatmap-level-3, #4292c6)',
    'var(--db-heatmap-level-4, #2171b5)',
  ],
  purple: [
    'var(--db-heatmap-empty, #ebedf0)',
    'var(--db-heatmap-level-1, #c6dbef)',
    'var(--db-heatmap-level-2, #9ecae1)',
    'var(--db-heatmap-level-3, #6baed6)',
    'var(--db-heatmap-level-4, #4292c6)',
  ],
  orange: [
    'var(--db-heatmap-empty, #ebedf0)',
    'var(--db-heatmap-level-1, #fdbe85)',
    'var(--db-heatmap-level-2, #fd8d3c)',
    'var(--db-heatmap-level-3, #e6550d)',
    'var(--db-heatmap-level-4, #a63603)',
  ],
};

/**
 * Get the color for a given count value
 */
function getColor(count: number, maxCount: number, colorScheme: keyof typeof COLOR_SCHEMES): string {
  const colors = COLOR_SCHEMES[colorScheme];

  if (count === 0) return colors[0] ?? '#ebedf0';

  const ratio = count / maxCount;
  if (ratio <= 0.25) return colors[1] ?? '#9be9a8';
  if (ratio <= 0.5) return colors[2] ?? '#40c463';
  if (ratio <= 0.75) return colors[3] ?? '#30a14e';
  return colors[4] ?? '#216e39';
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
 * Get the start of the week (Sunday)
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Render a GitHub-style heatmap
 */
export function renderHeatmap(
  container: HTMLElement,
  data: HeatmapData[],
  title: string,
  options: HeatmapOptions = {}
): void {
  const {
    weeks = 52,
    cellSize = 12,
    gap = 2,
    showLabels = true,
    showLegend = true,
    colorScheme = 'green',
  } = options;

  // Create wrapper
  const wrapper = container.createDiv({ cls: 'stats-heatmap-wrapper' });

  // Create title with icon
  const titleEl = wrapper.createEl('h3', { cls: 'stats-heatmap-title' });
  const iconEl = titleEl.createSpan({ cls: 'stats-heatmap-title-icon' });
  setIcon(iconEl, 'calendar');
  titleEl.createSpan({ text: title });

  // Create data map for quick lookup
  const dataMap = new Map<string, number>();
  let maxCount = 0;
  for (const item of data) {
    dataMap.set(item.date, item.count);
    if (item.count > maxCount) {
      maxCount = item.count;
    }
  }

  // Calculate date range
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - (weeks * 7) - today.getDay());

  // Create SVG
  const svgWidth = (weeks + 1) * (cellSize + gap) + 40; // Extra space for labels
  const svgHeight = 7 * (cellSize + gap) + 30; // Extra space for month labels

  const svg = wrapper.createSvg('svg', {
    attr: {
      width: svgWidth.toString(),
      height: svgHeight.toString(),
      viewBox: `0 0 ${svgWidth} ${svgHeight}`,
    },
  });

  // Add month labels
  if (showLabels) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let currentMonth = -1;

    for (let week = 0; week < weeks; week++) {
      const weekDate = new Date(startDate);
      weekDate.setDate(weekDate.getDate() + (week * 7));

      if (weekDate.getMonth() !== currentMonth) {
        currentMonth = weekDate.getMonth();
        const x = week * (cellSize + gap) + 40;
        const text = svg.createSvg('text', {
          attr: {
            x: x.toString(),
            y: '12',
            fill: 'var(--db-text-muted)',
            'font-size': '10',
            'font-family': 'sans-serif',
          },
        });
        text.textContent = months[currentMonth] ?? '';
      }
    }
  }

  // Add day labels
  if (showLabels) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let day = 0; day < 7; day++) {
      if (day % 2 === 1) { // Show every other day
        const y = day * (cellSize + gap) + 25;
        const text = svg.createSvg('text', {
          attr: {
            x: '0',
            y: (y + cellSize).toString(),
            fill: 'var(--db-text-muted)',
            'font-size': '10',
            'font-family': 'sans-serif',
          },
        });
        text.textContent = days[day] ?? '';
      }
    }
  }

  // Render cells
  for (let week = 0; week < weeks; week++) {
    for (let day = 0; day < 7; day++) {
      const cellDate = new Date(startDate);
      cellDate.setDate(cellDate.getDate() + (week * 7) + day);

      // Skip future dates
      if (cellDate > today) continue;

      const dateStr = formatDate(cellDate);
      const count = dataMap.get(dateStr) || 0;
      const color = getColor(count, maxCount, colorScheme);

      const x = week * (cellSize + gap) + 40;
      const y = day * (cellSize + gap) + 20;

      const rect = svg.createSvg('rect', {
        attr: {
          x: x.toString(),
          y: y.toString(),
          width: cellSize.toString(),
          height: cellSize.toString(),
          rx: '2',
          ry: '2',
          fill: color,
          'data-date': dateStr,
          'data-count': count.toString(),
        },
      });

      // Add tooltip
      const title = svg.createSvg('title');
      title.textContent = `${dateStr}: ${count} ${count === 1 ? 'note' : 'notes'}`;
      rect.appendChild(title);
    }
  }

  // Add legend
  if (showLegend) {
    const legendX = 40;
    const legendY = 7 * (cellSize + gap) + 25;

    const legendGroup = svg.createSvg('g', {
      attr: {
        transform: `translate(${legendX}, ${legendY})`,
      },
    });

    // Less label
    const lessText = legendGroup.createSvg('text', {
      attr: {
        x: '0',
        y: cellSize.toString(),
        fill: 'var(--db-text-muted)',
        'font-size': '10',
        'font-family': 'sans-serif',
      },
    });
    lessText.textContent = 'Less';

    // Legend cells
    const colors = COLOR_SCHEMES[colorScheme];
    for (let i = 0; i < colors.length; i++) {
      const x = 30 + i * (cellSize + gap);
      legendGroup.createSvg('rect', {
        attr: {
          x: x.toString(),
          y: '0',
          width: cellSize.toString(),
          height: cellSize.toString(),
          rx: '2',
          ry: '2',
          fill: colors[i] ?? '#ebedf0',
        },
      });
    }

    // More label
    const moreText = legendGroup.createSvg('text', {
      attr: {
        x: (30 + colors.length * (cellSize + gap)).toString(),
        y: cellSize.toString(),
        fill: 'var(--db-text-muted)',
        'font-size': '10',
        'font-family': 'sans-serif',
      },
    });
    moreText.textContent = 'More';
  }
}

/**
 * Generate heatmap data from file metadata
 */
export function generateHeatmapData(
  files: Array<{ created: number; modified: number }>,
  type: 'created' | 'modified' = 'created'
): HeatmapData[] {
  const counts = new Map<string, number>();

  for (const file of files) {
    const timestamp = type === 'created' ? file.created : file.modified;
    const date = new Date(timestamp);
    const dateStr = formatDate(date);
    counts.set(dateStr, (counts.get(dateStr) || 0) + 1);
  }

  return Array.from(counts.entries()).map(([date, count]) => ({
    date,
    count,
  }));
}
