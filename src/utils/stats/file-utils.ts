/**
 * File utilities for stats module
 */

/**
 * Get file extension from path
 */
export function getFileExtension(path: string): string {
  const parts = path.split('.');
  if (parts.length <= 1) return '';
  return parts.pop()?.toLowerCase() || '';
}

/**
 * Get file name without extension
 */
export function getFileNameWithoutExtension(path: string): string {
  const name = path.split('/').pop() || '';
  const lastDot = name.lastIndexOf('.');
  return lastDot > 0 ? name.substring(0, lastDot) : name;
}

/**
 * Get folder path from file path
 */
export function getFolderPath(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  return lastSlash > 0 ? path.substring(0, lastSlash) : '';
}

/**
 * Check if path matches any exclude pattern
 */
export function matchesExcludePattern(path: string, patterns: string[]): boolean {
  return patterns.some(pattern => path.includes(pattern));
}

/**
 * Format file size to human readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Check if a file is created today
 */
export function isCreatedToday(createdTimestamp: number): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return createdTimestamp >= today.getTime();
}

/**
 * Check if a file is created this week
 */
export function isCreatedThisWeek(createdTimestamp: number): boolean {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - dayOfWeek);
  startOfWeek.setHours(0, 0, 0, 0);
  return createdTimestamp >= startOfWeek.getTime();
}

/**
 * Check if a file is created this month
 */
export function isCreatedThisMonth(createdTimestamp: number): boolean {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return createdTimestamp >= startOfMonth.getTime();
}

/**
 * Get date string from timestamp (YYYY-MM-DD format)
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Group files by date
 */
export function groupFilesByDate(files: Array<{ created: number }>): Map<string, number> {
  const groups = new Map<string, number>();

  for (const file of files) {
    const date = formatDate(file.created);
    groups.set(date, (groups.get(date) || 0) + 1);
  }

  return groups;
}

/**
 * Group files by extension
 */
export function groupFilesByExtension(files: Array<{ extension: string }>): Map<string, number> {
  const groups = new Map<string, number>();

  for (const file of files) {
    const ext = file.extension || 'unknown';
    groups.set(ext, (groups.get(ext) || 0) + 1);
  }

  return groups;
}
