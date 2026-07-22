import { HoverParent, HoverPopover, ItemView, WorkspaceLeaf } from 'obsidian';
import type { TFile } from 'obsidian';
import type DashboardPlugin from './main';
import type { DashboardData } from './types';
import { SyncEngine } from '../data/sync';
import { renderDashboard, destroyAllCharts, refreshScanningSections, refreshMediaSections } from '../renderers/dashboard';
import { renderBanner } from '../renderers/banner';
import { setupDragAndDrop } from '../utils/dnd';
import { showPromptDialog } from '../components/prompt-dialog';
import { PomodoroService } from '../services/pomodoro';
import { ReadingService } from '../services/reading';
import { loadHolidayData } from '../modals/lunar';
import type { HolidayInfo } from '../services/holiday';
import { t } from '../utils/i18n';

import { DASHBOARD_VIEW_TYPE } from './view-utils';
import type { UIState } from './view-ui';
import {
	renderMobileActions,
	renderMobileWidgetBar,
	openMobileDrawer,
	setupBannerBehavior,
	setupBannerRotation,
	renderSidebar,
	setupSidebarBehavior,
	refreshRecentDocs as refreshRecentDocsUI,
} from './view-ui';
import {
	openBannerEditModal,
	openNotePopover,
	openAddSectionModal,
	openFolderConfigModal,
	openHeatmapConfigModal,
	openCalendarConfigModal,
	openLibraryConfigModal,
	navigateToPath as navToPath,
	addColumnWithType,
} from './view-modals';
import type { TimerState } from './view-timers';
import {
	startReminderChecker,
	stopReminderChecker,
	checkReminders,
	startWeatherRefresh,
	stopWeatherRefresh,
	startDayRolloverChecker,
	stopDayRolloverChecker,
	checkDayRollover,
	registerVaultListeners,
	unregisterVaultListeners,
	debouncedRefreshRecentDocs,
	debouncedRefreshSections,
} from './view-timers';
import { createCallbacks, type CallbackDeps } from './view-callbacks';

export { DASHBOARD_VIEW_TYPE };

export class DashboardView extends ItemView implements HoverParent {
	private plugin: DashboardPlugin;
	private sync: SyncEngine;
	private data: DashboardData | null = null;

	private uiState: UIState = {
		sidebarPinned: this.app.loadLocalStorage('obsidian-dashboard-sidebar-pinned') === 'true',
		sidebarExpanded: false,
		bannerCollapsed: this.app.loadLocalStorage('obsidian-dashboard-banner-collapsed') === 'true',
		mobileWidgetTabsOpen: false,
		mobileWidgetExpanded: null,
		bannerQuoteIndex: 0,
		bannerImageIndex: 0,
		cleanupFns: [],
		dndCleanupFns: [],
	};

	private timerState: TimerState = {
		recentDocsTimer: null,
		libraryRefreshTimer: null,
		reminderTimer: null,
		weatherRefreshTimer: null,
		dayRolloverTimer: null,
		lastRenderedDay: new Date().toDateString(),
		vaultEventRefs: [],
		firedReminders: new Set(),
	};

	private suppressNextRender = false;
	private pendingScrollCardId: string | null = null;
	private pendingScrollToLastCardOfColumn: string | null = null;
	private pomodoroService: PomodoroService | null = null;
	private readingService: ReadingService | null = null;
	private holidayData: Record<string, HolidayInfo> = {};

	hoverPopover: HoverPopover | null = null;
	private popoverModal: import('../modals/note-popover').NotePopoverModal | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: DashboardPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.sync = new SyncEngine(this.app, this.plugin.settings);
	}

	getViewType(): string { return DASHBOARD_VIEW_TYPE; }
	getDisplayText(): string { return t('main.dashboard'); }
	getIcon(): string { return 'home'; }

	async onOpen(): Promise<void> {
		this.sync.updateSettings(this.plugin.settings);
		this.sync.onDataUpdate((data) => {
			this.data = data;
			if (this.suppressNextRender) { this.suppressNextRender = false; return; }
			this.render(data);
		});
		await this.sync.init();
		this.registerVaultListeners();
		startReminderChecker(this.timerState, () => this.doCheckReminders());
		startWeatherRefresh(this.timerState, this.data, () => { if (this.data) this.render(this.data); });
		startDayRolloverChecker(this.timerState, () => this.doCheckDayRollover());
		this.pomodoroService = new PomodoroService(this.plugin);
		await this.pomodoroService.loadSessions();
		this.readingService = new ReadingService(this.plugin);
		await this.readingService.loadSessions();
		void loadHolidayData(this.app).then(data => {
			this.holidayData = data;
			const cur = this.sync.getData();
			if (cur) this.render(cur);
		});
	}

	async onClose(): Promise<void> {
		this.popoverModal?.close();
		this.popoverModal = null;
		this.runCleanup();
		unregisterVaultListeners(this.timerState);
		stopReminderChecker(this.timerState);
		stopWeatherRefresh(this.timerState);
		stopDayRolloverChecker(this.timerState);
		this.pomodoroService?.destroy(); this.pomodoroService = null;
		this.readingService?.destroy(); this.readingService = null;
		this.sync.destroy();
	}

	async refresh(): Promise<void> {
		this.sync.updateSettings(this.plugin.settings);
		const data = this.sync.getData();
		if (data) this.render(data);
	}

	async updateDefaultContentIfDefault(): Promise<void> { await this.sync.updateDefaultContentIfDefault(); }

	async addSection(): Promise<void> {
		const name = await showPromptDialog(this.app, { title: t('renderer.sectionName') });
		if (name) void this.sync.addColumn(name);
	}

	// -----------------------------------------------------------------------
	// Render orchestration
	// -----------------------------------------------------------------------

	private render(data: DashboardData): void {
		this.runCleanup();
		this.data = data;
		this.timerState.firedReminders.clear();

		const root = this.containerEl.children[1] as HTMLElement;
		const savedKanbanScroll = (root?.querySelector('.dashboard-kanban') as HTMLElement)?.scrollTop ?? 0;
		const savedSidebarScroll = (root?.querySelector('.dashboard-sidebar-scroll') as HTMLElement)?.scrollTop ?? 0;

		const savedCardScrolls = new Map<string, number>();
		root?.querySelectorAll('.dashboard-section-cards').forEach((el) => {
			const section = (el as HTMLElement).closest('.dashboard-section-row');
			const key = section?.getAttribute('data-column') ?? '';
			if (key) savedCardScrolls.set(key, (el as HTMLElement).scrollLeft);
		});
		const savedTaskListScrolls = new Map<string, number>();
		root?.querySelectorAll('.dashboard-task-list').forEach((el) => {
			const cardId = (el as HTMLElement).dataset.cardId;
			if (cardId) savedTaskListScrolls.set(cardId, (el as HTMLElement).scrollTop);
		});

		const container = this.containerEl.children[1] as HTMLElement;
		activeDocument.body.querySelectorAll(':scope > .dashboard-card--ghost').forEach((el) => el.remove());
		container.empty();
		container.addClass('obsidian-dashboard-root');
		container.setAttribute('data-theme', this.plugin.settings.stylePreset);

		// Banner
		const bannerEl = renderBanner(container, data.banner, () => {
			if (this.data) openBannerEditModal(this.app, this.data, this.sync, this.plugin.settings.stylePreset);
		}, this.app);
		renderMobileActions(bannerEl, () => this.openMobileDrawer('quickActions'), () => this.openMobileDrawer('recent'));
		if (this.uiState.bannerCollapsed && window.innerWidth > 640) bannerEl.addClass('dashboard-banner--collapsed');
		setupBannerBehavior(bannerEl, this.uiState, this.app);
		setupBannerRotation(container, data.banner, this.uiState, this.app);
		renderMobileWidgetBar(container, this.uiState, this.pomodoroService, this.readingService, this.holidayData, this.app, this.plugin);

		// Layout
		const mainLayout = container.createDiv({ cls: 'dashboard-main' });
		const sidebar = mainLayout.createDiv({ cls: 'dashboard-sidebar' });
		if (this.uiState.sidebarPinned) sidebar.addClass('dashboard-sidebar--pinned');
		else if (this.uiState.sidebarExpanded) sidebar.addClass('dashboard-sidebar--expanded');
		else sidebar.addClass('dashboard-sidebar--collapsed');

		if (this.data) {
			renderSidebar(sidebar, container, this.data, { app: this.app, plugin: this.plugin, sync: this.sync }, this.uiState,
				this.pomodoroService, this.readingService, this.holidayData,
				(path) => void navToPath(this.app, path),
				() => { /* openAddAction handled via callbacks */ },
				() => { /* openEditAction handled via callbacks */ },
				() => { if (this.data) this.render(this.data); },
			);
		}
		setupSidebarBehavior(sidebar, container, this.uiState);

		const kanban = mainLayout.createDiv({ cls: 'dashboard-kanban-wrapper' });
		const callbacks = this.buildCallbacks();
		renderDashboard(kanban, data, callbacks, this.app, this.plugin.settings, this);
		setupDragAndDrop(kanban, callbacks, this.uiState.dndCleanupFns);
		kanban.addEventListener('dashboard-library-config', ((e: CustomEvent) => {
			const { columnName } = e.detail as { columnName: string };
			const col = this.data?.columns.find(c => c.name === columnName);
			if (col?.sectionType === 'folder') openFolderConfigModal(this.app, this.data, this.sync, columnName);
			else if (col?.sectionType === 'calendar') openCalendarConfigModal(this.app, this.data, this.sync, columnName);
			else if (col?.sectionType === 'heatmap') openHeatmapConfigModal(this.app, this.data, this.sync, columnName);
			else openLibraryConfigModal(this.app, this.data, this.sync, columnName);
		}) as EventListener);

		// Restore scroll positions
		const newKanban = container.querySelector('.dashboard-kanban');
		const newSidebarScroll = container.querySelector('.dashboard-sidebar-scroll');
		if (newKanban) newKanban.scrollTop = savedKanbanScroll;
		if (newSidebarScroll) newSidebarScroll.scrollTop = savedSidebarScroll;
		container.querySelectorAll('.dashboard-section-cards').forEach((el) => {
			const section = (el as HTMLElement).closest('.dashboard-section-row');
			const key = section?.getAttribute('data-column') ?? '';
			const saved = savedCardScrolls.get(key);
			if (saved !== undefined) (el as HTMLElement).scrollLeft = saved;
		});
		container.querySelectorAll('.dashboard-task-list').forEach((el) => {
			const cardId = (el as HTMLElement).dataset.cardId;
			const saved = cardId ? savedTaskListScrolls.get(cardId) : undefined;
			if (saved !== undefined) (el as HTMLElement).scrollTop = saved;
		});
		if (this.pendingScrollCardId) {
			const cardEl = container.querySelector(`[data-card-id="${this.pendingScrollCardId}"]`);
			if (cardEl) window.requestAnimationFrame(() => cardEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }));
			this.pendingScrollCardId = null;
		}
		if (this.pendingScrollToLastCardOfColumn) {
			const sectionRow = container.querySelector(`[data-column="${this.pendingScrollToLastCardOfColumn}"]`);
			if (sectionRow) {
				const cards = sectionRow.querySelectorAll('.dashboard-card');
				const lastCard = cards[cards.length - 1];
				if (lastCard) window.requestAnimationFrame(() => lastCard.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }));
			}
			this.pendingScrollToLastCardOfColumn = null;
		}
	}

	// -----------------------------------------------------------------------
	// Cleanup
	// -----------------------------------------------------------------------

	private runCleanup(): void {
		destroyAllCharts();
		if (this.pomodoroService) { this.pomodoroService.setOnTick(null); this.pomodoroService.setOnComplete(null); }
		if (this.readingService) this.readingService.setOnTick(null);
		for (const fn of this.uiState.cleanupFns) fn();
		this.uiState.cleanupFns = [];
		for (const fn of this.uiState.dndCleanupFns) fn();
		this.uiState.dndCleanupFns = [];
	}

	// -----------------------------------------------------------------------
	// Vault listeners
	// -----------------------------------------------------------------------

	private registerVaultListeners(): void {
		registerVaultListeners(this.app, this.timerState,
			() => this.doDebouncedRecent(),
			(structure) => this.doDebouncedSections(structure),
		);
	}

	private doDebouncedRecent(): void {
		debouncedRefreshRecentDocs(this.timerState, () => {
			refreshRecentDocsUI(this.containerEl, this.app, this.plugin.settings, (path) => void navToPath(this.app, path));
		});
	}

	private doDebouncedSections(structure: boolean): void {
		if (!this.data) return;
		const hasScanning = this.data.columns.some(c => { const s = c.sectionType; return s === 'library' || s === 'calendar' || s === 'folder'; });
		const hasMedia = this.data.columns.some(c => { const s = c.sectionType; return s === 'images' || s === 'videos'; });
		if (!hasScanning && !(structure && hasMedia)) return;
		debouncedRefreshSections(this.timerState, () => {
			const data = this.sync.getData();
			if (!data) return;
			const root = this.containerEl.children[1] as HTMLElement | undefined;
			const kanban = root?.querySelector('.dashboard-kanban') as HTMLElement | null;
			if (!kanban) { this.render(data); return; }
			const callbacks = this.buildCallbacks();
			if (hasScanning) refreshScanningSections(kanban, data, callbacks, this.app, this.plugin.settings, this);
			if (structure && hasMedia) refreshMediaSections(kanban, data, callbacks, this.app, this.plugin.settings, this);
			for (const fn of this.uiState.dndCleanupFns) fn();
			this.uiState.dndCleanupFns = [];
			setupDragAndDrop(kanban, callbacks, this.uiState.dndCleanupFns);
		});
	}

	// -----------------------------------------------------------------------
	// Timers
	// -----------------------------------------------------------------------

	private doCheckReminders(): void { checkReminders(this.data, this.timerState, this.plugin, this.sync, this.app); }

	private doCheckDayRollover(): void {
		checkDayRollover(this.timerState, this.data, this.containerEl, () => { if (this.data) this.render(this.data); });
	}

	// -----------------------------------------------------------------------
	// Mobile drawer
	// -----------------------------------------------------------------------

	private openMobileDrawer(type: 'quickActions' | 'recent'): void {
		openMobileDrawer(this.containerEl, type, this.data, this.app, this.plugin, this.sync,
			() => {}, () => {}, (path) => void navToPath(this.app, path),
		);
	}

	// -----------------------------------------------------------------------
	// Callback factory
	// -----------------------------------------------------------------------

	private buildCallbacks() {
		// eslint-disable-next-line @typescript-eslint/no-this-alias -- Required for getter/setter callbacks that need to access class properties
		const self = this;
		const deps: CallbackDeps = {
			app: this.app,
			plugin: this.plugin,
			sync: this.sync,
			getData: () => this.data,
			containerEl: this.containerEl,
			uiState: this.uiState,
			suppressRef: { get value() { return self.suppressNextRender; }, set value(v: boolean) { self.suppressNextRender = v; } },
			pendingScrollRef: { get value() { return self.pendingScrollToLastCardOfColumn; }, set value(v: string | null) { self.pendingScrollToLastCardOfColumn = v; } },
		};
		return createCallbacks(deps);
	}
}
