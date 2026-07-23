/**
 * File utilities for stats module
 */

/**
 * Check if a file should be included based on extension
 */
export function shouldIncludeFile(
  filePath: string,
  extensions: string[]
): boolean {
  const extension = getFileExtension(filePath);
  return extensions.includes(extension);
}

/**
 * Get file extension from path (includes the dot, e.g., ".md")
 */
export function getFileExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.');
  if (lastDot === -1) {
    return '';
  }
  return filePath.slice(lastDot).toLowerCase();
}

/**
 * Get file name from path (with extension)
 */
export function getFileName(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1] || '';
}

/**
 * Get folder path from file path
 */
export function getFolder(filePath: string): string {
  const parts = filePath.split('/');
  if (parts.length <= 1) {
    return '';
  }
  return parts.slice(0, -1).join('/');
}

/**
 * Format file size to human readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
 * @param createdTimestamp - The timestamp to check
 * @param weekStartsOnMonday - Whether week starts on Monday (ISO 8601) or Sunday (default: true)
 */
export function isCreatedThisWeek(createdTimestamp: number, weekStartsOnMonday: boolean = true): boolean {
  const now = new Date();
  const dayOfWeek = now.getDay();

  // Calculate days to subtract to get to the start of the week
  // Sunday = 0, Monday = 1, ..., Saturday = 6
  let daysToSubtract: number;
  if (weekStartsOnMonday) {
    // ISO 8601: Monday is day 1, Sunday is day 7
    daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  } else {
    // US convention: Sunday is day 0
    daysToSubtract = dayOfWeek;
  }

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - daysToSubtract);
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
