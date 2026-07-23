import { Notice, TFile } from 'obsidian';
import type { App } from 'obsidian';
import type DashboardPlugin from './main';
import type { DashboardData, DashboardCard, QuickAction } from './types';
import type { SyncEngine } from '../data/sync';
import type { AppWithCommands } from '../utils/obsidian-internal';
import { BannerEditModal } from '../renderers/banner';
import { CardEditModal } from '../modals/card-edit';
import { NotePopoverModal } from '../modals/note-popover';
import { AddSectionModal } from '../modals/add-section';
import { WidgetTypeModal, type WidgetType } from '../modals/widget-type';
import { WeatherConfigModal } from '../modals/weather-config';
import { TrackerConfigModal } from '../modals/tracker-config';
import { TemplatePickerModal } from '../modals/template';
import { LibraryConfigModal } from '../modals/library-config';
import { HeatmapConfigModal } from '../modals/heatmap-config';
import { CalendarConfigModal } from '../modals/calendar-config';
import { FolderConfigModal } from '../modals/folder-config';
import { AddActionModal, DocSearchModal } from '../components/quick-actions';
import { showConfirmDialog } from '../components/confirm-dialog';
import { showPromptDialog } from '../components/prompt-dialog';
import { t } from '../utils/i18n';

// ---------------------------------------------------------------------------
// Banner & card modals
// ---------------------------------------------------------------------------

export function openBannerEditModal(app: App, data: DashboardData, sync: SyncEngine, stylePreset: string): void {
	const modal = new BannerEditModal(app, data.banner, (updates) => {
		void sync.updateBanner(updates);
	}, stylePreset);
	modal.open();
}

export function openCardEditModal(app: App, card: DashboardCard, sync: SyncEngine, stylePreset: string): void {
	const modal = new CardEditModal(app, card, (updates) => {
		void sync.updateCard(card.id, updates);
	}, stylePreset);
	modal.open();
}

// ---------------------------------------------------------------------------
// Note popover
// ---------------------------------------------------------------------------

export function openNotePopover(app: App, file: TFile, stylePreset: string): NotePopoverModal {
	const modal = new NotePopoverModal(app, file, stylePreset);
	modal.open();
	return modal;
}

/** Opens a note on card click. Honors the "disable popover" setting. */
export function openNote(app: App, file: TFile, disableNotePopover: boolean, stylePreset: string): void {
	if (disableNotePopover) {
		void app.workspace.getLeaf(false).openFile(file);
		return;
	}
	openNotePopover(app, file, stylePreset);
}

// ---------------------------------------------------------------------------
// Section / column modals
// ---------------------------------------------------------------------------

export function openAddSectionModal(app: App, onAdd: (name: string, sectionType?: string) => void): void {
	const modal = new AddSectionModal(app, onAdd);
	modal.open();
}

export function openWidgetTypeModal(app: App, stylePreset: string, onSelect: (type: WidgetType) => void): void {
	const modal = new WidgetTypeModal(app, onSelect, stylePreset);
	modal.open();
}

export function openWeatherConfigModal(app: App, sync: SyncEngine, colName: string, stylePreset: string): void {
	const modal = new WeatherConfigModal(app, (title, config) => {
		void sync.addCard(colName, { title, type: 'weather', weatherConfig: config });
	}, stylePreset);
	modal.open();
}

export function openTrackerConfigModal(app: App, sync: SyncEngine, colName: string, stylePreset: string): void {
	const modal = new TrackerConfigModal(app, (title, config) => {
		void sync.addCard(colName, { title, type: 'tracker', trackerConfig: config });
	}, stylePreset);
	modal.open();
}

export function openTemplatePicker(
	app: App,
	plugin: DashboardPlugin,
	sync: SyncEngine,
	colName: string,
	onScroll: (colName: string) => void,
	stylePreset: string,
): void {
	const modal = new TemplatePickerModal(
		app,
		plugin,
		(template) => {
			onScroll(colName);
			void sync.addCard(colName, {
				title: template.name,
				type: 'task',
				tasks: template.tasks.map(text => ({ text, checked: false })),
			});
		},
		stylePreset,
	);
	modal.open();
}

export function openLibraryConfigModal(app: App, data: DashboardData | null, sync: SyncEngine, colName: string): void {
	const column = data?.columns.find(col => col.name === colName);
	const existingConfig = column?.libraryConfig ?? {
		filters: [],
		viewMode: 'grid' as const,
		sortBy: 'modified',
		sortDesc: true,
	};
	const modal = new LibraryConfigModal(
		app,
		existingConfig,
		(config) => { void sync.updateLibraryConfig(colName, config); },
	);
	modal.open();
}

export function openHeatmapConfigModal(app: App, data: DashboardData | null, sync: SyncEngine, colName: string): void {
	const column = data?.columns.find(col => col.name === colName);
	const existing = column?.heatmapConfig ?? {
		folder: '',
		trackerKey: '',
		period: 'pastYear' as const,
	};
	const modal = new HeatmapConfigModal(
		app,
		existing,
		(config) => { void sync.updateHeatmapConfig(colName, config); },
	);
	modal.open();
}

export function openCalendarConfigModal(app: App, data: DashboardData | null, sync: SyncEngine, colName: string): void {
	const column = data?.columns.find(col => col.name === colName);
	const existingConfig = column?.libraryConfig ?? {
		filters: [],
		viewMode: 'grid' as const,
		sortBy: 'modified',
		sortDesc: true,
	};
	const modal = new CalendarConfigModal(
		app,
		existingConfig,
		(config) => { void sync.updateLibraryConfig(colName, config); },
	);
	modal.open();
}

export function openFolderConfigModal(app: App, data: DashboardData | null, sync: SyncEngine, colName: string): void {
	const column = data?.columns.find(col => col.name === colName);
	const libraryConfig = column?.libraryConfig;
	const currentFolders = libraryConfig?.folders ?? [];
	const currentTags = libraryConfig?.filters.find(f => f.property === 'tags')?.values ?? [];
	const currentGroupBy = libraryConfig?.kanbanGroupBy;
	const modal = new FolderConfigModal(
		app,
		currentFolders,
		currentTags,
		currentGroupBy,
		libraryConfig?.showProperties,
		libraryConfig?.propertyLimit,
		(result) => {
			const base = libraryConfig ?? {
				filters: [],
				viewMode: 'grid' as const,
				sortBy: 'modified',
				sortDesc: true,
			};
			const filtersWithoutTags = base.filters.filter(f => f.property !== 'tags');
			const filters = result.tags.length > 0
				? [...filtersWithoutTags, { property: 'tags', values: result.tags }]
				: filtersWithoutTags;
			void sync.updateLibraryConfig(colName, {
				...base,
				folders: result.folders,
				filters,
				kanbanGroupBy: result.groupBy,
				showProperties: result.showProperties ? undefined : false,
				propertyLimit: result.propertyLimit,
			});
		},
	);
	modal.open();
}

// ---------------------------------------------------------------------------
// Quick action modals
// ---------------------------------------------------------------------------

export function openAddActionModal(app: App, sync: SyncEngine): void {
	const modal = new AddActionModal(app, (action) => {
		void sync.addQuickAction(action);
	});
	modal.open();
}

export function openEditActionModal(app: App, data: DashboardData | null, sync: SyncEngine, action: QuickAction): void {
	const index = data?.quickActions.findIndex(a => a.target === action.target) ?? -1;
	if (index < 0) return;
	const modal = new AddActionModal(
		app,
		(updated) => {
			void sync.updateQuickAction(index, { name: updated.name, icon: updated.icon });
		},
		action,
	);
	modal.open();
}

export function openProjectSearchModal(app: App, sync: SyncEngine, colName: string): void {
	const modal = new DocSearchModal(app, (link) => {
		void sync.addCard(colName, { title: link.name, body: `[[${link.path}]]` });
	});
	modal.open();
}

// ---------------------------------------------------------------------------
// Navigation & command execution
// ---------------------------------------------------------------------------

export async function navigateToPath(app: App, path: string): Promise<void> {
	let file = app.vault.getFileByPath(path);
	if (!file && !path.endsWith('.md')) {
		file = app.vault.getFileByPath(`${path}.md`);
	}

	if (!file) {
		const basename = path.split('/').pop()?.replace(/\.md$/, '') ?? '';
		if (basename) {
			const found = app.vault.getMarkdownFiles().find(mf => mf.basename === basename);
			if (found) file = found;
		}
	}

	if (file) {
		const leaf = app.workspace.getLeaf(false);
		await leaf.openFile(file);
		return;
	}

	const folderPath = path.replace(/\/$/, '');
	const abstractFile = app.vault.getAbstractFileByPath(folderPath);
	if (abstractFile) {
		const leaves = app.workspace.getLeavesOfType('file-explorer');
		if (leaves.length > 0) {
			app.workspace.setActiveLeaf(leaves[0]!, { focus: true });
		}
	}
}

export function executeAction(app: App, action: QuickAction): void {
	if (action.type === 'file') {
		void navigateToPath(app, action.target);
	} else if (action.type === 'command') {
		(app as AppWithCommands).commands.executeCommandById(action.target);
	}
}

// ---------------------------------------------------------------------------
// Column management
// ---------------------------------------------------------------------------

export async function deleteColumn(app: App, sync: SyncEngine, columnName: string): Promise<void> {
	const confirmed = await showConfirmDialog(app, {
		title: t('common.confirmDelete'),
		message: t('renderer.confirmDeleteSection', { column: columnName }),
	});
	if (!confirmed) return;
	await sync.deleteColumn(columnName);
	new Notice(t('renderer.sectionDeleted'));
}

export async function addColumnWithType(
	sync: SyncEngine,
	name: string,
	sectionType?: string,
	onLibraryConfig?: (name: string) => void,
	onFolderConfig?: (name: string) => void,
	onHeatmapConfig?: (name: string) => void,
): Promise<void> {
	await sync.addColumn(name, sectionType);
	if (sectionType === 'library' && onLibraryConfig) {
		onLibraryConfig(name);
	} else if (sectionType === 'folder' && onFolderConfig) {
		onFolderConfig(name);
	} else if (sectionType === 'heatmap' && onHeatmapConfig) {
		onHeatmapConfig(name);
	}
}

export async function promptAddColumn(app: App, sync: SyncEngine): Promise<void> {
	const name = await showPromptDialog(app, { title: t('renderer.sectionName') });
	if (name) {
		void sync.addColumn(name);
	}
}
