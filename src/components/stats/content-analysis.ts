/**
 * Content analysis component for stats module
 * Renders tag clouds, keyword clouds, and content statistics
 */

import { setIcon } from 'obsidian';
import { t } from '../../utils/i18n';

export interface TagData {
  tag: string;
  count: number;
}

export interface KeywordData {
  keyword: string;
  count: number;
}

export interface ContentStats {
  totalWords: number;
  totalCharacters: number;
  averageWordsPerNote: number;
  longestNote: { path: string; words: number };
  shortestNote: { path: string; words: number };
}

export interface WordLengthDistribution {
  range: string; // e.g., "0-100", "101-500", etc.
  count: number;
}

/**
 * Extract tags from file content
 * Tags are in the format #tag or [[tag]]
 */
export function extractTags(content: string): string[] {
  const tags: string[] = [];

  // Match #tag format
  const hashtagRegex = /#([a-zA-Z0-9_\-/]+)/g;
  let match;
  while ((match = hashtagRegex.exec(content)) !== null) {
    if (match[1]) {
      tags.push(match[1].toLowerCase());
    }
  }

  // Match [[tag]] format (wiki links)
  const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
  while ((match = wikiLinkRegex.exec(content)) !== null) {
    if (match[1]) {
      // Extract the display text if it exists, otherwise use the full link
      const displayText = match[1].includes('|') ? match[1].split('|')[1] : match[1];
      if (displayText) {
        tags.push(displayText.toLowerCase().trim());
      }
    }
  }

  return tags;
}

/**
 * Extract keywords from content (simple word frequency analysis)
 * Excludes common stop words
 */
export function extractKeywords(content: string, maxKeywords: number = 50): KeywordData[] {
  // Common stop words to exclude
  const stopWords = new Set([
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
    'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
    'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
    'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
    'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
    'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take',
    'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see',
    'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over',
    'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work',
    'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these',
    'give', 'day', 'most', 'us', 'is', 'was', 'are', 'were', 'been', 'has',
    'had', 'did', 'does', 'doing', 'am', 'being', 'have', 'having', 'do',
    'doing', 'did', 'does', 'will', 'would', 'shall', 'should', 'may',
    'might', 'must', 'can', 'could', 'need', 'dare', 'ought', 'used',
    '的', '了', '在', '是', '我', '有', '和', '就', '不', '人',
    '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去',
    '你', '会', '着', '没有', '看', '好', '自己', '这', '他', '她',
    '它', '们', '那', '里', '为', '什么', '怎么', '如何', '为什么',
    '可以', '可能', '应该', '需要', '必须', '能够', '可以', '会',
  ]);

  // Clean content and split into words
  const cleanContent = content
    .replace(/[^\w\s一-鿿]/g, ' ') // Keep Chinese characters
    .replace(/\s+/g, ' ')
    .trim();

  // Split by spaces and Chinese characters
  const words = cleanContent.split(/[\s]+/).filter(word => {
    if (word.length < 2) return false;
    if (stopWords.has(word.toLowerCase())) return false;
    return true;
  });

  // Count word frequency
  const wordCount = new Map<string, number>();
  for (const word of words) {
    const lowerWord = word.toLowerCase();
    wordCount.set(lowerWord, (wordCount.get(lowerWord) || 0) + 1);
  }

  // Sort by frequency and return top keywords
  return Array.from(wordCount.entries())
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, maxKeywords);
}

/**
 * Calculate content statistics
 */
export function calculateContentStats(
  files: Array<{ path: string; content: string }>
): ContentStats {
  let totalWords = 0;
  let totalCharacters = 0;
  let longestNote = { path: '', words: 0 };
  let shortestNote = { path: '', words: Infinity };

  for (const file of files) {
    const words = file.content.split(/\s+/).filter(w => w.length > 0).length;
    const characters = file.content.length;

    totalWords += words;
    totalCharacters += characters;

    if (words > longestNote.words) {
      longestNote = { path: file.path, words };
    }

    if (words < shortestNote.words && words > 0) {
      shortestNote = { path: file.path, words };
    }
  }

  // Handle edge case where no files have content
  if (shortestNote.words === Infinity) {
    shortestNote = { path: '', words: 0 };
  }

  return {
    totalWords,
    totalCharacters,
    averageWordsPerNote: files.length > 0 ? Math.round(totalWords / files.length) : 0,
    longestNote,
    shortestNote,
  };
}

/**
 * Calculate word length distribution
 */
export function calculateWordLengthDistribution(
  files: Array<{ content: string }>
): WordLengthDistribution[] {
  const ranges = [
    { min: 0, max: 100, label: '0-100' },
    { min: 101, max: 500, label: '101-500' },
    { min: 501, max: 1000, label: '501-1000' },
    { min: 1001, max: 5000, label: '1001-5000' },
    { min: 5001, max: Infinity, label: '5000+' },
  ];

  const distribution = ranges.map(range => ({
    range: range.label,
    count: 0,
  }));

  for (const file of files) {
    const words = file.content.split(/\s+/).filter(w => w.length > 0).length;

    for (let i = 0; i < ranges.length; i++) {
      const range = ranges[i];
      const dist = distribution[i];
      if (range && dist && words >= range.min && words <= range.max) {
        dist.count++;
        break;
      }
    }
  }

  return distribution;
}

/**
 * Render a tag cloud
 */
export async function renderTagCloud(
  container: HTMLElement,
  tags: TagData[],
  title: string,
  maxTags: number = 30
): Promise<void> {
  
  const wrapper = container.createDiv({ cls: 'stats-tag-cloud-wrapper' });

  // Create title with icon
  const titleEl = wrapper.createEl('h3', { cls: 'stats-tag-cloud-title' });
  const iconEl = titleEl.createSpan({ cls: 'stats-tag-cloud-title-icon' });
  setIcon(iconEl, 'tags');
  titleEl.createSpan({ text: title });

  if (tags.length === 0) {
    wrapper.createDiv({ text: t('stats.noData') || 'No tags found', cls: 'stats-chart-empty' });
    return;
  }

  // Sort by count and take top tags
  const sortedTags = [...tags]
    .sort((a, b) => b.count - a.count)
    .slice(0, maxTags);

  const maxCount = sortedTags[0]?.count || 1;
  const minCount = sortedTags[sortedTags.length - 1]?.count || 1;

  // Create tag cloud
  const cloudContainer = wrapper.createDiv({ cls: 'stats-tag-cloud' });

  for (const tag of sortedTags) {
    const tagEl = cloudContainer.createSpan({ cls: 'stats-tag-cloud-item' });

    // Calculate font size based on count (12px to 24px)
    const ratio = maxCount > minCount ? (tag.count - minCount) / (maxCount - minCount) : 0.5;
    const fontSize = 12 + ratio * 12;
    tagEl.style.fontSize = `${fontSize}px`;

    // Calculate opacity based on count (0.6 to 1)
    const opacity = 0.6 + ratio * 0.4;
    tagEl.style.opacity = opacity.toString();

    tagEl.textContent = tag.tag;

    // Add tooltip
    tagEl.title = `${tag.tag}: ${tag.count}`;
  }
}

/**
 * Render a keyword cloud
 */
export async function renderKeywordCloud(
  container: HTMLElement,
  keywords: KeywordData[],
  title: string,
  maxKeywords: number = 30
): Promise<void> {
  
  const wrapper = container.createDiv({ cls: 'stats-keyword-cloud-wrapper' });

  // Create title with icon
  const titleEl = wrapper.createEl('h3', { cls: 'stats-keyword-cloud-title' });
  const iconEl = titleEl.createSpan({ cls: 'stats-keyword-cloud-title-icon' });
  setIcon(iconEl, 'search');
  titleEl.createSpan({ text: title });

  if (keywords.length === 0) {
    wrapper.createDiv({ text: t('stats.noData') || 'No keywords found', cls: 'stats-chart-empty' });
    return;
  }

  // Sort by count and take top keywords
  const sortedKeywords = [...keywords]
    .sort((a, b) => b.count - a.count)
    .slice(0, maxKeywords);

  const maxCount = sortedKeywords[0]?.count || 1;
  const minCount = sortedKeywords[sortedKeywords.length - 1]?.count || 1;

  // Create keyword cloud
  const cloudContainer = wrapper.createDiv({ cls: 'stats-keyword-cloud' });

  for (const keyword of sortedKeywords) {
    const keywordEl = cloudContainer.createSpan({ cls: 'stats-keyword-cloud-item' });

    // Calculate font size based on count (12px to 20px)
    const ratio = maxCount > minCount ? (keyword.count - minCount) / (maxCount - minCount) : 0.5;
    const fontSize = 12 + ratio * 8;
    keywordEl.style.fontSize = `${fontSize}px`;

    // Calculate opacity based on count (0.6 to 1)
    const opacity = 0.6 + ratio * 0.4;
    keywordEl.style.opacity = opacity.toString();

    keywordEl.textContent = keyword.keyword;

    // Add tooltip
    keywordEl.title = `${keyword.keyword}: ${keyword.count}`;
  }
}

/**
 * Render content statistics
 */
export async function renderContentStats(
  container: HTMLElement,
  stats: ContentStats,
  title: string
): Promise<void> {
  
  const wrapper = container.createDiv({ cls: 'stats-content-stats-wrapper' });

  // Create title with icon
  const titleEl = wrapper.createEl('h3', { cls: 'stats-content-stats-title' });
  const iconEl = titleEl.createSpan({ cls: 'stats-content-stats-title-icon' });
  setIcon(iconEl, 'file-text');
  titleEl.createSpan({ text: title });

  // Create stats grid
  const statsGrid = wrapper.createDiv({ cls: 'stats-content-stats-grid' });

  // Total words
  const totalWordsCard = statsGrid.createDiv({ cls: 'stats-content-stat-card' });
  totalWordsCard.createDiv({ text: stats.totalWords.toLocaleString(), cls: 'stats-content-stat-value' });
  totalWordsCard.createDiv({ text: t('stats.totalWords') || 'Total Words', cls: 'stats-content-stat-label' });

  // Total characters
  const totalCharsCard = statsGrid.createDiv({ cls: 'stats-content-stat-card' });
  totalCharsCard.createDiv({ text: stats.totalCharacters.toLocaleString(), cls: 'stats-content-stat-value' });
  totalCharsCard.createDiv({ text: t('stats.totalCharacters') || 'Total Characters', cls: 'stats-content-stat-label' });

  // Average words per note
  const avgWordsCard = statsGrid.createDiv({ cls: 'stats-content-stat-card' });
  avgWordsCard.createDiv({ text: stats.averageWordsPerNote.toLocaleString(), cls: 'stats-content-stat-value' });
  avgWordsCard.createDiv({ text: t('stats.avgWordsPerNote') || 'Avg Words/Note', cls: 'stats-content-stat-label' });

  // Longest note
  if (stats.longestNote.path) {
    const longestCard = statsGrid.createDiv({ cls: 'stats-content-stat-card stats-content-stat-card--wide' });
    longestCard.createDiv({ text: stats.longestNote.words.toLocaleString(), cls: 'stats-content-stat-value' });
    longestCard.createDiv({ text: t('stats.longestNote') || 'Longest Note', cls: 'stats-content-stat-label' });
    longestCard.createDiv({ text: stats.longestNote.path, cls: 'stats-content-stat-path' });
  }

  // Shortest note
  if (stats.shortestNote.path) {
    const shortestCard = statsGrid.createDiv({ cls: 'stats-content-stat-card stats-content-stat-card--wide' });
    shortestCard.createDiv({ text: stats.shortestNote.words.toLocaleString(), cls: 'stats-content-stat-value' });
    shortestCard.createDiv({ text: t('stats.shortestNote') || 'Shortest Note', cls: 'stats-content-stat-label' });
    shortestCard.createDiv({ text: stats.shortestNote.path, cls: 'stats-content-stat-path' });
  }
}

/**
 * Render word length distribution chart
 */
export async function renderWordLengthDistribution(
  container: HTMLElement,
  distribution: WordLengthDistribution[],
  title: string,
  colors?: string[]
): Promise<void> {
  const wrapper = container.createDiv({ cls: 'stats-chart-wrapper' });

  // Create title with icon
  const titleEl = wrapper.createEl('h3', { cls: 'stats-chart-title' });
  const iconEl = titleEl.createSpan({ cls: 'stats-chart-title-icon' });
  setIcon(iconEl, 'bar-chart-2');
  titleEl.createSpan({ text: title });

  if (distribution.length === 0) {
    wrapper.createDiv({ text: t('stats.noData') || 'No data available', cls: 'stats-chart-empty' });
    return;
  }

  const maxCount = Math.max(...distribution.map(d => d.count), 1);

  // Default colors if not provided
  const defaultColors = ['#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b'];

  // Create chart using the same progress style
  const chartContainer = wrapper.createDiv({ cls: 'stats-progress-chart' });

  distribution.forEach((item, index) => {
    const row = chartContainer.createDiv({ cls: 'stats-progress-row' });

    const label = row.createDiv({ cls: 'stats-progress-label' });
    label.textContent = item.range;

    const barContainer = row.createDiv({ cls: 'stats-progress-bar-bg' });
    const bar = barContainer.createDiv({ cls: 'stats-progress-bar-fill' });
    const percentage = (item.count / maxCount) * 100;
    bar.style.width = `${percentage}%`;
    bar.style.backgroundColor = colors?.[index] ?? defaultColors[index % defaultColors.length] ?? '#3498db';

    const value = row.createDiv({ cls: 'stats-progress-value' });
    value.textContent = item.count.toString();
  });
}
