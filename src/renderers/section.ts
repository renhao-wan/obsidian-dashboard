import { App, Platform, setIcon } from 'obsidian';
import type { DashboardData, DashboardColumn, DashboardCard, RenderCallbacks, TaskItem, DocNode, DashboardSettings, CardSize } from '../core/types';
import { t } from '../i18n';
import { renderLibrarySection } from '../library-section';
import { renderMediaSection, destroyMediaSection } from '../media-section';
import { renderCalendarSection } from '../calendar-section';
import { renderHeatmapSection } from '../heatmap-section';
import { resolveVaultImage } from '../banner';
import {
	activeHoverParent,
	activeNoteOpener,
	docDragSource,
} from './utils';
import {
	getSectionType,
	renderTaskBody,
	renderMemoBody,
	renderWeatherBody,
	renderTrackerBody,
	renderProjectBody,
} from './card-bodies';

// ===== Section Collapse =====

const COLLAPSED_KEY = 'obsidian-dashboard-collapsed';

function getCollapsedSections(app: App): Set<string> {
	try {
		const raw = app.loadLocalStorage(COLLAPSED_KEY) as string | null;
		if (!raw) return new Set();
		return new Set(JSON.parse(raw) as string[]);
	} catch {
		return new Set();
	}
}

function saveCollapsedSections(app: App, collapsed: Set<string>): void {
	app.saveLocalStorage(COLLAPSED_KEY, JSON.stringify([...collapsed]));
}

// ===== Section Resize =====

function attachSectionResizeHandle(el: HTMLElement, column: DashboardColumn, callbacks: RenderCallbacks): void {
	if (Platform.isMobile) return;
	const handle = el.createDiv({ cls: 'dashboard-section-resize-handle' });
	handle.addEventListener('mousedown', (e) => {
		e.preventDefault();
		e.stopPropagation();
		const startY = e.clientY;
		const startHeight = el.offsetHeight;
		el.addClass('dashboard-section-row--resizing');

		const onMove = (ev: MouseEvent) => {
			const delta = ev.clientY - startY;
			const newHeight = Math.max(160, Math.min(2000, startHeight + delta));
			el.style.maxHeight = `${newHeight}px`;
		};
		const onUp = (ev: MouseEvent) => {
			activeDocument.removeEventListener('mousemove', onMove);
			activeDocument.removeEventListener('mouseup', onUp);
			el.removeClass('dashboard-section-row--resizing');
			const finalHeight = Math.max(160, Math.min(2000, startHeight + (ev.clientY - startY)));
			if (finalHeight !== column.height) {
				callbacks.onColumnHeightChange(column.name, finalHeight);
			}
		};
		activeDocument.addEventListener('mousemove', onMove);
		activeDocument.addEventListener('mouseup', onUp);
	});
}

// ===== Section Rendering =====

export function renderSection(column: DashboardColumn, callbacks: RenderCallbacks, app: App, data?: DashboardData, settings?: DashboardSettings): HTMLElement {
	const el = createDiv();
	el.addClass('dashboard-section-row');
	el.dataset.column = column.name;
	const sectionType = getSectionType(column);
	el.dataset.sectionType = sectionType;

	const collapsed = getCollapsedSections(app);
	if (collapsed.has(column.name)) {
		el.addClass('dashboard-section-row--collapsed');
	}

	// Apply user-dragged height (desktop). Overrides the per-type max-height.
	if (typeof column.height === 'number' && column.height > 0) {
		el.style.maxHeight = `${column.height}px`;
	}

	attachSectionResizeHandle(el, column, callbacks);

	const header = el.createDiv({ cls: 'dashboard-section-header' });

	// Drag handle to reorder sections (desktop only).
	const titleWrap = header.createDiv({ cls: 'dashboard-section-title-wrap' });

	// Drag handle sits at the far left, grouped with the title so the header's
	// space-between layout keeps the title left-aligned (not centered).
	if (!Platform.isMobile) {
		const grip = titleWrap.createDiv({ cls: 'dashboard-section-grip' });
		grip.setAttribute('draggable', 'true');
		grip.setAttribute('aria-label', t('renderer.dragSection'));
		setIcon(grip, 'grip-vertical');
	}

	const titleEl = titleWrap.createEl('h3', { text: column.name, cls: 'dashboard-section-title' });

	titleEl.addEventListener('dblclick', (e) => {
		e.stopPropagation();
		const currentName = titleEl.getText();
		titleEl.empty();
		const input = titleEl.createEl('input', {
			cls: 'dashboard-section-rename-input',
			attr: { type: 'text', value: currentName },
		});
		input.focus();
		input.select();

		const finish = (save: boolean) => {
			const newName = input.value.trim();
			if (save && newName && newName !== currentName) {
				callbacks.onColumnRename(currentName, newName);
			} else {
				titleEl.empty();
				titleEl.setText(currentName);
			}
		};

		input.addEventListener('keydown', (ke: KeyboardEvent) => {
			if (ke.key === 'Enter') {
				ke.preventDefault();
				finish(true);
			} else if (ke.key === 'Escape') {
				ke.preventDefault();
				finish(false);
			}
		});

		input.addEventListener('blur', () => {
			finish(true);
		});
	});
	titleEl.setCssProps({ cursor: 'pointer' });

	// Collapse toggle sits right after the title (keeps it out of the header
	// actions group, whose button count varies per section type).
	const toggle = titleWrap.createDiv({ cls: 'dashboard-section-toggle' });
	toggle.setAttribute('role', 'button');
	toggle.setAttribute('aria-label', t('renderer.toggleSection'));
	toggle.addEventListener('click', (e) => {
		e.stopPropagation();
		const isNowCollapsed = el.hasClass('dashboard-section-row--collapsed');
		if (isNowCollapsed) {
			el.removeClass('dashboard-section-row--collapsed');
			collapsed.delete(column.name);
		} else {
			el.addClass('dashboard-section-row--collapsed');
			collapsed.add(column.name);
		}
		saveCollapsedSections(app, collapsed);
	});

		const headerActions = header.createDiv({ cls: 'dashboard-section-header-actions' });

	if (sectionType === 'todo') {
		const archiveBtn = headerActions.createEl('button', {
			cls: 'dashboard-section-add-btn',
			attr: { 'aria-label': t('renderer.archiveTasks') },
		});
		setIcon(archiveBtn, 'archive');
		archiveBtn.addEventListener('click', () => callbacks.onArchiveTasks(column.name));

		const templateBtn = headerActions.createEl('button', {
			cls: 'dashboard-section-add-btn',
			attr: { 'aria-label': t('template.addFromTemplate') },
		});
		setIcon(templateBtn, 'layout-template');
		templateBtn.addEventListener('click', () => callbacks.onAddFromTemplate(column.name));
	}

	// Library section: render differently
	if (sectionType === 'library' || sectionType === 'folder') {
		// A folder section with no folder set would otherwise list the entire vault
		// (queryVaultFiles skips the folder filter when it is empty). In that state
		// renderLibrarySection never runs, so the toolbar (which hosts the always-
		// visible config button) does not exist yet — keep a header config button
		// as the only entry point. For a configured folder or any library section,
		// renderLibrarySection renders that toolbar config button, so we skip this
		// header one to avoid a duplicate next to the delete button.
		const folderUnconfigured = sectionType === 'folder' && !(column.libraryConfig?.folders && column.libraryConfig.folders.some(f => f.trim()));

		if (folderUnconfigured) {
			const configBtn = headerActions.createEl('button', {
				cls: 'dashboard-section-add-btn',
				attr: { 'aria-label': t('folder.configure') },
			});
			setIcon(configBtn, 'settings');
			configBtn.addEventListener('click', () => {
				const event = new CustomEvent('dashboard-library-config', { detail: { columnName: column.name }, bubbles: true });
				el.dispatchEvent(event);
			});
		}

		const deleteSectionBtn = headerActions.createEl('button', {
			cls: 'dashboard-section-add-btn dashboard-section-delete-btn',
			attr: { 'aria-label': t('renderer.deleteSection', { column: column.name }) },
		});
		setIcon(deleteSectionBtn, 'trash-2');
		deleteSectionBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			callbacks.onColumnDelete(column.name);
		});

		if (folderUnconfigured) {
			el.createDiv({ cls: 'dashboard-library-empty dashboard-folder-empty', text: t('folder.empty') });
			return el;
		}

		renderLibrarySection(el, column, app, (config) => {
			callbacks.onLibraryConfigChange(column.name, config);
		}, activeHoverParent, activeNoteOpener);
		return el;
	}

	// Images / videos sections: full-vault media thumbnail wall (no config needed)
	if (sectionType === 'images' || sectionType === 'videos') {
		const deleteSectionBtn = headerActions.createEl('button', {
			cls: 'dashboard-section-add-btn dashboard-section-delete-btn',
			attr: { 'aria-label': t('renderer.deleteSection', { column: column.name }) },
		});
		setIcon(deleteSectionBtn, 'trash-2');
		deleteSectionBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			callbacks.onColumnDelete(column.name);
		});

		renderMediaSection(el, column, app, activeHoverParent, callbacks.onOpenNoteInPopover);
		return el;
	}

	// Calendar section: month grid of every dated task across the vault.
	if (sectionType === 'calendar') {
		const configBtn = headerActions.createEl('button', {
			cls: 'dashboard-section-add-btn',
			attr: { 'aria-label': t('calendar.configure') },
		});
		setIcon(configBtn, 'settings');
		configBtn.addEventListener('click', () => {
			const event = new CustomEvent('dashboard-library-config', { detail: { columnName: column.name }, bubbles: true });
			el.dispatchEvent(event);
		});

		const deleteSectionBtn = headerActions.createEl('button', {
			cls: 'dashboard-section-add-btn dashboard-section-delete-btn',
			attr: { 'aria-label': t('renderer.deleteSection', { column: column.name }) },
		});
		setIcon(deleteSectionBtn, 'trash-2');
		deleteSectionBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			callbacks.onColumnDelete(column.name);
		});

		void renderCalendarSection(el, column, app, activeHoverParent, callbacks.onOpenNoteInPopover);
		return el;
	}

	// Heatmap section: tracker heatmap driven by per-section HeatmapConfig.
	if (sectionType === 'heatmap') {
		const configBtn = headerActions.createEl('button', {
			cls: 'dashboard-section-add-btn',
			attr: { 'aria-label': t('heatmap.configure') },
		});
		setIcon(configBtn, 'settings');
		configBtn.addEventListener('click', () => {
			const event = new CustomEvent('dashboard-library-config', { detail: { columnName: column.name }, bubbles: true });
			el.dispatchEvent(event);
		});

		// Stats button — click shows a floating popup with streak/total/rate.
		let statsGetter: (() => { streak: number; total: number; rate: number }) | null = null;
		const statsBtn = headerActions.createEl('button', {
			cls: 'dashboard-section-add-btn',
			attr: { 'aria-label': t('heatmap.stats') },
		});
		setIcon(statsBtn, 'bar-chart-2');
		let statsPopup: HTMLElement | null = null;
		statsBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			if (statsPopup) { statsPopup.remove(); statsPopup = null; return; }
			if (!statsGetter) return;
			const s = statsGetter();
			statsPopup = activeDocument.body.createDiv({ cls: 'dashboard-heatmap-stats-popup' });
			const rect = statsBtn.getBoundingClientRect();
			statsPopup.setCssProps({ position: 'fixed', top: `${rect.bottom + 6}px`, left: `${Math.max(8, rect.right - 160)}px`, zIndex: '9999' });
			const mkRow = (icon: string, text: string): void => {
				const row = statsPopup!.createDiv({ cls: 'dashboard-heatmap-stats-popup-row' });
				const ic = row.createSpan({ cls: 'dashboard-heatmap-stats-popup-icon' });
				setIcon(ic, icon);
				row.createSpan({ text });
			};
			mkRow('flame', t('heatmap.streak', { count: s.streak }));
			mkRow('bar-chart-2', t('heatmap.total', { count: s.total }));
			mkRow('circle-check', t('heatmap.rate', { rate: s.rate }));
			const close = (ev: MouseEvent): void => {
				if (statsPopup && !statsPopup.contains(ev.target as Node) && ev.target !== statsBtn) {
					statsPopup.remove(); statsPopup = null;
					activeDocument.removeEventListener('mousedown', close);
				}
			};
			window.setTimeout(() => activeDocument.addEventListener('mousedown', close), 0);
		});

		const deleteSectionBtn = headerActions.createEl('button', {
			cls: 'dashboard-section-add-btn dashboard-section-delete-btn',
			attr: { 'aria-label': t('renderer.deleteSection', { column: column.name }) },
		});
		setIcon(deleteSectionBtn, 'trash-2');
		deleteSectionBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			callbacks.onColumnDelete(column.name);
		});

		renderHeatmapSection(el, column, app, (getter) => { statsGetter = getter; });
		return el;
	}


	const addCardBtn = headerActions.createEl('button', {
		cls: 'dashboard-section-add-btn',
		attr: { 'aria-label': t('renderer.addCardTo', { column: column.name }) },
	});
	setIcon(addCardBtn, 'plus');
	addCardBtn.addEventListener('click', () => callbacks.onCardAdd(column.name));

	const deleteSectionBtn = headerActions.createEl('button', {
		cls: 'dashboard-section-add-btn dashboard-section-delete-btn',
		attr: { 'aria-label': t('renderer.deleteSection', { column: column.name }) },
	});
	setIcon(deleteSectionBtn, 'trash-2');
	deleteSectionBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		callbacks.onColumnDelete(column.name);
	});

	const cardsContainer = el.createDiv({ cls: 'dashboard-section-cards' });

	for (const card of column.cards) {
		try {
			const cardEl = renderCard(card, column.name, sectionType, callbacks, app, data, settings);
			cardsContainer.appendChild(cardEl);
		} catch (err) {
			console.error('[Dashboard] renderCard error:', card.id, card.type, err);
		}
	}

	return el;
}

// ===== Card Rendering =====

function renderCard(card: DashboardCard, columnName: string, sectionType: string, callbacks: RenderCallbacks, app: App, data?: DashboardData, settings?: DashboardSettings): HTMLElement {
	const el = createDiv();
	el.addClass('dashboard-card', `dashboard-card--${card.type}`);
	el.dataset.cardId = card.id;
	el.dataset.cardType = card.type;
	el.setAttribute('role', 'article');
	el.setAttribute('aria-label', card.title);

	if (card.color) {
		el.dataset.hasColor = 'true';
		el.style.setProperty('--db-card-accent', card.color);
	}

	const isMemo = sectionType === 'memo';
	const isTask = card.type === 'task' || sectionType === 'todo';
	const isWeather = card.type === 'weather';
	const isTracker = card.type === 'tracker';
	const isWidget = isWeather || isTracker;
	const isProjectLike = !isMemo && !isTask && !isWidget;
	const isDashboardSection = sectionType === 'dashboard';
	const showCover = isProjectLike && !isDashboardSection && sectionType !== 'notes';

	if (showCover) {
		el.addClass('dashboard-card--cover');
	}

	if (card.coverImage && showCover) {
		const resolved = resolveVaultImage(app, card.coverImage);
		if (resolved) {
			const cover = el.createDiv({ cls: 'dashboard-project-cover' });
			cover.style.backgroundImage = `url("${resolved}")`;
			cover.setAttribute('draggable', 'true');
		} else {
			const cover = el.createDiv({ cls: 'dashboard-project-cover dashboard-project-cover--default' });
			cover.setAttribute('draggable', 'true');
		}
	} else if (showCover) {
		const cover = el.createDiv({ cls: 'dashboard-project-cover dashboard-project-cover--default' });
		cover.setAttribute('draggable', 'true');
	}

	const header = el.createDiv({ cls: 'dashboard-card-header' });
	header.setAttribute('draggable', 'true');

	// Mobile: tap header to toggle card action buttons
	header.addEventListener('touchstart', () => {
		const wasActive = header.hasClass('dashboard-card-header--touched');
		activeDocument.querySelectorAll('.dashboard-card-header--touched').forEach(el => {
			el.removeClass('dashboard-card-header--touched');
		});
		if (!wasActive) {
			header.addClass('dashboard-card-header--touched');
		}
	}, { passive: true });

	const titleEl = header.createEl('h4', { text: card.title, cls: 'dashboard-card-title' });

	const skipEditBtn = isMemo || isTask || (isWidget && isDashboardSection);

	titleEl.addEventListener('dblclick', (e) => {
		e.stopPropagation();
		const currentTitle = titleEl.getText();
		titleEl.empty();
		const input = titleEl.createEl('input', {
			cls: 'dashboard-title-edit-input',
			attr: { type: 'text', value: currentTitle },
		});
		input.focus();
		input.select();

		const finish = (save: boolean) => {
			const newTitle = input.value.trim();
			if (save && newTitle && newTitle !== currentTitle) {
				callbacks.onCardTitleEdit(card.id, newTitle);
			} else {
				titleEl.empty();
				titleEl.setText(currentTitle);
			}
		};

		input.addEventListener('keydown', (ke: KeyboardEvent) => {
			if (ke.key === 'Enter') {
				ke.preventDefault();
				finish(true);
			} else if (ke.key === 'Escape') {
				ke.preventDefault();
				finish(false);
			}
		});

		input.addEventListener('blur', () => {
			finish(true);
		});
	});
	titleEl.setCssProps({ cursor: 'pointer' });

	const actions = header.createDiv({ cls: 'dashboard-card-actions' });

	// Dashboard grid layout for widget cards
	if (isWidget && isDashboardSection) {
		const currentSize: CardSize = card.size || 'M';
		const sizeToGrid: Record<CardSize, { cols: number; rows: number }> = {
			S: { cols: 1, rows: 1 },
			M: { cols: 2, rows: 1 },
			L: { cols: 2, rows: 2 },
		};
		const grid = sizeToGrid[currentSize];
		el.style.gridColumn = `span ${grid.cols}`;
		el.style.gridRow = `span ${grid.rows}`;

		// Size selector button for dashboard widgets only
		const sizeBtn = actions.createEl('button', {
			cls: 'dashboard-card-btn dashboard-card-btn--size',
			attr: { 'aria-label': 'Card size' },
		});
		sizeBtn.setText(t('widget.size' + currentSize));
		sizeBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			const sizes: CardSize[] = ['S', 'M', 'L'];
			const nextIdx = (sizes.indexOf(currentSize) + 1) % sizes.length;
			const nextSize = sizes[nextIdx]!;
			callbacks.onCardSizeChange(card.id, nextSize);
		});
	}

	if (isMemo && (card.type === 'generic' || card.type === 'note') || isWidget) {
		const colorBtn = actions.createEl('button', {
			cls: 'dashboard-card-btn dashboard-card-btn--color',
			attr: { 'aria-label': t('renderer.setMemoColor') },
		});
		setIcon(colorBtn, 'palette');
		if (card.color) {
			colorBtn.style.color = card.color;
		}
		colorBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			const input = createEl('input');
			input.type = 'color';
			input.value = card.color || '#f59e0b';
			input.setCssProps({
				position: 'absolute',
				opacity: '0',
				width: '0',
				height: '0',
			});
			activeDocument.body.appendChild(input);
			input.addEventListener('input', () => {
				callbacks.onMemoColorChange(card, input.value);
			});
			input.addEventListener('change', () => {
				if (input.value) {
					callbacks.onMemoColorChange(card, input.value);
				}
				input.remove();
			});
			input.addEventListener('blur', () => {
				input.remove();
			});
			input.click();
		});
	}

	if (!skipEditBtn) {
		const editBtn = actions.createEl('button', {
			cls: 'dashboard-card-btn',
			attr: { 'aria-label': t('renderer.editCard') },
		});
		setIcon(editBtn, 'pencil');
		editBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			callbacks.onCardEdit(card);
		});
	}

	if (isMemo) {
		const saveBtn = actions.createEl('button', {
			cls: 'dashboard-card-btn',
			attr: { 'aria-label': t('renderer.saveMemoAsNote') },
		});
		setIcon(saveBtn, 'file-down');
		saveBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			callbacks.onMemoSaveAsNote(card);
		});
	}

	if (isTask) {
		const saveBtn = actions.createEl('button', {
			cls: 'dashboard-card-btn',
			attr: { 'aria-label': t('renderer.saveTasksToDaily') },
		});
		setIcon(saveBtn, 'save');
		saveBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			callbacks.onTaskSaveToDaily(card);
		});
	}

	const deleteBtn = actions.createEl('button', {
		cls: 'dashboard-card-btn dashboard-card-btn--danger',
		attr: { 'aria-label': t('renderer.deleteCard') },
	});
	setIcon(deleteBtn, 'trash-2');
	deleteBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		callbacks.onCardDelete(card.id);
	});

	const body = el.createDiv({ cls: 'dashboard-card-body' });

	// When this is a project-like card, allow dropping docs onto the card body
	if (isProjectLike) {
		body.addEventListener('dragover', (e) => {
			if (!docDragSource) return;
			if (docDragSource.cardId === card.id) return;
			e.preventDefault();
			if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
			body.addClass('dashboard-card-body--doc-drop');
		});

		body.addEventListener('dragleave', (e) => {
			if (!body.contains(e.relatedTarget as Node)) {
				body.removeClass('dashboard-card-body--doc-drop');
			}
		});

		body.addEventListener('drop', (e) => {
			body.removeClass('dashboard-card-body--doc-drop');
			if (!docDragSource) return;
			if (docDragSource.cardId === card.id) return;
			if (e.defaultPrevented) return;
			e.preventDefault();
			const destPath = [card.docs.length];
			callbacks.onDocMoveToCard(docDragSource.cardId, docDragSource.docPath, card.id, destPath, 'before');
		});
	}

	renderCardBody(body, card, columnName, sectionType, callbacks, app, data, settings);

	if (card.dueDate) {
		const due = el.createDiv({ cls: 'dashboard-card-due' });
		due.createSpan({ text: card.dueDate });
	}

	if (isMemo) {
		if (card.width > 0) {
			const w = Math.max(200, Math.min(600, card.width));
			el.style.flex = `0 0 ${w}px`;
			el.style.minWidth = `${w}px`;
			el.style.maxWidth = `${w}px`;
		}
	}

	// Dashboard grid layout for widget cards (styles only, button already created above)
	if (isWidget && isDashboardSection) {
		// grid styles already set above when creating the size button
	} else if (isMemo || isTask || isProjectLike) {
		const minW = 200;
		const maxW = 600;
		if (!isMemo && card.width > 0) {
			const w = Math.max(minW, Math.min(500, card.width));
			el.style.flex = `0 0 ${w}px`;
			el.style.minWidth = `${w}px`;
			el.style.maxWidth = `${w}px`;
		}
		const handle = el.createDiv({ cls: 'dashboard-card-resize-handle' });
		handle.addEventListener('mousedown', (e) => {
			e.preventDefault();
			e.stopPropagation();
			const startX = e.clientX;
			const startWidth = el.offsetWidth;
			el.addClass('dashboard-card--resizing');

			const onMove = (ev: MouseEvent) => {
				const delta = ev.clientX - startX;
				const newWidth = Math.max(minW, Math.min(maxW, startWidth + delta));
				el.style.flex = `0 0 ${newWidth}px`;
				el.style.minWidth = `${newWidth}px`;
				el.style.maxWidth = `${newWidth}px`;
			};

			const onUp = (ev: MouseEvent) => {
				activeDocument.removeEventListener('mousemove', onMove);
				activeDocument.removeEventListener('mouseup', onUp);
				el.removeClass('dashboard-card--resizing');
				const finalWidth = Math.max(minW, Math.min(maxW, startWidth + (ev.clientX - startX)));
				if (finalWidth !== card.width) {
					callbacks.onCardWidthChange(card.id, finalWidth);
				}
			};

			activeDocument.addEventListener('mousemove', onMove);
			activeDocument.addEventListener('mouseup', onUp);
		});
	}

	return el;
}

function renderCardBody(container: HTMLElement, card: DashboardCard, columnName: string, sectionType: string, callbacks: RenderCallbacks, app: App, data?: DashboardData, settings?: DashboardSettings): void {
	if (card.type === 'weather') {
		renderWeatherBody(container, card, app);
		return;
	}

	if (card.type === 'tracker') {
		renderTrackerBody(container, card, app, settings);
		return;
	}

	const isMemo = sectionType === 'memo';
	const isTaskCard = card.type === 'task' || sectionType === 'todo';

	if (isTaskCard) {
		renderTaskBody(container, card, callbacks, app);
		return;
	}

	if (isMemo) {
		renderMemoBody(container, card, callbacks, app);
		return;
	}

	// All non-memo, non-task cards render as project body
	renderProjectBody(container, card, callbacks, app);
}
