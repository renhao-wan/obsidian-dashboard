/**
 * Stats charts component
 * Provides reusable chart rendering utilities for statistics visualization
 */

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface BarChartOptions {
  width?: number;
  height?: number;
  showValues?: boolean;
  showLabels?: boolean;
  orientation?: 'horizontal' | 'vertical';
}

export interface PieChartOptions {
  size?: number;
  showLegend?: boolean;
  showPercentages?: boolean;
}

/**
 * Render a simple bar chart using HTML/CSS
 */
export function renderBarChart(
  container: HTMLElement,
  data: ChartDataPoint[],
  options: BarChartOptions = {}
): void {
  const {
    width = 300,
    height = 200,
    showValues = true,
    showLabels = true,
    orientation = 'vertical',
  } = options;

  const chartContainer = container.createDiv({ cls: 'stats-bar-chart' });
  chartContainer.style.width = `${width}px`;
  chartContainer.style.height = `${height}px`;

  const maxValue = Math.max(...data.map(d => d.value), 1);

  if (orientation === 'vertical') {
    renderVerticalBarChart(chartContainer, data, maxValue, height, showValues, showLabels);
  } else {
    renderHorizontalBarChart(chartContainer, data, maxValue, width, showValues, showLabels);
  }
}

function renderVerticalBarChart(
  container: HTMLElement,
  data: ChartDataPoint[],
  maxValue: number,
  height: number,
  showValues: boolean,
  showLabels: boolean
): void {
  const barsContainer = container.createDiv({ cls: 'stats-bars-vertical' });

  for (const point of data) {
    const barWrapper = barsContainer.createDiv({ cls: 'stats-bar-wrapper' });
    const barHeight = (point.value / maxValue) * (height - 40);
    const bar = barWrapper.createDiv({ cls: 'stats-bar' });
    bar.style.height = `${barHeight}px`;
    bar.style.backgroundColor = point.color || 'var(--db-accent)';

    if (showValues) {
      barWrapper.createDiv({ cls: 'stats-bar-value', text: point.value.toString() });
    }

    if (showLabels) {
      barWrapper.createDiv({ cls: 'stats-bar-label', text: point.label });
    }
  }
}

function renderHorizontalBarChart(
  container: HTMLElement,
  data: ChartDataPoint[],
  maxValue: number,
  width: number,
  showValues: boolean,
  showLabels: boolean
): void {
  const barsContainer = container.createDiv({ cls: 'stats-bars-horizontal' });

  for (const point of data) {
    const barWrapper = barsContainer.createDiv({ cls: 'stats-hbar-wrapper' });

    if (showLabels) {
      barWrapper.createDiv({ cls: 'stats-hbar-label', text: point.label });
    }

    const barContainer = barWrapper.createDiv({ cls: 'stats-hbar-container' });
    const barWidth = (point.value / maxValue) * (width - 100);
    const bar = barContainer.createDiv({ cls: 'stats-hbar' });
    bar.style.width = `${barWidth}px`;
    bar.style.backgroundColor = point.color || 'var(--db-accent)';

    if (showValues) {
      barWrapper.createDiv({ cls: 'stats-hbar-value', text: point.value.toString() });
    }
  }
}

/**
 * Render a simple donut/pie chart using SVG
 */
export function renderDonutChart(
  container: HTMLElement,
  data: ChartDataPoint[],
  options: PieChartOptions = {}
): void {
  const {
    size = 200,
    showLegend = true,
    showPercentages = true,
  } = options;

  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return;

  const chartContainer = container.createDiv({ cls: 'stats-donut-chart' });

  // Create SVG
  const svg = chartContainer.createSvg('svg', {
    attr: {
      width: size.toString(),
      height: size.toString(),
      viewBox: `0 0 ${size} ${size}`,
    },
  });

  const center = size / 2;
  const radius = size / 2 - 10;
  let currentAngle = -Math.PI / 2;

  const defaultColors = [
    'var(--db-accent)',
    'var(--db-accent-secondary, #6366f1)',
    'var(--db-accent-tertiary, #8b5cf6)',
    'var(--db-success, #22c55e)',
    'var(--db-warning, #f59e0b)',
    'var(--db-danger, #ef4444)',
  ];

  data.forEach((point, index) => {
    const sliceAngle = (point.value / total) * 2 * Math.PI;
    const x1 = center + radius * Math.cos(currentAngle);
    const y1 = center + radius * Math.sin(currentAngle);
    const x2 = center + radius * Math.cos(currentAngle + sliceAngle);
    const y2 = center + radius * Math.sin(currentAngle + sliceAngle);

    const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;

    const path = svg.createSvg('path', {
      attr: {
        d: `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`,
        fill: point.color || defaultColors[index % defaultColors.length] || '#6366f1',
      },
    });

    currentAngle += sliceAngle;
  });

  // Add center circle for donut effect
  svg.createSvg('circle', {
    attr: {
      cx: center.toString(),
      cy: center.toString(),
      r: (radius * 0.6).toString(),
      fill: 'var(--db-bg-card, rgba(255, 255, 255, 0.06))',
    },
  });

  // Add legend
  if (showLegend) {
    const legend = chartContainer.createDiv({ cls: 'stats-chart-legend' });
    data.forEach((point, index) => {
      const legendItem = legend.createDiv({ cls: 'stats-legend-item' });
      const colorBox = legendItem.createDiv({ cls: 'stats-legend-color' });
      colorBox.style.backgroundColor = point.color || defaultColors[index % defaultColors.length] || '#6366f1';
      legendItem.createSpan({ cls: 'stats-legend-label', text: point.label });

      if (showPercentages) {
        const percentage = ((point.value / total) * 100).toFixed(1);
        legendItem.createSpan({ cls: 'stats-legend-value', text: `${percentage}%` });
      }
    });
  }
}
