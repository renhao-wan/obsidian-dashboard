import type { OverviewStats, StatsRuntimeConfig, FileMetadata } from '../types';
import { renderPieChart, renderBarChart, renderStatCard } from '../../../components/stats/charts';
import { renderHeatmap, generateHeatmapData } from '../../../components/stats/heatmap';
import { renderTimeline, generateTimelineData, calculateTrend } from '../../../components/stats/timeline';
import { renderTagCloud, renderKeywordCloud, renderContentStats, renderWordLengthDistribution } from '../../../components/stats/content-analysis';
import type { TagData, KeywordData, ContentStats, WordLengthDistribution } from '../../../components/stats/content-analysis';
import { formatFileSize } from '../../../utils/stats/file-utils';
import { t } from '../../../utils/i18n';

interface ContentAnalysisData {
  tags: TagData[];
  keywords: KeywordData[];
  contentStats: ContentStats;
  wordDistribution: WordLengthDistribution[];
}

export async function renderOverview(
  container: HTMLElement,
  stats: OverviewStats,
  settings: StatsRuntimeConfig,
  files?: FileMetadata[],
  contentData?: ContentAnalysisData
): Promise<void> {
  // Clear container
  container.empty();
  container.addClass('stats-overview');

  // Render stat cards
  const cardsContainer = container.createDiv({ cls: 'stats-cards' });
  renderStatCard(cardsContainer, t('stats.totalNotes'), stats.totalFiles, undefined, 'file-text');
  renderStatCard(cardsContainer, t('stats.totalSize'), formatFileSize(stats.totalSize), undefined, 'hard-drive');
  renderStatCard(cardsContainer, t('stats.todayCreated'), stats.todayCreated, undefined, 'calendar-plus');
  renderStatCard(cardsContainer, t('stats.thisWeek'), stats.weekCreated, undefined, 'calendar-range');

  // Render heatmap section
  if (files && files.length > 0) {
    const heatmapSection = container.createDiv({ cls: 'stats-heatmap-section' });

    // Created time heatmap
    const createdData = generateHeatmapData(files, 'created');
    renderHeatmap(heatmapSection, createdData, t('stats.createdHeatmap') || 'Note Creation Activity', {
      weeks: 52,
      colorScheme: 'green',
    });

    // Modified time heatmap
    const modifiedData = generateHeatmapData(files, 'modified');
    renderHeatmap(heatmapSection, modifiedData, t('stats.modifiedHeatmap') || 'Note Modification Activity', {
      weeks: 52,
      colorScheme: 'blue',
    });
  }

  // Render timeline section
  if (files && files.length > 0) {
    const timelineSection = container.createDiv({ cls: 'stats-timeline-section' });
    timelineSection.createEl('h2', { text: t('stats.timelineTitle') || 'Timeline Statistics', cls: 'stats-section-title' });

    // Created timeline (30 days)
    const createdTimeline = generateTimelineData(files, 'created', 30);
    const createdTrend = calculateTrend(createdTimeline);
    renderTimeline(timelineSection, createdTimeline, t('stats.createdTimeline') || 'Notes Created (Last 30 Days)', {
      type: 'line',
      height: 200,
    });

    // Trend summary
    const trendSummary = timelineSection.createDiv({ cls: 'stats-trend-summary' });
    const trendIcon = trendSummary.createSpan({ cls: 'stats-trend-icon' });
    const trendText = trendSummary.createSpan({ cls: 'stats-trend-text' });

    if (createdTrend.trend === 'up') {
      trendIcon.textContent = '↑';
      trendIcon.addClass('stats-trend-up');
      trendText.textContent = `${Math.abs(createdTrend.percentage).toFixed(1)}% increase`;
    } else if (createdTrend.trend === 'down') {
      trendIcon.textContent = '↓';
      trendIcon.addClass('stats-trend-down');
      trendText.textContent = `${Math.abs(createdTrend.percentage).toFixed(1)}% decrease`;
    } else {
      trendIcon.textContent = '→';
      trendIcon.addClass('stats-trend-stable');
      trendText.textContent = 'Stable';
    }

    // Modified timeline (30 days)
    const modifiedTimeline = generateTimelineData(files, 'modified', 30);
    renderTimeline(timelineSection, modifiedTimeline, t('stats.modifiedTimeline') || 'Notes Modified (Last 30 Days)', {
      type: 'bar',
      height: 200,
    });
  }

  // Render content analysis section
  if (contentData) {
    const contentSection = container.createDiv({ cls: 'stats-content-section' });
    contentSection.createEl('h2', { text: t('stats.contentTitle') || 'Content Analysis', cls: 'stats-section-title' });

    // Content statistics
    await renderContentStats(contentSection, contentData.contentStats, t('stats.contentStats') || 'Content Statistics');

    // Tag cloud
    if (contentData.tags.length > 0) {
      await renderTagCloud(contentSection, contentData.tags, t('stats.tagCloud') || 'Tag Cloud', 30);
    }

    // Keyword cloud
    if (contentData.keywords.length > 0) {
      await renderKeywordCloud(contentSection, contentData.keywords, t('stats.keywordCloud') || 'Keyword Cloud', 30);
    }

    // Word length distribution
    if (contentData.wordDistribution.length > 0) {
      await renderWordLengthDistribution(contentSection, contentData.wordDistribution, t('stats.wordDistribution') || 'Word Count Distribution');
    }
  }

  // Render charts section
  const chartsSection = container.createDiv({ cls: 'stats-charts-section' });
  chartsSection.createEl('h2', { text: t('stats.chartsTitle') || 'Statistics Charts', cls: 'stats-section-title' });

  const chartsContainer = chartsSection.createDiv({ cls: 'stats-charts' });

  // File type distribution pie chart
  if (stats.fileTypeStats.length > 0) {
    renderPieChart(chartsContainer, stats.fileTypeStats, t('stats.fileTypeDistribution'), 'pie-chart');
  } else {
    // Show placeholder when no data
    const placeholder = chartsContainer.createDiv({ cls: 'stats-chart-placeholder' });
    placeholder.createDiv({ text: t('stats.noData') || 'No file type data available', cls: 'stats-chart-placeholder-text' });
  }

  // Folder distribution bar chart
  if (stats.folderStats.length > 0) {
    renderBarChart(chartsContainer, stats.folderStats, t('stats.folderDistribution'), 10, 'folder-tree');
  } else {
    // Show placeholder when no data
    const placeholder = chartsContainer.createDiv({ cls: 'stats-chart-placeholder' });
    placeholder.createDiv({ text: t('stats.noData') || 'No folder data available', cls: 'stats-chart-placeholder-text' });
  }
}
