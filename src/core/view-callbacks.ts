import { Notice, TFile } from 'obsidian';
import type { App } from 'obsidian';
import type DashboardPlugin from './main';
import type { DashboardData, DashboardCard, QuickAction, LibraryConfig } from './types';
import type { SyncEngine } from '../data/sync';
import { showConfirmDialog } from '../components/confirm-dialog';
import { t } from '../utils/i18n';

import {
	openCardEditModal,
	openNotePopover,
	openAddSectionModal,
	openWidgetTypeModal,
	openWeatherConfigModal,
	openTrackerConfigModal,
	openTemplatePicker,
	openProjectSearchModal,
	openBannerEditModal,
	openAddActionModal,
	openEditActionModal,
	openLibraryConfigModal,
	openFolderConfigModal,
	openHeatmapConfigModal,
	openCalendarConfigModal,
	navigateToPath,
	executeAction,
	deleteColumn,
	addColumnWithType,
} from './view-modals';
import { handleFileDrop, saveMemoAsNote, saveTasksToDaily, archiveCompletedTasks } from './view-actions';
import type { UIState } from './view-ui';
import { refreshSectionInPlace } from './view-ui';

export interface CallbackDeps {
	app: App;
	plugin: DashboardPlugin;
	sync: SyncEngine;
	/** Mutable ref — callbacks read the latest value each time. */
	getData: () => DashboardData | null;
	containerEl: HTMLElement;
	uiState: UIState;
	/** Mutable ref to suppressNextRender flag. */
	suppressRef: { value: boolean };
	/** Mutable ref to pendingScrollToLastCardOfColumn. */
	pendingScrollRef: { value: string | null };
}

export function createCallbacks(deps: CallbackDeps) {
	const { app, plugin, sync, getData, containerEl, uiState, suppressRef, pendingScrollRef } = deps;

	const openNote = (file: TFile): void => {
		if (plugin.settings.disableNotePopover) {
			void app.workspace.getLeaf(false).openFile(file);
			return;
		}
		openNotePopover(app, file, plugin.settings.stylePreset);
	};

	return {
		onCardEdit: (card: DashboardCard) => openCardEditModal(app, card, sync, plugin.settings.stylePreset),
		onOpenNoteInPopover: (file: TFile) => openNote(file),
		onCardDelete: async (cardId: string) => {
			const confirmed = await showConfirmDialog(app, { title: t('common.confirmDelete'), message: t('common.confirmDeleteMessage') });
			if (!confirmed) return;
			void sync.deleteCard(cardId);
			new Notice(t('card.deleted'));
		},
		onCheckboxToggle: (cardId: string, taskPath: number[], checked: boolean) => sync.toggleTask(cardId, taskPath, checked),
		onTaskAdd: (cardId: string, text: string, parentPath?: number[]) => sync.addTask(cardId, text, parentPath),
		onTaskDelete: async (cardId: string, taskPath: number[]) => {
			const confirmed = await showConfirmDialog(app, { title: t('common.confirmDelete'), message: t('common.confirmDeleteMessage') });
			if (!confirmed) return;
			void sync.deleteTask(cardId, taskPath);
		},
		onTaskReorder: (cardId: string, fromPath: number[], toPath: number[], before: boolean) => sync.reorderTask(cardId, fromPath, toPath, before),
		onTaskMoveToCard: (srcCardId: string, fromPath: number[], destCardId: string, destPath: number[], mode: 'before' | 'after' | 'nest') => sync.moveTaskToCard(srcCardId, fromPath, destCardId, destPath, mode),
		onTaskEdit: (cardId: string, taskPath: number[], text: string) => sync.editTask(cardId, taskPath, text),
		onTaskNest: (cardId: string, taskPath: number[]) => sync.nestTask(cardId, taskPath),
		onTaskNestInto: (cardId: string, srcPath: number[], destPath: number[]) => sync.nestTaskInto(cardId, srcPath, destPath),
		onTaskUnnest: (cardId: string, taskPath: number[]) => sync.unnestTask(cardId, taskPath),
		onTaskToggleCollapse: (cardId: string, taskPath: number[]) => sync.toggleCollapseTask(cardId, taskPath),
		onMemoUpdate: (card: DashboardCard, updates: { body: string; blockquote: string }) => sync.updateMemoCard(card.id, updates),
		onMemoSaveAsNote: (card: DashboardCard) => saveMemoAsNote(app, plugin, card),
		onTaskSaveToDaily: (card: DashboardCard) => saveTasksToDaily(app, plugin, card),
		onDocAdd: (cardId: string, path: string) => sync.addDocToCard(cardId, path),
		onDocDelete: (cardId: string, docPath: number[]) => sync.deleteDoc(cardId, docPath),
		onDocReorder: (cardId: string, fromPath: number[], toPath: number[], before: boolean) => sync.reorderDocs(cardId, fromPath, toPath, before),
		onDocMoveToCard: (srcCardId: string, fromPath: number[], destCardId: string, destPath: number[], mode: 'before' | 'after' | 'nest') => sync.moveDocToCard(srcCardId, fromPath, destCardId, destPath, mode),
		onDocNest: (cardId: string, docPath: number[]) => sync.nestDoc(cardId, docPath),
		onDocToggleCollapse: (cardId: string, docPath: number[]) => sync.toggleCollapseDoc(cardId, docPath),
		onCardAdd: (colName: string) => {
			const data = getData();
			const column = data?.columns.find(col => col.name === colName);
			const effectiveType = column?.sectionType ?? colName.toLowerCase();
			if (effectiveType === 'dashboard') {
				openWidgetTypeModal(app, plugin.settings.stylePreset, (type) => {
					if (type === 'weather') openWeatherConfigModal(app, sync, colName, plugin.settings.stylePreset);
					else if (type === 'tracker') openTrackerConfigModal(app, sync, colName, plugin.settings.stylePreset);
				});
			} else if (effectiveType === 'memo' || effectiveType === 'todo') {
				pendingScrollRef.value = colName;
				void sync.addCard(colName);
			} else {
				openProjectSearchModal(app, sync, colName);
			}
		},
		onColumnAdd: (name: string, sectionType?: string) => {
			void addColumnWithType(sync, name, sectionType,
				(n) => openLibraryConfigModal(app, getData(), sync, n),
				(n) => openFolderConfigModal(app, getData(), sync, n),
				(n) => openHeatmapConfigModal(app, getData(), sync, n),
			);
		},
		onRequestAddSection: () => {
			openAddSectionModal(app, (name, sectionType) => {
				void addColumnWithType(sync, name, sectionType,
					(n) => openLibraryConfigModal(app, getData(), sync, n),
					(n) => openFolderConfigModal(app, getData(), sync, n),
					(n) => openHeatmapConfigModal(app, getData(), sync, n),
				);
			});
		},
		onBannerEdit: () => {
			const data = getData();
			if (data) openBannerEditModal(app, data, sync, plugin.settings.stylePreset);
		},
		onQuickActionAdd: () => openAddActionModal(app, sync),
		onQuickActionRemove: (index: number) => {
			void showConfirmDialog(app, { title: t('common.confirmDelete'), message: t('common.confirmDeleteMessage') }).then(confirmed => {
				if (confirmed) void sync.removeQuickAction(index);
			});
		},
		onMoveCard: (cardId: string, targetCol: string, targetIdx: number) => sync.moveCard(cardId, targetCol, targetIdx),
		onMemoColorChange: (card: DashboardCard, color: string) => sync.updateMemoColor(card.id, color),
		onProjectCoverChange: (card: DashboardCard, imagePath: string) => sync.updateProjectCover(card.id, imagePath),
		onCardTitleEdit: (cardId: string, newTitle: string) => sync.updateCard(cardId, { title: newTitle }),
		onCardWidthChange: (cardId: string, width: number) => sync.updateCardWidth(cardId, width),
		onCardSizeChange: (cardId: string, size: string) => sync.updateCardSize(cardId, size as import('./types').CardSize),
		onCardGridChange: (cardId: string, gridCols: number, gridRows: number) => sync.updateCardGrid(cardId, gridCols, gridRows),
		onCardGridMove: (cardId: string, gridCol: number, gridRow: number) => sync.updateCardGridMove(cardId, gridCol, gridRow),
		onFileDrop: (cardId: string, filePath: string) => handleFileDrop(getData(), sync, cardId, filePath),
		onColumnRename: (oldName: string, newName: string) => sync.renameColumn(oldName, newName),
		onColumnDelete: (columnName: string) => deleteColumn(app, sync, columnName),
		onColumnMove: (fromIndex: number, toIndex: number) => { void sync.moveColumn(fromIndex, toIndex); },
		onColumnHeightChange: (name: string, height: number) => { void sync.updateColumnHeight(name, height); },
		onTaskReminderEdit: (cardId: string, taskPath: number[], reminder: string | undefined) => sync.editTaskReminder(cardId, taskPath, reminder),
		onAddFromTemplate: (columnName: string) => openTemplatePicker(app, plugin, sync, columnName, (cn) => { pendingScrollRef.value = cn; }, plugin.settings.stylePreset),
		onArchiveTasks: (columnName: string) => archiveCompletedTasks(app, plugin, getData(), sync, columnName),
		onLibraryConfigChange: (columnName: string, config: LibraryConfig) => {
			suppressRef.value = true;
			void sync.updateLibraryConfig(columnName, config).then(() => {
				refreshSectionInPlace(containerEl, getData()!, columnName, { app, plugin, sync }, uiState);
			});
		},
	};
}
