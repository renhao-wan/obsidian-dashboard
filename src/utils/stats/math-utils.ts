/**
 * Math utilities for stats module
 */

/**
 * Calculate percentage
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

/**
 * Group array items by key function
 */
export function groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const key = keyFn(item);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

/**
 * Sum array items by value function
 */
export function sumBy<T>(array: T[], valueFn: (item: T) => number): number {
  return array.reduce((sum, item) => sum + valueFn(item), 0);
}

/**
 * Sort array by key function
 */
export function sortBy<T>(array: T[], keyFn: (item: T) => number, desc = false): T[] {
  return [...array].sort((a, b) => {
    const aVal = keyFn(a);
    const bVal = keyFn(b);
    return desc ? bVal - aVal : aVal - bVal;
  });
}

/**
 * Check if timestamp is today
 */
export function isToday(timestamp: number): boolean {
  const today = new Date();
  const date = new Date(timestamp);
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

/**
 * Check if timestamp is this week
 */
export function isThisWeek(timestamp: number): boolean {
  const now = new Date();
  const date = new Date(timestamp);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  return date >= startOfWeek;
}

/**
 * Calculate average
 */
export function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((a, b) => a + b, 0);
  return sum / values.length;
}

/**
 * Calculate median
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    const left = sorted[middle - 1] ?? 0;
    const right = sorted[middle] ?? 0;
    return (left + right) / 2;
  }

  return sorted[middle] ?? 0;
}

/**
 * Calculate standard deviation
 */
export function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;

  const avg = calculateAverage(values);
  const squareDiffs = values.map(value => {
    const diff = value - avg;
    return diff * diff;
  });

  const avgSquareDiff = calculateAverage(squareDiffs);
  return Math.sqrt(avgSquareDiff);
}

/**
 * Calculate min and max
 */
export function getMinMax(values: number[]): { min: number; max: number } {
  if (values.length === 0) {
    return { min: 0, max: 0 };
  }

  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

/**
 * Calculate growth rate (percentage change)
 */
export function calculateGrowthRate(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
}

/**
 * Calculate moving average
 */
export function calculateMovingAverage(values: number[], windowSize: number): number[] {
  if (values.length === 0 || windowSize <= 0) {
    return [];
  }

  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const window = values.slice(start, i + 1);
    result.push(calculateAverage(window));
  }

  return result;
}

/**
 * Normalize values to 0-1 range
 */
export function normalizeValues(values: number[]): number[] {
  if (values.length === 0) {
    return [];
  }

  const { min, max } = getMinMax(values);
  const range = max - min;

  if (range === 0) {
    return values.map(() => 0.5);
  }

  return values.map(v => (v - min) / range);
}

/**
 * Format number with commas
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Format number to compact form (K, M, etc.)
 */
export function formatCompactNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

/**
 * Round to specified decimal places
 */
export function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
