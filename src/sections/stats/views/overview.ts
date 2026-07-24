import type { OverviewStats, StatsRuntimeConfig, FileMetadata } from '../types';
import { renderPieChart, renderStatCard, renderSizeDistributionChart, renderDepthDistributionChart, getChartColor } from '../../../components/stats/charts';
import { renderHeatmap, generateHeatmapData } from '../../../components/stats/heatmap';
import { renderTimeline, generateTimelineData } from '../../../components/stats/timeline';
import { renderTagCloud, renderKeywordCloud, renderContentStats, renderWordLengthDistribution } from '../../../components/stats/content-analysis';
import type { TagData, KeywordData, ContentStats, WordLengthDistribution } from '../../../components/stats/content-analysis';
import { formatFileSize } from '../../../utils/stats/file-utils';
import { t } from '../../../utils/i18n';
import { setIcon } from 'obsidian';

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

  // Render stat cards (always visible)
  const cardsContainer = container.createDiv({ cls: 'stats-cards' });
  renderStatCard(cardsContainer, t('stats.totalNotes'), stats.totalFiles, undefined, 'file-text');
  renderStatCard(cardsContainer, t('stats.totalSize'), formatFileSize(stats.totalSize), undefined, 'hard-drive');
  renderStatCard(cardsContainer, t('stats.todayCreated'), stats.todayCreated, undefined, 'calendar-plus');
  renderStatCard(cardsContainer, t('stats.thisWeek'), stats.weekCreated, undefined, 'calendar-range');

  // Create tab container
  const tabContainer = container.createDiv({ cls: 'stats-tabs' });

  // Tab header
  const tabHeader = tabContainer.createDiv({ cls: 'stats-tab-header' });

  const tabs = [
    { id: 'overview', label: t('stats.tabOverview') || '概览', icon: 'pie-chart' },
    { id: 'activity', label: t('stats.tabActivity') || '活动', icon: 'activity' },
    { id: 'analysis', label: t('stats.tabAnalysis') || '分析', icon: 'file-text' },
  ];

  let activeTab = 'overview';

  // Tab content containers
  const tabContents: Record<string, HTMLElement> = {};

  // Create tab buttons
  for (const tab of tabs) {
    const btn = tabHeader.createDiv({ cls: 'stats-tab-btn' });
    if (tab.id === activeTab) btn.addClass('stats-tab-btn--active');

    const iconEl = btn.createSpan({ cls: 'stats-tab-btn-icon' });
    setIcon(iconEl, tab.icon);
    btn.createSpan({ text: tab.label, cls: 'stats-tab-btn-label' });

    // Create content container
    tabContents[tab.id] = tabContainer.createDiv({
      cls: `stats-tab-content ${tab.id === activeTab ? 'stats-tab-content--active' : ''}`
    });

    // Click handler
    btn.addEventListener('click', () => {
      // Update active state
      tabHeader.querySelectorAll('.stats-tab-btn').forEach(b => b.removeClass('stats-tab-btn--active'));
      btn.addClass('stats-tab-btn--active');

      // Show/hide content
      Object.values(tabContents).forEach(c => c.removeClass('stats-tab-content--active'));
      tabContents[tab.id]?.addClass('stats-tab-content--active');

      activeTab = tab.id;
    });
  }

  // Tab 1: Overview - Pie chart (left) + Distribution selector (right)
  const overviewContent = tabContents['overview'];
  if (overviewContent) {
    const overviewLayout = overviewContent.createDiv({ cls: 'stats-overview-layout' });

    // Left: File type distribution pie chart
    const leftColumn = overviewLayout.createDiv({ cls: 'stats-overview-left' });
    if (stats.fileTypeStats.length > 0) {
      renderPieChart(leftColumn, stats.fileTypeStats, t('stats.fileTypeDistribution'), 'pie-chart');
    } else {
      const placeholder = leftColumn.createDiv({ cls: 'stats-chart-placeholder' });
      placeholder.createDiv({ text: t('stats.noData') || 'No file type data available', cls: 'stats-chart-placeholder-text' });
    }

    // Right: Distribution chart with selector
    const rightColumn = overviewLayout.createDiv({ cls: 'stats-overview-right' });

    // Selector dropdown (outside chart wrapper)
    const selectorContainer = rightColumn.createDiv({ cls: 'stats-chart-header' });
    const selector = selectorContainer.createEl('select', { cls: 'stats-distribution-select' });
    const options = [
      { value: 'word', label: t('stats.wordDistribution') || '字数分布' },
      { value: 'size', label: t('stats.sizeDistribution') || '文件大小分布' },
      { value: 'depth', label: t('stats.depthDistribution') || '文件夹深度分布' },
    ];
    for (const opt of options) {
      const optionEl = selector.createEl('option', { value: opt.value, text: opt.label });
      if (opt.value === 'word') optionEl.selected = true;
    }

    // Container for the selected chart
    const distContainer = rightColumn.createDiv({ cls: 'stats-distribution-container' });

    // Render the selected distribution
    const renderDistribution = async (type: string): Promise<void> => {
      distContainer.empty();

      if (type === 'word' && contentData && contentData.wordDistribution.length > 0) {
        const wordColors = contentData.wordDistribution.map((_, i) => getChartColor(i));
        await renderWordLengthDistribution(distContainer, contentData.wordDistribution, t('stats.wordDistribution') || '字数分布', wordColors);
      } else if (type === 'size' && stats.sizeDistribution && stats.sizeDistribution.length > 0) {
        renderSizeDistributionChart(distContainer, stats.sizeDistribution, t('stats.sizeDistribution') || '文件大小分布', 'hard-drive');
      } else if (type === 'depth' && stats.depthDistribution && stats.depthDistribution.length > 0) {
        renderDepthDistributionChart(distContainer, stats.depthDistribution, t('stats.depthDistribution') || '文件夹深度分布', 'folder-tree');
      } else {
        distContainer.createDiv({ text: t('stats.noData') || 'No data available', cls: 'stats-chart-empty' });
      }
    };

    // Initial render
    await renderDistribution('word');

    // Selector change handler
    selector.addEventListener('change', async () => {
      await renderDistribution(selector.value);
      // Remove focus after selection
      selector.blur();
    });
  }

  // Tab 2: Activity - Heatmap + Timeline
  const activityContent = tabContents['activity'];
  if (activityContent && files && files.length > 0) {
    // Heatmap section
    const heatmapSection = activityContent.createDiv({ cls: 'stats-heatmap-section' });

    const createdData = generateHeatmapData(files, 'created');
    renderHeatmap(heatmapSection, createdData, t('stats.createdHeatmap') || 'Note Creation Activity', {
      weeks: 52,
      colorScheme: 'green',
    });

    const modifiedData = generateHeatmapData(files, 'modified');
    renderHeatmap(heatmapSection, modifiedData, t('stats.modifiedHeatmap') || 'Note Modification Activity', {
      weeks: 52,
      colorScheme: 'blue',
    });

    // Timeline section
    const timelineSection = activityContent.createDiv({ cls: 'stats-timeline-section' });
    timelineSection.createEl('h2', { text: t('stats.timelineTitle') || 'Timeline Statistics', cls: 'stats-section-title' });

    const createdTimeline = generateTimelineData(files, 'created', 30);
    renderTimeline(timelineSection, createdTimeline, t('stats.createdTimeline') || 'Notes Created (Last 30 Days)', {
      type: 'line',
      height: 200,
    });

    const modifiedTimeline = generateTimelineData(files, 'modified', 30);
    renderTimeline(timelineSection, modifiedTimeline, t('stats.modifiedTimeline') || 'Notes Modified (Last 30 Days)', {
      type: 'bar',
      height: 200,
    });
  }

  // Tab 3: Analysis - Content analysis (without word distribution, moved to Overview)
  const analysisContent = tabContents['analysis'];
  if (analysisContent) {
    if (contentData) {
      try {
        const contentSection = analysisContent.createDiv({ cls: 'stats-content-section' });

        await renderContentStats(contentSection, contentData.contentStats, t('stats.contentStats') || 'Content Statistics');

        if (contentData.tags.length > 0) {
          await renderTagCloud(contentSection, contentData.tags, t('stats.tagCloud') || 'Tag Cloud', 30);
        }

        if (contentData.keywords.length > 0) {
          await renderKeywordCloud(contentSection, contentData.keywords, t('stats.keywordCloud') || 'Keyword Cloud', 30);
        }
      } catch (err) {
        console.error('[Stats] Content analysis render failed:', err);
        const placeholder = analysisContent.createDiv({ cls: 'stats-chart-placeholder' });
        placeholder.createDiv({ text: t('stats.noData') || 'No data available', cls: 'stats-chart-placeholder-text' });
      }
    } else {
      const placeholder = analysisContent.createDiv({ cls: 'stats-chart-placeholder' });
      placeholder.createDiv({ text: t('stats.noData') || 'No data available', cls: 'stats-chart-placeholder-text' });
    }
  }
}
