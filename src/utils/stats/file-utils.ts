/**
 * File utilities for stats module
 */
import type { FileTypeConfig } from '../../sections/stats/types';

/**
 * Check if a file should be included based on extension and exclude patterns
 */
export function shouldIncludeFile(
  filePath: string,
  config: FileTypeConfig
): boolean {
  // Check if file extension is enabled
  const extension = getFileExtension(filePath);
  if (!config.extensions.includes(extension)) {
    return false;
  }

  // Check if file matches exclude patterns
  for (const pattern of config.excludePatterns) {
    if (filePath.includes(pattern)) {
      return false;
    }
  }

  return true;
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
