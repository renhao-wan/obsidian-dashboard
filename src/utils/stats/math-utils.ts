/**
 * Math utilities for stats module
 */

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
 * Calculate percentage with optional decimal places
 */
export function calculatePercentage(value: number, total: number, decimals: number = 1): number {
  if (total === 0) return 0;
  const percentage = (value / total) * 100;
  const factor = Math.pow(10, decimals);
  return Math.round(percentage * factor) / factor;
}

