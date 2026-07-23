import { setIcon, TFile } from 'obsidian';
import type { App } from 'obsidian';
import type DashboardPlugin from './main';
import type { DashboardData, QuickAction, BannerData, LibraryConfig } from './types';
import type { SyncEngine } from '../data/sync';
import { renderSidebarWidgets, renderSidebarWeekCalendar, renderSidebarPomodoro, renderSidebarReading, renderSection } from '../renderers/dashboard';
import { resolveVaultImage } from '../renderers/banner';
import { getRecentDocs, renderRecentDocs } from '../components/recent';
import { renderQuickActions } from '../components/quick-actions';
import { setupDragAndDrop } from '../utils/dnd';
import { showConfirmDialog } from '../components/confirm-dialog';
import { renderSidebarLunarWidget } from '../modals/lunar';
import type { HolidayInfo } from '../services/holiday';
import type { PomodoroService } from '../services/pomodoro';
import type { ReadingService } from '../services/reading';
import { t } from '../utils/i18n';
import { createBaseCallbacks } from './view-callbacks';

// ---------------------------------------------------------------------------
// Mutable UI state shared between view and extracted functions
// ---------------------------------------------------------------------------

export interface UIState {
	sidebarPinned: boolean;
	sidebarExpanded: boolean;
	bannerCollapsed: boolean;
	mobileWidgetTabsOpen: boolean;
	mobileWidgetExpanded: 'pomodoro' | 'reading' | 'lunar' | null;
	bannerQuoteIndex: number;
	bannerImageIndex: number;
	cleanupFns: Array<() => void>;
	dndCleanupFns: Array<() => void>;
}

/** Readonly dependencies needed by UI rendering functions. */
export interface UIDeps {
	app: App;
	plugin: DashboardPlugin;
	sync: SyncEngine;
}

// ---------------------------------------------------------------------------
// Mobile actions bar (on banner)
// ---------------------------------------------------------------------------

export function renderMobileActions(
	bannerEl: HTMLElement,
	onQuickActions: () => void,
	onRecent: () => void,
): void {
	const actions = bannerEl.createDiv({ cls: 'dashboard-mobile-actions' });

	const linksBtn = actions.createEl('button', {
		cls: 'dashboard-mobile-action-btn',
		attr: { 'aria-label': t('mobile.quickActions') },
	});
	setIcon(linksBtn, 'zap');
	linksBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		onQuickActions();
	});

	const recentBtn = actions.createEl('button', {
		cls: 'dashboard-mobile-action-btn',
		attr: { 'aria-label': t('mobile.recent') },
	});
	setIcon(recentBtn, 'clock');
	recentBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		onRecent();
	});

	// On mobile, tapping right half of banner reveals the edit button
	const overlay = bannerEl.querySelector('.dashboard-banner-overlay') as HTMLElement;
	if (overlay) {
		overlay.addEventListener('click', (e) => {
			const rect = overlay.getBoundingClientRect();
			const tapX = e.clientX - rect.left;
			if (tapX > rect.width * 0.5) {
				const editBtn = overlay.querySelector('.dashboard-banner-edit-btn') as HTMLElement;
				if (editBtn) {
					editBtn.addClass('dashboard-banner-edit-btn--mobile-visible');
				}
			}
		});
	}
}

// ---------------------------------------------------------------------------
// Mobile widget bar
// ---------------------------------------------------------------------------

export function renderMobileWidgetBar(
	container: HTMLElement,
	state: UIState,
	pomodoroService: PomodoroService | null,
	readingService: ReadingService | null,
	holidayData: Record<string, HolidayInfo>,
	app: App,
	plugin: DashboardPlugin,
): void {
	state.mobileWidgetTabsOpen = false;
	state.mobileWidgetExpanded = null;

	const bar = container.createDiv({ cls: 'dashboard-mobile-widget-bar' });

	const strip = bar.createDiv({ cls: 'dashboard-mobile-widget-strip' });
	strip.createDiv({ cls: 'dashboard-mobile-widget-strip-hint' });
	strip.addEventListener('click', (e) => {
		e.stopPropagation();
		state.mobileWidgetTabsOpen = !state.mobileWidgetTabsOpen;
		if (!state.mobileWidgetTabsOpen) {
			state.mobileWidgetExpanded = null;
		}
		refreshMobileWidgetPanel(bar, state, pomodoroService, readingService, holidayData, app, plugin);
	});

	const tabs = bar.createDiv({ cls: 'dashboard-mobile-widget-tabs' });

	const widgets: Array<{ key: 'pomodoro' | 'reading' | 'lunar'; label: string; icon: string }> = [
		{ key: 'pomodoro', label: t('mobile.pomodoro'), icon: 'hourglass' },
		{ key: 'reading', label: t('mobile.reading'), icon: 'book-open' },
		{ key: 'lunar', label: t('mobile.lunar'), icon: 'moon' },
	];

	bar.createDiv({ cls: 'dashboard-mobile-widget-panel' });

	for (const w of widgets) {
		const btn = tabs.createEl('button', {
			cls: 'dashboard-mobile-widget-btn',
			attr: { 'aria-label': w.label },
		});
		setIcon(btn, w.icon);

		btn.addEventListener('click', (e) => {
			e.stopPropagation();
			if (state.mobileWidgetExpanded === w.key) {
				state.mobileWidgetExpanded = null;
			} else {
				state.mobileWidgetExpanded = w.key;
			}
			refreshMobileWidgetPanel(bar, state, pomodoroService, readingService, holidayData, app, plugin);
		});

		btn.dataset.widgetKey = w.key;
	}

	refreshMobileWidgetPanel(bar, state, pomodoroService, readingService, holidayData, app, plugin);
}

function refreshMobileWidgetPanel(
	bar: HTMLElement,
	state: UIState,
	pomodoroService: PomodoroService | null,
	readingService: ReadingService | null,
	holidayData: Record<string, HolidayInfo>,
	app: App,
	plugin: DashboardPlugin,
): void {
	const strip = bar.querySelector('.dashboard-mobile-widget-strip');
	const tabs = bar.querySelector('.dashboard-mobile-widget-tabs');
	const panel = bar.querySelector<HTMLElement>('.dashboard-mobile-widget-panel');
	if (!strip || !tabs || !panel) return;

	strip.classList.toggle('dashboard-mobile-widget-strip--active', state.mobileWidgetTabsOpen);
	tabs.classList.toggle('dashboard-mobile-widget-tabs--open', state.mobileWidgetTabsOpen);

	tabs.querySelectorAll('.dashboard-mobile-widget-btn').forEach((btn) => {
		const el = btn as HTMLElement;
		el.classList.toggle('active', el.dataset.widgetKey === state.mobileWidgetExpanded);
	});

	panel.empty();

	if (!state.mobileWidgetExpanded) {
		panel.removeClass('dashboard-mobile-widget-panel--open');
		return;
	}

	panel.addClass('dashboard-mobile-widget-panel--open');

	if (state.mobileWidgetExpanded === 'pomodoro' && pomodoroService) {
		renderSidebarPomodoro(panel, pomodoroService, plugin.settings);
	} else if (state.mobileWidgetExpanded === 'reading' && readingService) {
		renderSidebarReading(panel, readingService);
	} else if (state.mobileWidgetExpanded === 'lunar') {
		renderSidebarLunarWidget(panel, holidayData, app);
	}
}

// ---------------------------------------------------------------------------
// Mobile drawer
// ---------------------------------------------------------------------------

export function openMobileDrawer(
	containerEl: HTMLElement,
	type: 'quickActions' | 'recent',
	data: DashboardData | null,
	app: App,
	plugin: DashboardPlugin,
	sync: SyncEngine,
	onExecuteAction: (action: QuickAction) => void,
	onOpenAddAction: () => void,
	onNavigate: (path: string) => void,
): void {
	closeMobileDrawer(containerEl);

	const root = containerEl.children[1] as HTMLElement;
	if (!root) return;

	const firstSection = root.querySelector('.dashboard-section-row') as HTMLElement;
	const drawerTop = firstSection ? firstSection.getBoundingClientRect().top : 0;

	const drawer = root.createDiv({ cls: 'dashboard-mobile-drawer' });
	drawer.style.top = `${drawerTop}px`;

	const content = drawer.createDiv({ cls: 'dashboard-mobile-drawer-content' });

	if (type === 'quickActions') {
		content.createEl('h4', { text: t('mobile.quickActions'), cls: 'dashboard-mobile-drawer-title' });
		if (data) {
			renderQuickActions(
				content,
				data.quickActions,
				(action) => { onExecuteAction(action); closeMobileDrawer(containerEl); },
				(index) => {
					void (async () => {
						const confirmed = await showConfirmDialog(app, {
							title: t('common.confirmDelete'),
							message: t('common.confirmDeleteMessage'),
						});
						if (!confirmed) return;
						void sync.removeQuickAction(index);
					})();
				},
				() => onOpenAddAction(),
				data.quickActionOrder,
				(order) => { void sync.reorderQuickActions(order); },
				(key) => {
					void (async () => {
						const confirmed = await showConfirmDialog(app, {
							title: t('common.confirmDelete'),
							message: t('common.confirmDeleteMessage'),
						});
						if (!confirmed) return;
						void sync.removeQuickActionByKey(key);
					})();
				},
				data.hiddenPresets,
				undefined,
			);
		}
	} else {
		content.createEl('h4', { text: t('mobile.recent'), cls: 'dashboard-mobile-drawer-title' });
		const docs = getRecentDocs(app, plugin.settings.recentDocCount);
		renderRecentDocs(content, docs, (path) => { onNavigate(path); });
	}

	const backdrop = drawer.createDiv({ cls: 'dashboard-mobile-drawer-backdrop' });
	backdrop.addEventListener('click', () => closeMobileDrawer(containerEl));

	window.requestAnimationFrame(() => {
		content.addClass('dashboard-mobile-drawer-content--open');
	});
}

export function closeMobileDrawer(containerEl: HTMLElement): void {
	const root = containerEl.children[1] as HTMLElement;
	if (!root) return;
	const existing = root.querySelector('.dashboard-mobile-drawer');
	if (existing) existing.remove();
}

// ---------------------------------------------------------------------------
// Banner behavior
// ---------------------------------------------------------------------------

export function setupBannerBehavior(
	bannerEl: HTMLElement,
	state: UIState,
	app: App,
): void {
	const pinBtn = bannerEl.createEl('button', {
		cls: 'dashboard-banner-pin-btn',
		attr: { 'aria-label': 'Toggle banner' },
	});
	setIcon(pinBtn, 'bookmark');

	pinBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		if (window.innerWidth <= 640) return;
		state.bannerCollapsed = !state.bannerCollapsed;
		bannerEl.toggleClass('dashboard-banner--collapsed', state.bannerCollapsed);
		app.saveLocalStorage('obsidian-dashboard-banner-collapsed', String(state.bannerCollapsed));
	});

	const onResize = () => {
		if (window.innerWidth <= 640 && state.bannerCollapsed) {
			bannerEl.removeClass('dashboard-banner--collapsed');
		} else if (state.bannerCollapsed) {
			bannerEl.addClass('dashboard-banner--collapsed');
		}
	};
	window.addEventListener('resize', onResize);
	state.cleanupFns.push(() => window.removeEventListener('resize', onResize));
}

const BANNER_QUOTE_ROTATION_MS = 60 * 60 * 1000;
const BANNER_IMAGE_ROTATION_MS = 30 * 60 * 1000;
const BANNER_QUOTE_OFFSET_MS = 60 * 60 * 1000;

export function setupBannerRotation(
	container: HTMLElement,
	banner: BannerData,
	state: UIState,
	app: App,
): void {
	const quotes = banner.quotes;
	if (quotes && quotes.length > 1) {
		const quoteIndex = Math.floor((Date.now() + BANNER_QUOTE_OFFSET_MS) / BANNER_QUOTE_ROTATION_MS) % quotes.length;
		state.bannerQuoteIndex = quoteIndex;

		const quoteEl = container.querySelector('.dashboard-banner-quote') as HTMLElement;
		const authorEl = container.querySelector('.dashboard-banner-author') as HTMLElement;
		if (quoteEl && authorEl) {
			const initial = quotes[quoteIndex]!;
			quoteEl.textContent = initial.quote;
			authorEl.textContent = initial.author;

			const rotateQuote = () => {
				state.bannerQuoteIndex = (state.bannerQuoteIndex + 1) % quotes.length;
				const next = quotes[state.bannerQuoteIndex]!;

				quoteEl.addClass('dashboard-banner-quote--fading');
				authorEl.addClass('dashboard-banner-author--fading');

				window.setTimeout(() => {
					quoteEl.textContent = next.quote;
					authorEl.textContent = next.author;
					quoteEl.removeClass('dashboard-banner-quote--fading');
					authorEl.removeClass('dashboard-banner-author--fading');
				}, 400);
			};

			const quoteTimer = window.setInterval(rotateQuote, BANNER_QUOTE_ROTATION_MS);
			state.cleanupFns.push(() => window.clearInterval(quoteTimer));
		}
	}

	const images = banner.images;
	if (images && images.length > 1) {
		const imgIndex = Math.floor(Date.now() / BANNER_IMAGE_ROTATION_MS) % images.length;
		state.bannerImageIndex = imgIndex;

		const bannerEl = container.querySelector('.dashboard-banner') as HTMLElement;
		if (bannerEl) {
			const resolved = resolveVaultImage(app, images[imgIndex]!);
			if (resolved) {
				bannerEl.style.backgroundImage = `url("${resolved}")`;
			}

			const rotateImage = () => {
				state.bannerImageIndex = (state.bannerImageIndex + 1) % images.length;
				const nextPath = images[state.bannerImageIndex]!;
				const nextResolved = resolveVaultImage(app, nextPath);

				bannerEl.addClass('dashboard-banner--fading');

				window.setTimeout(() => {
					if (nextResolved) {
						bannerEl.style.backgroundImage = `url("${nextResolved}")`;
					}
					bannerEl.removeClass('dashboard-banner--fading');
				}, 600);
			};

			const imgTimer = window.setInterval(rotateImage, BANNER_IMAGE_ROTATION_MS);
			state.cleanupFns.push(() => window.clearInterval(imgTimer));
		}
	}
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

export function renderSidebar(
	sidebar: HTMLElement,
	root: HTMLElement,
	data: DashboardData,
	deps: UIDeps,
	state: UIState,
	pomodoroService: PomodoroService | null,
	readingService: ReadingService | null,
	holidayData: Record<string, HolidayInfo>,
	onNavigate: (path: string) => void,
	onOpenAddAction: () => void,
	onEditAction: (action: QuickAction) => void,
	onReRender: () => void,
): void {
	const { app, plugin, sync } = deps;

	const scroll = sidebar.createDiv({ cls: 'dashboard-sidebar-scroll' });

	renderSidebarWeekCalendar(scroll);

	renderSidebarWidgets(scroll, plugin.settings, app, pomodoroService ?? undefined, readingService ?? undefined, holidayData, (order) => {
		void (async () => {
			plugin.settings = { ...plugin.settings, widgetOrder: order };
			await plugin.saveSettings();
			onReRender();
		})();
	});

	renderQuickActions(
		scroll,
		data.quickActions,
		(action) => { void executeAction(app, action); },
		(index) => {
			void showConfirmDialog(app, {
				title: t('common.confirmDelete'),
				message: t('common.confirmDeleteMessage'),
			}).then(confirmed => {
				if (confirmed) void sync.removeQuickAction(index);
			});
		},
		() => onOpenAddAction(),
		data.quickActionOrder,
		(order) => { void sync.reorderQuickActions(order); },
		(key) => {
			void showConfirmDialog(app, {
				title: t('common.confirmDelete'),
				message: t('common.confirmDeleteMessage'),
			}).then(confirmed => {
				if (confirmed) void sync.removeQuickActionByKey(key);
			});
		},
		data.hiddenPresets,
		(action) => onEditAction(action),
	);

	const docs = getRecentDocs(app, plugin.settings.recentDocCount);
	renderRecentDocs(scroll, docs, (path) => { onNavigate(path); });
}

export function setupSidebarBehavior(
	sidebar: HTMLElement,
	root: HTMLElement,
	state: UIState,
	sidebarAlwaysExpanded = false,
): void {
	sidebar.createDiv({ cls: 'dashboard-sidebar-slim-indicator' });

	sidebar.addEventListener('mousedown', (e: MouseEvent) => {
		if (state.sidebarPinned) return;
		// Only handle clicks on the sidebar itself or the slim indicator, not on child elements
		const target = e.target as HTMLElement;
		if (!target.hasClass('dashboard-sidebar') && !target.hasClass('dashboard-sidebar-slim-indicator')) return;

		if (sidebar.hasClass('dashboard-sidebar--collapsed')) {
			e.preventDefault();
			e.stopPropagation();
			sidebar.removeClass('dashboard-sidebar--collapsed');
			sidebar.addClass('dashboard-sidebar--expanded');
			state.sidebarExpanded = true;
		} else if (sidebarAlwaysExpanded && sidebar.hasClass('dashboard-sidebar--expanded')) {
			e.preventDefault();
			e.stopPropagation();
			sidebar.removeClass('dashboard-sidebar--expanded');
			sidebar.addClass('dashboard-sidebar--collapsed');
			state.sidebarExpanded = false;
		}
	}, true);

	const outsideHandler = (e: MouseEvent) => {
		if (state.sidebarPinned) return;
		if (sidebarAlwaysExpanded) return;
		if (!state.sidebarExpanded) return;
		if (sidebar.contains(e.target as Node)) return;
		sidebar.removeClass('dashboard-sidebar--expanded');
		sidebar.addClass('dashboard-sidebar--collapsed');
		state.sidebarExpanded = false;
	};
	root.addEventListener('click', outsideHandler);
	state.cleanupFns.push(() => root.removeEventListener('click', outsideHandler));
}

// ---------------------------------------------------------------------------
// Recent docs refresh
// ---------------------------------------------------------------------------

export function refreshRecentDocs(
	containerEl: HTMLElement,
	app: App,
	settings: { recentDocCount: number },
	onNavigate: (path: string) => void,
): void {
	const root = containerEl.children[1] as HTMLElement;
	if (!root) return;

	const recentSection = root.querySelector('.dashboard-recent');
	if (!recentSection) return;

	const parent = recentSection.parentElement;
	if (!parent) return;

	recentSection.remove();
	const docs = getRecentDocs(app, settings.recentDocCount);
	renderRecentDocs(parent, docs, (path) => { onNavigate(path); });
}

// ---------------------------------------------------------------------------
// In-place section refresh
// ---------------------------------------------------------------------------

export function refreshSectionInPlace(
	containerEl: HTMLElement,
	data: DashboardData,
	columnName: string,
	deps: UIDeps,
	state: UIState,
): void {
	const { app, plugin } = deps;
	const kanban = (containerEl.children[1] as HTMLElement)?.querySelector<HTMLElement>('.dashboard-kanban');
	if (!kanban) return;
	const oldEl = kanban.querySelector(`:scope > [data-column="${CSS.escape(columnName)}"]`);
	if (!oldEl) return;
	const column = data.columns.find(c => c.name === columnName);
	if (!column) return;
	const callbacks = createCallbacksForRefresh(deps, state, data);
	const newEl = renderSection(column, callbacks, app, data, plugin.settings);
	oldEl.replaceWith(newEl);
	for (const fn of state.dndCleanupFns) fn();
	state.dndCleanupFns = [];
	setupDragAndDrop(kanban, callbacks, state.dndCleanupFns);
}

/** Minimal callback factory for section refresh (no UI mutation callbacks needed). */
function createCallbacksForRefresh(deps: UIDeps, _state: UIState, _data: DashboardData) {
	const { app, sync } = deps;
	const base = createBaseCallbacks(sync);
	return {
		...base,
		onCardEdit: () => {},
		onOpenNoteInPopover: (file: TFile) => { void app.workspace.getLeaf(false).openFile(file); },
		onCardDelete: async () => {},
		onTaskDelete: async () => {},
		onMemoSaveAsNote: () => {},
		onTaskSaveToDaily: () => {},
		onCardAdd: () => {},
		onColumnAdd: () => {},
		onRequestAddSection: () => {},
		onBannerEdit: () => {},
		onQuickActionAdd: () => {},
		onQuickActionRemove: () => {},
		onFileDrop: () => {},
		onColumnDelete: () => {},
		onAddFromTemplate: () => {},
		onArchiveTasks: () => {},
		onLibraryConfigChange: (columnName: string, config: LibraryConfig) => {
			void sync.updateLibraryConfig(columnName, config);
		},
	};
}

// Helper: executeAction used by sidebar
function executeAction(app: App, action: QuickAction): void {
	if (action.type === 'file') {
		// lazy import to avoid circular
		void import('./view-modals').then(m => m.navigateToPath(app, action.target));
	} else if (action.type === 'command') {
		// executeCommandById is on the internal app
		(app as unknown as { commands: { executeCommandById: (id: string) => void } }).commands.executeCommandById(action.target);
	}
}
