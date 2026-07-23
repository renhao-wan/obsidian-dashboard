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
