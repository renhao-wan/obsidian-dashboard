import { App } from 'obsidian';
import type { HoverParent } from 'obsidian';
import type { DashboardData, DashboardSettings, RenderCallbacks } from '../core/types';
import type { StatsSection } from '../sections/stats';
import { t } from '../utils/i18n';
import { destroyMediaSection } from '../sections/media';
import {
	setActiveHoverParent,
	setActiveNoteOpener,
} from './utils';
import { getSectionType } from './card-bodies';
import { renderSection } from './section';
import { setIcon } from 'obsidian';

// Re-export commonly used functions for backward compatibility
export { destroyAllCharts } from './utils';
export { renderTextWithLinks, getSectionType } from './card-bodies';
export { renderSection } from './section';
export {
	renderSidebarWidgets,
	renderSidebarWeekCalendar,
	refreshSidebarWeekCalendar,
	renderSidebarPomodoro,
	renderSidebarReading,
	renderSidebarCountdown,
} from './sidebar';

const SCANNING_SECTION_TYPES = new Set(['library', 'folder', 'calendar']);
const MEDIA_SECTION_TYPES = new Set(['images', 'videos']);

export function renderDashboard(
	container: HTMLElement,
	data: DashboardData,
	callbacks: RenderCallbacks,
	app: App,
	settings?: DashboardSettings,
	hoverParent: HoverParent | null = null,
	statsSection?: StatsSection,
): void {
	setActiveHoverParent(hoverParent);
	setActiveNoteOpener(callbacks.onOpenNoteInPopover ?? null);

	container.empty();
	container.addClass('dashboard-kanban');

	// If stats section is enabled, create tab container
	if (statsSection) {
		const tabContainer = container.createDiv({ cls: 'dashboard-content-tabs' });

		// Tab header
		const tabHeader = tabContainer.createDiv({ cls: 'dashboard-tab-header' });

		const tabs = [
			{ id: 'home', label: t('dashboard.tabHome') || '主页', icon: 'home' },
			{ id: 'stats', label: t('dashboard.tabStats') || '统计', icon: 'bar-chart-2' },
		];

		// Tab content containers
		const homeContent = tabContainer.createDiv({ cls: 'dashboard-tab-content dashboard-tab-content--active' });
		homeContent.setAttribute('data-tab', 'home');
		const statsContent = tabContainer.createDiv({ cls: 'dashboard-tab-content' });
		statsContent.setAttribute('data-tab', 'stats');

		// Create tab buttons
		for (const tab of tabs) {
			const btn = tabHeader.createDiv({ cls: 'dashboard-tab-btn' });
			if (tab.id === 'home') btn.addClass('dashboard-tab-btn--active');
			btn.setAttribute('data-tab-btn', tab.id);

			const iconEl = btn.createSpan({ cls: 'dashboard-tab-btn-icon' });
			setIcon(iconEl, tab.icon);
			btn.createSpan({ text: tab.label, cls: 'dashboard-tab-btn-label' });

			// Click handler
			btn.addEventListener('click', () => {
				// Update active state
				tabHeader.querySelectorAll('.dashboard-tab-btn').forEach(b => b.removeClass('dashboard-tab-btn--active'));
				btn.addClass('dashboard-tab-btn--active');

				// Show/hide content
				tabContainer.querySelectorAll('.dashboard-tab-content').forEach(c => c.removeClass('dashboard-tab-content--active'));
				const targetContent = tabContainer.querySelector(`.dashboard-tab-content[data-tab="${tab.id}"]`);
				if (targetContent) targetContent.addClass('dashboard-tab-content--active');
			});
		}

		// Render home content (columns)
		for (const column of data.columns) {
			const section = renderSection(column, callbacks, app, data, settings);
			homeContent.appendChild(section);
		}

		const addColBtn = homeContent.createDiv({ cls: 'dashboard-add-section' });
		addColBtn.setText(t('renderer.addSection'));
		addColBtn.setAttribute('role', 'button');
		addColBtn.addEventListener('click', () => {
			callbacks.onRequestAddSection();
		});

		// Render stats content
		statsSection.render(statsContent).catch(err => {
			console.error('Stats render failed:', err);
		});
	} else {
		// No stats section, render normally
		for (const column of data.columns) {
			const section = renderSection(column, callbacks, app, data, settings);
			container.appendChild(section);
		}

		const addColBtn = container.createDiv({ cls: 'dashboard-add-section' });
		addColBtn.setText(t('renderer.addSection'));
		addColBtn.setAttribute('role', 'button');
		addColBtn.addEventListener('click', () => {
			callbacks.onRequestAddSection();
		});
	}
}

/**
 * Re-render only the vault-scanning sections (library/folder/calendar)
 * in place, leaving media and card sections untouched. Used by the view's
 * vault-event debounce so editing a note no longer tears down the whole board
 * (and the media section's <video> thumbnails with it).
 */
export function refreshScanningSections(
	kanban: HTMLElement,
	data: DashboardData,
	callbacks: RenderCallbacks,
	app: App,
	settings: DashboardSettings | undefined,
	hoverParent: HoverParent | null,
): void {
	setActiveHoverParent(hoverParent);
	for (const column of data.columns) {
		if (!SCANNING_SECTION_TYPES.has(getSectionType(column))) continue;
		const oldEl = kanban.querySelector(`:scope > [data-column="${CSS.escape(column.name)}"]`);
		if (!oldEl) continue;
		const newEl = renderSection(column, callbacks, app, data, settings);
		oldEl.replaceWith(newEl);
	}
}

/**
 * Re-render only the media sections (images/videos) in place. Releases the old
 * sections' <video> decoders + lazy observers (via destroyMediaSection) before
 * swapping. Only invoked on structural vault changes (create/delete/rename),
 * never on plain note edits, so videos are not churned during normal editing.
 */
export function refreshMediaSections(
	kanban: HTMLElement,
	data: DashboardData,
	callbacks: RenderCallbacks,
	app: App,
	settings: DashboardSettings | undefined,
	hoverParent: HoverParent | null,
): void {
	setActiveHoverParent(hoverParent);
	for (const column of data.columns) {
		if (!MEDIA_SECTION_TYPES.has(getSectionType(column))) continue;
		const matched = kanban.querySelector(`:scope > [data-column="${CSS.escape(column.name)}"]`);
		if (!(matched instanceof HTMLElement)) continue;
		destroyMediaSection(matched);
		const newEl = renderSection(column, callbacks, app, data, settings);
		matched.replaceWith(newEl);
	}
}
