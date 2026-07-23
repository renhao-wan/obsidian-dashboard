import { App, Platform, setIcon } from 'obsidian';
import type { DashboardCard, DashboardColumn, TaskItem, DocNode, DashboardSettings, CardSize, TrackerStyle, WeatherData, RenderCallbacks } from '../core/types';
import { t, getLanguage } from '../utils/i18n';
import { fetchWeather, getCachedWeather, getWeatherEmoji, getWeatherDescription } from '../services/weather';
import { readTrackerData, computeStreak } from '../services/tracker';
import { attachFileSuggest } from '../utils/file-suggest';
import { showConfirmDialog } from '../components/confirm-dialog';
import { attachNoteHover } from '../modals/hover-preview';
import { Chart } from 'chart.js';
import {
	getCSSVar,
	chartInstances,
	destroyChart,
	taskDragSource,
	docDragSource,
	activeHoverParent,
	activeNoteOpener,
	setTaskDragSource,
	setDocDragSource,
	resolveNoteFile,
	getSearchableFiles,
} from './utils';

// ===== Section Type Detection =====

export function getSectionType(column: DashboardColumn): string {
	if (column.sectionType) return column.sectionType;
	const lower = column.name.toLowerCase();
	if (lower === 'memo') return 'memo';
	if (lower === 'todo') return 'todo';
	if (lower === 'projects') return 'projects';
	if (lower === 'notes') return 'notes';
	if (lower === 'dashboard') return 'dashboard';
	if (lower === 'library') return 'library';
	if (lower === 'folder') return 'folder';
	if (lower === 'images') return 'images';
	if (lower === 'videos') return 'videos';
	if (lower === 'alltasks') return 'alltasks';
	if (lower === 'calendar') return 'calendar';
	if (column.cards.length > 0) {
		const types = new Set(column.cards.map(c => c.type));
		const dashboardTypes = new Set(['chart', 'weather', 'tracker']);
		if ([...types].every(t => dashboardTypes.has(t)) && types.size > 0) return 'dashboard';
		if (types.has('task') && types.size === 1) return 'todo';
		if (types.has('task') && !types.has('project')) return 'todo';
		if (types.has('project') && types.size === 1) return 'projects';
		if (types.has('generic') && !types.has('project') && !types.has('task')) return 'memo';
	}
	return 'projects';
}

// ===== Text & Link Rendering =====

export function renderTextWithLinks(container: HTMLElement, text: string, app: App): void {
	const parts = text.split(/(\[\[[^\]]+?\]\]|\[[^\]]+\]\([^)]+\))/g);
	for (const part of parts) {
		const wikiMatch = part.match(/^\[\[([^\]]+)\]\]$/);
		if (wikiMatch) {
			renderWikilink(container, wikiMatch[1]!, app);
			continue;
		}
		const extMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
		if (extMatch) {
			renderExternalLink(container, extMatch[1]!, extMatch[2]!);
			continue;
		}
		if (part) {
			container.appendChild(activeDocument.createTextNode(part));
		}
	}
}

function renderWikilink(container: HTMLElement, content: string, app: App): void {
	let alias: string | undefined;
	let linkPart = content;

	const pipeIdx = content.indexOf('|');
	if (pipeIdx !== -1) {
		alias = content.slice(pipeIdx + 1);
		linkPart = content.slice(0, pipeIdx);
	}

	let path = linkPart;
	let fragment: string | undefined;

	const hashIdx = linkPart.indexOf('#');
	if (hashIdx !== -1) {
		path = linkPart.slice(0, hashIdx);
		fragment = linkPart.slice(hashIdx + 1);
	}

	const noteName = path.split('/').pop()?.replace(/\.md$/, '') ?? path;
	let displayName: string;
	if (alias) {
		displayName = alias;
	} else if (fragment) {
		displayName = `${noteName} > ${fragment}`;
	} else {
		displayName = noteName;
	}

	const link = container.createSpan({
		cls: 'dashboard-wikilink',
		text: displayName,
	});

	const file = resolveNoteFile(app, path);

	if (file && !Platform.isMobile && activeHoverParent) {
		attachNoteHover(app, link, file, activeHoverParent);
	}

	link.addEventListener('click', (e) => {
		e.stopPropagation();
		if (!file) return;
		activeNoteOpener?.(file);
	});
}

function renderExternalLink(container: HTMLElement, text: string, url: string): void {
	const link = container.createSpan({
		cls: 'dashboard-external-link',
		text: text,
	});
	link.addEventListener('click', (e) => {
		e.stopPropagation();
		window.open(url, '_blank');
	});
}

// ===== Task Rendering =====

export function renderTaskItem(
	list: HTMLElement,
	task: TaskItem,
	path: number[],
	card: DashboardCard,
	callbacks: RenderCallbacks,
	app: App,
	depth: number,
): void {
	const item = list.createDiv({ cls: 'dashboard-task-item' });
	if (depth > 0) item.addClass('dashboard-task-item--child');
	item.style.marginLeft = `${depth * 18}px`;
	item.setAttribute('draggable', 'true');
	item.dataset.taskPath = JSON.stringify(path);
	item.dataset.cardId = card.id;

	const clearDragClasses = () => {
		item.removeClass('dashboard-task-item--drag-top');
		item.removeClass('dashboard-task-item--drag-bottom');
		item.removeClass('dashboard-task-item--drag-nest');
	};

	// Mobile gestures: tap (show buttons), long-press (drag), quick-swipe (nest/unnest)
	let touchState: {
		startX: number;
		startY: number;
		startT: number;
		moved: boolean;
		dragging: boolean;
		timer: number | null;
	} | null = null;

	item.addEventListener('touchstart', (e) => {
		const tch = e.touches[0];
		if (!tch) return;
		touchState = {
			startX: tch.clientX,
			startY: tch.clientY,
			startT: Date.now(),
			moved: false,
			dragging: false,
			timer: null,
		};
		touchState.timer = window.setTimeout(() => {
			if (touchState && !touchState.moved) {
				touchState.dragging = true;
				item.addClass('dashboard-task-item--dragging');
			}
		}, 500);
	}, { passive: true });

	item.addEventListener('touchmove', (e) => {
		if (!touchState) return;
		const tch = e.touches[0];
		if (!tch) return;
		const dx = tch.clientX - touchState.startX;
		const dy = tch.clientY - touchState.startY;
		if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
			touchState.moved = true;
			if (touchState.timer) {
				window.clearTimeout(touchState.timer);
				touchState.timer = null;
			}
		}
		if (!touchState.dragging && touchState.moved && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
			item.style.transform = `translateX(${Math.max(-40, Math.min(40, dx * 0.5))}px)`;
		}
	}, { passive: true });

	item.addEventListener('touchend', (e) => {
		const ts = touchState;
		touchState = null;
		item.setCssProps({ transform: '' });
		if (!ts) return;
		if (ts.timer) window.clearTimeout(ts.timer);
		if (ts.dragging) {
			item.removeClass('dashboard-task-item--dragging');
			return;
		}
		const tch = e.changedTouches[0];
		const dx = tch ? tch.clientX - ts.startX : 0;
		const dy = tch ? tch.clientY - ts.startY : 0;
		const dt = Date.now() - ts.startT;
		const isSwipe = dt < 500 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5;
		if (isSwipe) {
			if (dx > 0) callbacks.onTaskNest(card.id, path);
			else callbacks.onTaskUnnest(card.id, path);
			return;
		}
		if (!ts.moved) {
			const wasActive = item.hasClass('dashboard-task-item--touched');
			activeDocument.querySelectorAll('.dashboard-task-item--touched').forEach(el => {
				el.removeClass('dashboard-task-item--touched');
			});
			if (!wasActive) item.addClass('dashboard-task-item--touched');
		}
	}, { passive: true });

	item.addEventListener('touchcancel', () => {
		if (touchState?.timer) window.clearTimeout(touchState.timer);
		touchState = null;
		item.setCssProps({ transform: '' });
		item.removeClass('dashboard-task-item--dragging');
	}, { passive: true });

	const hasChildren = (task.children?.length ?? 0) > 0;
	if (hasChildren) {
		const toggle = item.createDiv({ cls: 'dashboard-task-toggle dashboard-task-toggle--active' });
		toggle.setAttribute('role', 'button');
		toggle.setAttribute('aria-label', task.collapsed ? t('renderer.expandTask') : t('renderer.collapseTask'));
		setIcon(toggle, task.collapsed ? 'chevron-right' : 'chevron-down');
		toggle.addEventListener('click', (e) => {
			e.stopPropagation();
			callbacks.onTaskToggleCollapse(card.id, path);
		});
	}

	const checkbox = item.createEl('input', {
		cls: 'dashboard-task-checkbox',
		attr: { type: 'checkbox' },
	});
	checkbox.checked = task.checked;
	checkbox.addEventListener('change', () => {
		callbacks.onCheckboxToggle(card.id, path, checkbox.checked);
	});

	const label = item.createSpan({
		cls: task.checked ? 'dashboard-task-text dashboard-task-text--done' : 'dashboard-task-text',
	});
	renderTextWithLinks(label, task.text, app);
	label.addEventListener('dblclick', (e) => {
		e.stopPropagation();
		const currentText = label.getText();
		label.empty();
		item.setAttribute('draggable', 'false');

		const textarea = label.createEl('textarea', {
			cls: 'dashboard-task-edit-textarea',
			text: task.text,
		});

		const autoResize = () => {
			textarea.setCssProps({ height: 'auto' });
			textarea.style.height = textarea.scrollHeight + 'px';
		};
		autoResize();
		textarea.focus();
		textarea.setSelectionRange(textarea.value.length, textarea.value.length);

		const finish = (save: boolean) => {
			const newText = textarea.value.trim();
			if (save && newText && newText !== task.text) {
				callbacks.onTaskEdit(card.id, path, newText);
			} else {
				label.empty();
				label.setText(currentText);
			}
			item.setAttribute('draggable', 'true');
		};

		textarea.addEventListener('input', autoResize);
		textarea.addEventListener('keydown', (ke) => {
			if (ke.key === 'Enter' && !ke.shiftKey) {
				ke.preventDefault();
				finish(true);
			} else if (ke.key === 'Escape') {
				ke.preventDefault();
				finish(false);
			}
		});
		textarea.addEventListener('blur', () => finish(true));
	});

	const delBtn = item.createEl('button', {
		cls: 'dashboard-task-delete',
		attr: { 'aria-label': t('renderer.deleteTask') },
	});
	setIcon(delBtn, 'x');
	delBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		callbacks.onTaskDelete(card.id, path);
	});

	const reminderBtn = createReminderButton(item, card.id, path, task, callbacks);
	item.appendChild(reminderBtn);

	item.addEventListener('dragstart', (e) => {
		e.stopPropagation();
		setTaskDragSource({ cardId: card.id, taskPath: path });
		item.addClass('dashboard-task-item--dragging');
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', JSON.stringify(path));
		}
	});

	item.addEventListener('dragend', () => {
		item.removeClass('dashboard-task-item--dragging');
		activeDocument.querySelectorAll(
			'.dashboard-task-item--drag-top,.dashboard-task-item--drag-bottom,.dashboard-task-item--drag-nest'
		).forEach(el => el.removeClass('dashboard-task-item--drag-top', 'dashboard-task-item--drag-bottom', 'dashboard-task-item--drag-nest'));
		setTaskDragSource(null);
	});

	item.addEventListener('dragover', (e) => {
		e.preventDefault();
		e.stopPropagation();
		if (!taskDragSource) return;
		const sameNode = taskDragSource.cardId === card.id &&
			JSON.stringify(taskDragSource.taskPath) === JSON.stringify(path);
		if (sameNode) return;
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		activeDocument.querySelectorAll(
			'.dashboard-task-item--drag-top,.dashboard-task-item--drag-bottom,.dashboard-task-item--drag-nest'
		).forEach(el => el.removeClass('dashboard-task-item--drag-top', 'dashboard-task-item--drag-bottom', 'dashboard-task-item--drag-nest'));
		const rect = item.getBoundingClientRect();
		const ratio = (e.clientY - rect.top) / rect.height;
		if (ratio < 0.3) item.addClass('dashboard-task-item--drag-top');
		else if (ratio > 0.7) item.addClass('dashboard-task-item--drag-bottom');
		else item.addClass('dashboard-task-item--drag-nest');
	});

	item.addEventListener('dragleave', () => {
		clearDragClasses();
	});

	item.addEventListener('drop', (e) => {
		e.preventDefault();
		e.stopPropagation();
		clearDragClasses();
		if (!taskDragSource) return;
		const sameNode = taskDragSource.cardId === card.id &&
			JSON.stringify(taskDragSource.taskPath) === JSON.stringify(path);
		if (sameNode) return;

		const rect = item.getBoundingClientRect();
		const ratio = (e.clientY - rect.top) / rect.height;
		const src = taskDragSource;

		if (src.cardId === card.id) {
			if (ratio < 0.3) callbacks.onTaskReorder(card.id, src.taskPath, path, true);
			else if (ratio > 0.7) callbacks.onTaskReorder(card.id, src.taskPath, path, false);
			else callbacks.onTaskNestInto(card.id, src.taskPath, path);
		} else {
			const mode: 'before' | 'after' | 'nest' = ratio < 0.3 ? 'before' : ratio > 0.7 ? 'after' : 'nest';
			callbacks.onTaskMoveToCard(src.cardId, src.taskPath, card.id, path, mode);
		}
	});

	if (task.children && task.children.length > 0 && !task.collapsed) {
		for (let i = 0; i < task.children.length; i++) {
			renderTaskItem(list, task.children[i]!, [...path, i], card, callbacks, app, depth + 1);
		}
	}
}

export function renderTaskBody(container: HTMLElement, card: DashboardCard, callbacks: RenderCallbacks, app: App): void {
	const list = container.createDiv({ cls: 'dashboard-task-list' });
	list.dataset.cardId = card.id;

	// When the list is empty, make it a drop target so tasks can be dragged in
	list.addEventListener('dragover', (e) => {
		if (!taskDragSource) return;
		if (taskDragSource.cardId === card.id) return;
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		list.addClass('dashboard-task-list--drop-target');
	});

	list.addEventListener('dragleave', (e) => {
		if (!list.contains(e.relatedTarget as Node)) {
			list.removeClass('dashboard-task-list--drop-target');
		}
	});

	list.addEventListener('drop', (e) => {
		e.preventDefault();
		list.removeClass('dashboard-task-list--drop-target');
		if (!taskDragSource) return;
		if (taskDragSource.cardId === card.id) return;
		callbacks.onTaskMoveToCard(taskDragSource.cardId, taskDragSource.taskPath, card.id, [card.tasks.length], 'before');
	});

	card.tasks.forEach((task, i) => renderTaskItem(list, task, [i], card, callbacks, app, 0));

	const addRow = container.createDiv({ cls: 'dashboard-task-add' });
	const input = addRow.createEl('input', {
		cls: 'dashboard-task-input',
		attr: { type: 'text', placeholder: t('renderer.addTask') },
	});
	const taskSuggest = attachFileSuggest(input, app);
	input.addEventListener('keydown', (e) => {
		if (taskSuggest.isActive()) return;
		if (e.key === 'Enter' && input.value.trim()) {
			callbacks.onTaskAdd(card.id, input.value.trim());
			input.value = '';
		}
	});

	if (card.tasks.length > 0) {
		const checkedCount = card.tasks.filter(t => t.checked).length;
		const total = card.tasks.length;
		const percent = Math.round((checkedCount / total) * 100);

		const progressWrap = container.createDiv({ cls: 'dashboard-progress' });
		const bar = progressWrap.createDiv({ cls: 'dashboard-progress-bar' });
		bar.createDiv({
			cls: 'dashboard-progress-fill',
			attr: { style: `width: ${percent}%` },
		});
		progressWrap.createSpan({
			cls: 'dashboard-progress-text',
			text: `${percent}%`,
		});
	}
}

// ===== Memo Rendering =====

export function renderMemoBody(container: HTMLElement, card: DashboardCard, callbacks: RenderCallbacks, app: App): void {
	const text = [card.blockquote, card.body].filter(Boolean).join('\n');
	let dirty = false;

	// View mode: rendered text with clickable links
	const view = container.createDiv({ cls: 'dashboard-memo-view' });
	renderMemoViewContent(view, text, app);
	view.addEventListener('click', () => {
		view.setCssProps({ display: 'none' });
		textarea.setCssProps({ display: '' });
		textarea.focus();
	});

	// Edit mode: textarea (hidden by default)
	const textarea = container.createEl('textarea', {
		cls: 'dashboard-memo-textarea',
		text: text,
		attr: { placeholder: t('renderer.writeThoughts') },
	});
	textarea.setCssProps({ display: 'none' });

	attachFileSuggest(textarea, app);

	textarea.addEventListener('input', () => {
		dirty = true;
	});

	const save = () => {
		if (!dirty) return;
		dirty = false;
		const value = textarea.value;
		const lines = value.split('\n');
		const quoteLines: string[] = [];
		const bodyLines: string[] = [];

		for (const line of lines) {
			if (line.startsWith('> ')) {
				quoteLines.push(line.slice(2));
			} else {
				bodyLines.push(line);
			}
		}

		callbacks.onMemoUpdate(card, {
			body: bodyLines.join('\n').trim(),
			blockquote: quoteLines.join('\n'),
		});
	};

	textarea.addEventListener('blur', () => {
		save();
		// If re-render didn't happen (not dirty), switch to view manually
		if (activeDocument.body.contains(view)) {
			renderMemoViewContent(view, textarea.value, app);
			view.setCssProps({ display: '' });
			textarea.setCssProps({ display: 'none' });
		}
	});
}

export function renderMemoViewContent(container: HTMLElement, text: string, app: App): void {
	container.empty();
	if (!text) {
		container.addClass('dashboard-memo-view--empty');
		container.setText(t('renderer.writeThoughts'));
		return;
	}
	container.removeClass('dashboard-memo-view--empty');

	const lines = text.split('\n');
	for (let i = 0; i < lines.length; i++) {
		if (i > 0) container.createEl('br');
		const line = lines[i]!;
		if (line.startsWith('> ')) {
			const quote = container.createDiv({ cls: 'dashboard-note-quote' });
			quote.setText(line.slice(2));
		} else {
			renderTextWithLinks(container, line, app);
		}
	}
}

// ===== Project Doc Rendering =====

export function renderProjectBody(container: HTMLElement, card: DashboardCard, callbacks: RenderCallbacks, app: App): void {
	const collectDocPaths = (docs: DocNode[]): string[] => {
		const out: string[] = [];
		const walk = (nodes: DocNode[]) => {
			for (const n of nodes) {
				out.push(n.path);
				if (n.children) walk(n.children);
			}
		};
		walk(docs);
		return out;
	};

	const clearDragClasses = () => {
		activeDocument.querySelectorAll(
			'.dashboard-task-item--drag-top,.dashboard-task-item--drag-bottom,.dashboard-task-item--drag-nest,.dashboard-task-item--drag-over,.dashboard-task-item--dragging'
		).forEach(el => {
			(el as HTMLElement).removeClass(
				'dashboard-task-item--drag-top',
				'dashboard-task-item--drag-bottom',
				'dashboard-task-item--drag-nest',
				'dashboard-task-item--drag-over',
				'dashboard-task-item--dragging',
			);
		});
	};

	const docList = container.createDiv({ cls: 'dashboard-project-docs' });
	docList.dataset.cardId = card.id;

	// Empty list drop target so docs can be dragged in (appends at top-level end)
	docList.addEventListener('dragover', (e) => {
		if (!docDragSource) return;
		if (docDragSource.cardId === card.id) return;
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		docList.addClass('dashboard-project-docs--drop-target');
	});

	docList.addEventListener('dragleave', (e) => {
		if (!docList.contains(e.relatedTarget as Node)) {
			docList.removeClass('dashboard-project-docs--drop-target');
		}
	});

	docList.addEventListener('drop', (e) => {
		e.preventDefault();
		docList.removeClass('dashboard-project-docs--drop-target');
		if (!docDragSource) return;
		if (docDragSource.cardId === card.id) return;
		const destPath = [card.docs.length];
		callbacks.onDocMoveToCard(docDragSource.cardId, docDragSource.docPath, card.id, destPath, 'before');
	});

	const renderDocItem = (doc: DocNode, path: number[], depth: number) => {
		const docItem = docList.createDiv({ cls: 'dashboard-project-doc-item' });
		if (depth > 0) docItem.addClass('dashboard-project-doc-item--child');
		docItem.style.marginLeft = `${depth * 18}px`;
		docItem.setAttribute('draggable', 'true');
		docItem.dataset.docPath = JSON.stringify(path);

		const hasChildren = (doc.children?.length ?? 0) > 0;
		if (hasChildren) {
			const toggle = docItem.createDiv({ cls: 'dashboard-task-toggle dashboard-task-toggle--active' });
			toggle.setAttribute('role', 'button');
			toggle.setAttribute('aria-label', doc.collapsed ? t('renderer.expandDoc') : t('renderer.collapseDoc'));
			setIcon(toggle, doc.collapsed ? 'chevron-right' : 'chevron-down');
			toggle.addEventListener('click', (e) => {
				e.stopPropagation();
				callbacks.onDocToggleCollapse(card.id, path);
			});
		}

		const resolved = resolveNoteFile(app, doc.path);
		docItem.createSpan({ text: resolved?.basename ?? doc.path.split('/').pop() ?? doc.path, cls: 'dashboard-project-doc-name' });

		if (resolved && !Platform.isMobile && activeHoverParent) {
			attachNoteHover(app, docItem, resolved, activeHoverParent);
		}

		const removeBtn = docItem.createEl('button', {
			cls: 'dashboard-project-doc-remove',
			attr: { 'aria-label': t('renderer.removeDoc') },
		});
		setIcon(removeBtn, 'x');
		removeBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			void (async () => {
				const confirmed = await showConfirmDialog(app, {
					title: t('common.confirmDelete'),
					message: t('common.confirmDeleteMessage'),
				});
				if (!confirmed) return;
				callbacks.onDocDelete(card.id, path);
			})();
		});

		docItem.addEventListener('click', (e) => {
			if ((e.target as HTMLElement).tagName === 'BUTTON') return;
			if (!resolved) return;
			activeNoteOpener?.(resolved);
		});

		docItem.addEventListener('dragstart', (e) => {
			e.stopPropagation();
			setDocDragSource({ cardId: card.id, docPath: path });
			docItem.addClass('dashboard-task-item--dragging');
			if (e.dataTransfer) {
				e.dataTransfer.effectAllowed = 'move';
				e.dataTransfer.setData('text/plain', JSON.stringify(path));
			}
		});

		docItem.addEventListener('dragend', () => {
			docItem.removeClass('dashboard-task-item--dragging');
			clearDragClasses();
			setDocDragSource(null);
		});

		docItem.addEventListener('dragover', (e) => {
			e.preventDefault();
			e.stopPropagation();
			if (!docDragSource) return;
			const sameNode = docDragSource.cardId === card.id &&
				JSON.stringify(docDragSource.docPath) === JSON.stringify(path);
			if (sameNode) return;
			if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
			clearDragClasses();
			const rect = docItem.getBoundingClientRect();
			const ratio = (e.clientY - rect.top) / rect.height;
			if (ratio < 0.3) docItem.addClass('dashboard-task-item--drag-top');
			else if (ratio > 0.7) docItem.addClass('dashboard-task-item--drag-bottom');
			else docItem.addClass('dashboard-task-item--drag-nest');
		});

		docItem.addEventListener('dragleave', () => {
			docItem.removeClass('dashboard-task-item--drag-top');
			docItem.removeClass('dashboard-task-item--drag-bottom');
			docItem.removeClass('dashboard-task-item--drag-nest');
		});

		docItem.addEventListener('drop', (e) => {
			e.preventDefault();
			e.stopPropagation();
			clearDragClasses();
			if (!docDragSource) return;
			const sameNode = docDragSource.cardId === card.id &&
				JSON.stringify(docDragSource.docPath) === JSON.stringify(path);
			if (sameNode) return;

			const rect = docItem.getBoundingClientRect();
			const ratio = (e.clientY - rect.top) / rect.height;
			const src = docDragSource;

			if (src.cardId === card.id) {
				if (ratio < 0.3) callbacks.onDocReorder(card.id, src.docPath, path, true);
				else if (ratio > 0.7) callbacks.onDocReorder(card.id, src.docPath, path, false);
				else callbacks.onDocNest(card.id, src.docPath);
			} else {
				const mode: 'before' | 'after' | 'nest' = ratio < 0.3 ? 'before' : ratio > 0.7 ? 'after' : 'nest';
				callbacks.onDocMoveToCard(src.cardId, src.docPath, card.id, path, mode);
			}
		});

		if (hasChildren && !doc.collapsed) {
			doc.children!.forEach((child, i) => renderDocItem(child, [...path, i], depth + 1));
		}
	};

	card.docs.forEach((doc, i) => renderDocItem(doc, [i], 0));

	const addDocRow = container.createDiv({ cls: 'dashboard-project-add-doc' });
	const docInput = addDocRow.createEl('input', {
		cls: 'dashboard-task-input',
		attr: { type: 'text', placeholder: t('renderer.addDocument') },
	});

	const docResults = addDocRow.createDiv({ cls: 'dashboard-project-doc-results' });

	docInput.addEventListener('input', () => {
		docResults.empty();
		const q = docInput.value.toLowerCase().trim();
		if (!q) return;

		const currentPaths = collectDocPaths(card.docs);
		const files = getSearchableFiles(app)
			.filter(f => !f.path.startsWith('.'))
			.filter(f => f.path.toLowerCase().includes(q) || f.basename.toLowerCase().includes(q))
			.filter(f => !currentPaths.includes(f.path))
			.slice(0, 50);

		for (const file of files) {
			const item = docResults.createDiv({ cls: 'dashboard-project-doc-result' });
			item.setText(file.basename);
			item.addEventListener('click', () => {
				callbacks.onDocAdd(card.id, file.path);
			});
		}
	});

	docInput.addEventListener('blur', () => {
		window.setTimeout(() => docResults.empty(), 200);
	});
}

// ===== Reminder =====

function isReminderOverdue(reminder: string): boolean {
	const now = new Date();
	const parts = reminder.trim().split(/\s+/);
	if (parts.length < 2) return false;
	const dateStr = parts[0]!;
	const timeStr = parts[1]!;
	const [year, month, day] = dateStr.split('-').map(Number);
	const [hour, min] = timeStr.split(':').map(Number);
	if (!year || !month || !day) return false;
	const due = new Date(year, month - 1, day, hour ?? 0, min ?? 0);
	return now >= due;
}

function createReminderButton(
	taskItem: HTMLElement,
	cardId: string,
	taskPath: number[],
	task: TaskItem,
	callbacks: RenderCallbacks,
): HTMLElement {
	const btn = createEl('button');
	btn.setAttribute('draggable', 'false');
	btn.addClass('dashboard-task-reminder-btn');

	if (task.reminder) {
		btn.addClass('dashboard-task-reminder-btn--active');
		setIcon(btn, 'bell-ring');
		btn.setAttribute('aria-label', t('reminder.editReminder'));
		if (!task.checked && isReminderOverdue(task.reminder)) {
			btn.addClass('dashboard-task-reminder-btn--overdue');
		}
	} else {
		setIcon(btn, 'bell');
		btn.setAttribute('aria-label', t('reminder.setReminder'));
	}

	btn.addEventListener('click', (e: MouseEvent) => {
		e.stopPropagation();
		e.preventDefault();
		showReminderPopup(btn, cardId, taskPath, task, callbacks);
	});

	return btn;
}

function showReminderPopup(
	anchorBtn: HTMLElement,
	cardId: string,
	taskPath: number[],
	task: TaskItem,
	callbacks: RenderCallbacks,
): void {
	closeAllReminderPopups();

	const popup = activeDocument.body.createDiv({ cls: 'dashboard-task-reminder-popup' });

	// Inherit theme variables from dashboard root (popup is on body, outside theme scope)
	const dashboardRoot = anchorBtn.closest('.obsidian-dashboard-root') as HTMLElement;
	if (dashboardRoot) {
		const rs = getComputedStyle(dashboardRoot);
		const themeVars = ['--db-bg', '--db-bg-card', '--db-bg-card-hover', '--db-border-card',
			'--db-text', '--db-text-muted', '--db-accent', '--db-radius-md', '--db-radius-sm', '--db-font'];
		themeVars.forEach(v => {
			const val = rs.getPropertyValue(v).trim();
			if (val) popup.style.setProperty(v, val);
		});
	}

	const rect = anchorBtn.getBoundingClientRect();
	popup.setCssProps({
		position: 'fixed',
		top: `${rect.bottom + 4}px`,
	});

	const popupWidth = 240;
	if (rect.left + popupWidth > window.innerWidth) {
		popup.style.right = `${window.innerWidth - rect.right}px`;
	} else {
		popup.style.left = `${rect.left}px`;
	}

	// Scroll & resize tracking — reposition popup when content moves
	const updatePopupPosition = () => {
		const r = anchorBtn.getBoundingClientRect();
		if (r.height === 0 || r.bottom < 0 || r.top > window.innerHeight
			|| r.right < 0 || r.left > window.innerWidth) {
			closeAllReminderPopups();
			return;
		}
		popup.style.top = `${r.bottom + 4}px`;
		if (r.left + popupWidth > window.innerWidth) {
			popup.setCssProps({
				right: `${window.innerWidth - r.right}px`,
				left: 'auto',
			});
		} else {
			popup.setCssProps({
				left: `${r.left}px`,
				right: 'auto',
			});
		}
	};
	activeDocument.addEventListener('scroll', updatePopupPosition, { passive: true, capture: true });
	window.addEventListener('resize', updatePopupPosition);
	(popup as HTMLElement & { __reminderCleanup?: () => void }).__reminderCleanup = () => {
		activeDocument.removeEventListener('scroll', updatePopupPosition, { capture: true });
		window.removeEventListener('resize', updatePopupPosition);
	};

	// Parse initial values
	let selectedYear: number;
	let selectedMonth: number;
	let selectedDay: number;
	let selectedHour = 9;
	let selectedMin = 0;

	const now = new Date();
	if (task.reminder) {
		const parts = task.reminder.trim().split(/\s+/);
		const dp = parts[0]?.split('-').map(Number) ?? [];
		const tp = parts[1]?.split(':').map(Number) ?? [];
		selectedYear = dp[0] ?? now.getFullYear();
		selectedMonth = (dp[1] ?? now.getMonth() + 1) - 1;
		selectedDay = dp[2] ?? now.getDate();
		selectedHour = tp[0] ?? 9;
		selectedMin = tp[1] ?? 0;
	} else {
		selectedYear = now.getFullYear();
		selectedMonth = now.getMonth();
		selectedDay = now.getDate();
	}

	const viewYear = { value: selectedYear };
	const viewMonth = { value: selectedMonth };

	const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

	// Calendar nav
	const calNav = popup.createDiv({ cls: 'dashboard-task-reminder-calendar-nav' });
	const prevBtn = calNav.createEl('button', { text: '<' });
	const monthLabel = calNav.createSpan();
	const nextBtn = calNav.createEl('button', { text: '>' });

	// Calendar grid
	const calGrid = popup.createDiv({ cls: 'dashboard-task-reminder-calendar' });

	// Time picker
	const timeRow = popup.createDiv({ cls: 'dashboard-task-reminder-time' });
	const hourSelect = timeRow.createEl('select');
	for (let h = 0; h < 24; h++) {
		const opt = hourSelect.createEl('option', { text: String(h).padStart(2, '0'), attr: { value: String(h) } });
		if (h === selectedHour) opt.selected = true;
	}
	timeRow.createSpan({ text: ':' });
	const minSelect = timeRow.createEl('select');
	for (let m = 0; m < 60; m++) {
		const opt = minSelect.createEl('option', { text: String(m).padStart(2, '0'), attr: { value: String(m) } });
		if (m === selectedMin) opt.selected = true;
	}

	// Action buttons
	const btnRow = popup.createDiv({ cls: 'dashboard-task-reminder-popup-btns' });
	const saveBtn = btnRow.createEl('button', { cls: 'mod-cta', text: t('common.save') });
	if (task.reminder) {
		btnRow.createEl('button', { cls: 'dashboard-task-reminder-clear', text: t('reminder.clearReminder') });
	}

	const renderCalendar = () => {
		calGrid.empty();
		const y = viewYear.value;
		const m = viewMonth.value;
		monthLabel.setText(`${y}-${String(m + 1).padStart(2, '0')}`);

		for (const d of dayNames) {
			calGrid.createDiv({ cls: 'dashboard-task-reminder-calendar-header', text: d });
		}

		const firstDay = new Date(y, m, 1).getDay();
		const daysInMonth = new Date(y, m + 1, 0).getDate();
		const daysInPrev = new Date(y, m, 0).getDate();

		const today = new Date();
		const isCurrentMonth = today.getFullYear() === y && today.getMonth() === m;

		for (let i = firstDay - 1; i >= 0; i--) {
			const d = daysInPrev - i;
			calGrid.createEl('button', { cls: 'dashboard-task-reminder-calendar-day dashboard-task-reminder-calendar-day--other-month', text: String(d) });
		}

		for (let d = 1; d <= daysInMonth; d++) {
			const cls = ['dashboard-task-reminder-calendar-day'];
			if (isCurrentMonth && d === today.getDate()) cls.push('dashboard-task-reminder-calendar-day--today');
			if (y === selectedYear && m === selectedMonth && d === selectedDay) cls.push('dashboard-task-reminder-calendar-day--selected');

			const dayBtn = calGrid.createEl('button', { cls: cls.join(' '), text: String(d) });
			dayBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				selectedYear = y;
				selectedMonth = m;
				selectedDay = d;
				renderCalendar();
			});
		}

		const totalCells = firstDay + daysInMonth;
		const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
		for (let d = 1; d <= remaining; d++) {
			calGrid.createEl('button', { cls: 'dashboard-task-reminder-calendar-day dashboard-task-reminder-calendar-day--other-month', text: String(d) });
		}
	};

	prevBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		viewMonth.value--;
		if (viewMonth.value < 0) { viewMonth.value = 11; viewYear.value--; }
		renderCalendar();
	});

	nextBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		viewMonth.value++;
		if (viewMonth.value > 11) { viewMonth.value = 0; viewYear.value++; }
		renderCalendar();
	});

	saveBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		const h = parseInt(hourSelect.value, 10);
		const m = parseInt(minSelect.value, 10);
		const reminder = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
		callbacks.onTaskReminderEdit(cardId, taskPath, reminder);
		closeAllReminderPopups();
	});

	btnRow.querySelector('.dashboard-task-reminder-clear')?.addEventListener('click', (e) => {
		e.stopPropagation();
		callbacks.onTaskReminderEdit(cardId, taskPath, undefined);
		closeAllReminderPopups();
	});

	const outsideClick = (ev: MouseEvent) => {
		if (!popup.contains(ev.target as Node)) {
			closeAllReminderPopups();
			activeDocument.removeEventListener('mousedown', outsideClick);
		}
	};
	window.setTimeout(() => activeDocument.addEventListener('mousedown', outsideClick), 0);

	renderCalendar();
}

function closeAllReminderPopups(): void {
	activeDocument.querySelectorAll('.dashboard-task-reminder-popup').forEach(el => {
		const popup = el as HTMLElement & { __reminderCleanup?: () => void };
		popup.__reminderCleanup?.();
		popup.remove();
	});
}

// ===== Weather Card Body =====

export function renderWeatherBody(container: HTMLElement, card: DashboardCard, app: App): void {
	if (!card.weatherConfig) return;

	const el = container.createDiv({ cls: 'dashboard-weather' });

	const cached = getCachedWeather(card.weatherConfig);
	if (cached) {
		renderWeatherContent(el, cached, card.weatherConfig.cityName);
	} else {
		el.createDiv({ cls: 'dashboard-weather-loading', text: '...' });
		fetchWeather(card.weatherConfig).then(data => {
			el.empty();
			renderWeatherContent(el, data, card.weatherConfig!.cityName);
		}).catch(() => {
			el.empty();
			el.createDiv({ cls: 'dashboard-weather-error', text: t('weather.fetchError') });
		});
	}
}

function renderWeatherContent(el: HTMLElement, data: WeatherData, cityName: string): void {
	const current = el.createDiv({ cls: 'dashboard-weather-current' });
	const tempWrap = current.createDiv({ cls: 'dashboard-weather-temp-wrap' });
	tempWrap.createDiv({ cls: 'dashboard-weather-temp', text: `${Math.round(data.temperature)}°` });
	tempWrap.createDiv({ cls: 'dashboard-weather-icon', text: getWeatherEmoji(data.weatherCode) });

	const details = current.createDiv({ cls: 'dashboard-weather-details' });
	details.createDiv({ cls: 'dashboard-weather-city', text: cityName });
	details.createDiv({ cls: 'dashboard-weather-desc', text: getWeatherDescription(data.weatherCode) });
	const metaLine = details.createDiv({ cls: 'dashboard-weather-wind' });
	metaLine.createSpan({ text: `${t('weather.feelsLike')} ${Math.round(data.feelsLike)}°  ${t('weather.humidity')} ${Math.round(data.humidity)}%  ${t('weather.wind')} ${Math.round(data.windSpeed)} km/h` });

	if (data.dailyDates.length > 0) {
		const forecast = el.createDiv({ cls: 'dashboard-weather-forecast' });
		const count = Math.min(data.dailyDates.length, 5);
		for (let i = 0; i < count; i++) {
			const day = forecast.createDiv({ cls: 'dashboard-weather-day' });
			const d = new Date(data.dailyDates[i]! + 'T00:00:00');
			const dayName = d.toLocaleDateString(getLanguage() === 'zh' ? 'zh-CN' : 'en', { weekday: 'short' });
			day.createDiv({ cls: 'dashboard-weather-day-name', text: dayName });
			day.createDiv({ cls: 'dashboard-weather-day-icon', text: getWeatherEmoji(data.dailyCodes[i]!) });
			day.createDiv({ cls: 'dashboard-weather-day-temps', text: `${Math.round(data.dailyMax[i]!)}° / ${Math.round(data.dailyMin[i]!)}°` });
		}
	}
}

// ===== Tracker Card Body =====

export function renderTrackerBody(container: HTMLElement, card: DashboardCard, app: App, settings?: DashboardSettings): void {
	if (!card.trackerConfig) return;

	const config = card.trackerConfig;
	const size: CardSize = card.size || 'M';
	const style: TrackerStyle = config.style || 'line';
	destroyChart(card.id);

	const el = container.createDiv({ cls: `dashboard-tracker dashboard-tracker--${size}` });

	const data = readTrackerData(app, '', config.key, config.days);
	const validPoints = data.filter(p => p.value !== null);

	if (validPoints.length === 0) {
		el.createDiv({ cls: 'dashboard-tracker-empty', text: t('tracker.noData') + ': ' + config.key });
		return;
	}

	const values = data.map(p => p.value);
	const minVal = Math.min(...values.filter((v): v is number => v !== null));
	const maxVal = Math.max(...values.filter((v): v is number => v !== null));
	const sum = validPoints.reduce((s, p) => s + p.value!, 0);
	const avg = (sum / validPoints.length).toFixed(1);
	const latest = validPoints[validPoints.length - 1]!.value as number;
	const prev = validPoints.length > 1 ? validPoints[validPoints.length - 2]!.value as number : latest;
	const trendDir = latest > prev ? 'up' : latest < prev ? 'down' : 'flat';
	const trendPct = prev !== 0 ? ((latest - prev) / Math.abs(prev) * 100).toFixed(1) : '0';

	// Streak: consecutive days with data (from latest backward, today optional)
	const streak = computeStreak(data);

	if (size === 'S') {
		const row = el.createDiv({ cls: 'dashboard-tracker-compact' });
		row.createDiv({ cls: 'dashboard-tracker-compact-value', text: String(latest) });
		const arrow = row.createDiv({ cls: `dashboard-tracker-trend dashboard-tracker-trend--${trendDir}` });
		arrow.setText(trendDir === 'up' ? '↑' : trendDir === 'down' ? '↓' : '→');
		if (config.key) {
			row.createDiv({ cls: 'dashboard-tracker-compact-label', text: config.key });
		}
		return;
	}

	const accentColor = getCSSVar('--db-accent') || '#6366f1';

	// Dispatch by style
	if (style === 'heatmap') {
		renderTrackerHeatmap(el, data, minVal, maxVal, size, accentColor);
	} else if (style === 'bar') {
		renderTrackerBarChart(el, data, size, accentColor, card.id);
	} else {
		renderTrackerLineChart(el, data, size, accentColor, card.id);
	}

	// Stats
	const stats = el.createDiv({ cls: 'dashboard-tracker-stats' });
	const addStat = (label: string, value: string | number) => {
		const stat = stats.createDiv({ cls: 'dashboard-tracker-stat' });
		stat.createSpan({ cls: 'dashboard-tracker-stat-label', text: label });
		stat.createSpan({ cls: 'dashboard-tracker-stat-value', text: String(value) });
	};
	addStat(t('tracker.current'), latest);
	addStat(t('tracker.avg'), avg);

	if (size === 'M') {
		addStat(t('tracker.trend'), `${trendDir === 'up' ? '+' : ''}${trendPct}%`);
	}

	if (size === 'L') {
		addStat(t('tracker.trend'), `${trendDir === 'up' ? '+' : ''}${trendPct}%`);
		addStat(t('tracker.streak'), `${streak}d`);
		addStat(t('tracker.min'), minVal);
		addStat(t('tracker.max'), maxVal);
	}
}

function renderTrackerLineChart(el: HTMLElement, data: import('../core/types').TrackerDataPoint[], size: CardSize, accentColor: string, cardId: string): void {
	const chartWrap = el.createDiv({ cls: 'dashboard-tracker-chart' });
	const canvasEl = chartWrap.createEl('canvas', { cls: 'dashboard-chart-canvas' });
	const ctx = canvasEl.getContext('2d');
	if (!ctx) return;

	const chart = new Chart(ctx, {
		type: 'line',
		data: {
			labels: data.map(p => p.date.slice(5)),
			datasets: [{
				data: data.map(p => p.value),
				borderColor: accentColor,
				backgroundColor: `${accentColor}22`,
				fill: true,
				tension: 0.4,
				pointRadius: size === 'L' ? 3 : 0,
				pointHoverRadius: 5,
				pointBackgroundColor: accentColor,
				borderWidth: 2,
			}],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: { legend: { display: false }, tooltip: { enabled: true } },
			scales: {
				x: { display: false },
				y: { display: false },
			},
			animation: { duration: 600 },
		},
	});
	chartInstances.set(cardId, chart);
}

function renderTrackerBarChart(el: HTMLElement, data: import('../core/types').TrackerDataPoint[], size: CardSize, accentColor: string, cardId: string): void {
	const chartWrap = el.createDiv({ cls: 'dashboard-tracker-chart' });
	const canvasEl = chartWrap.createEl('canvas', { cls: 'dashboard-chart-canvas' });
	const ctx = canvasEl.getContext('2d');
	if (!ctx) return;

	const textColor = getCSSVar('--db-text-muted') || '#888';
	const validVals = data.filter(p => p.value !== null).map(p => p.value!);
	const barMax = validVals.length > 0 ? Math.max(...validVals) : 1;

	const chart = new Chart(ctx, {
		type: 'bar',
		data: {
			labels: data.map(p => p.date.slice(5)),
			datasets: [{
				data: data.map(p => p.value ?? 0),
				backgroundColor: data.map(p => {
					if (p.value === null) return 'transparent';
					const intensity = barMax > 0 ? p.value / barMax : 0;
					return `${accentColor}${Math.round(40 + intensity * 180).toString(16).padStart(2, '0')}`;
				}),
				borderRadius: 2,
				barPercentage: 0.8,
			}],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: { legend: { display: false }, tooltip: { enabled: true } },
			scales: {
				x: { display: false },
				y: { display: size === 'L', grid: { display: false }, ticks: { color: textColor, font: { size: 10 } } },
			},
			animation: { duration: 600 },
		},
	});
	chartInstances.set(cardId, chart);
}

function renderTrackerHeatmap(el: HTMLElement, data: import('../core/types').TrackerDataPoint[], minVal: number, maxVal: number, size: CardSize, accentColor: string): void {
	const heatmap = el.createDiv({ cls: 'dashboard-tracker-heatmap' });

	const range = maxVal - minVal || 1;
	const cellSize = size === 'M' ? 10 : 14;
	const gap = 2;

	// Organize data into weeks (columns), days are rows (Mon-Sun)
	// Each column = 1 week, from oldest to newest
	const firstDate = data[0] ? new Date(data[0].date + 'T00:00:00') : new Date();
	const startDayOfWeek = firstDate.getDay(); // 0=Sun, 1=Mon...
	const mondayOffset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; // days from Monday

	// Build week columns
	const weeks: (import('../core/types').TrackerDataPoint | null)[][] = [];
	let currentWeek: (import('../core/types').TrackerDataPoint | null)[] = [];

	// Pad first week with nulls to align to Monday
	for (let i = 0; i < mondayOffset; i++) {
		currentWeek.push(null);
	}

	for (const point of data) {
		currentWeek.push(point);
		if (currentWeek.length === 7) {
			weeks.push(currentWeek);
			currentWeek = [];
		}
	}
	if (currentWeek.length > 0) {
		weeks.push(currentWeek);
	}

	// Limit visible weeks based on size
	const maxWeeks = size === 'M' ? 15 : size === 'L' ? 26 : 52;
	const visibleWeeks = weeks.slice(-maxWeeks);

	const grid = heatmap.createDiv({ cls: 'dashboard-tracker-heatmap-grid' });
	grid.setCssProps({
		display: 'grid',
		gridTemplateColumns: `repeat(${visibleWeeks.length}, ${cellSize}px)`,
		gridTemplateRows: `repeat(7, ${cellSize}px)`,
		gap: `${gap}px`,
	});

	// Day labels (Mon, Tue, ... Sun) for L size
	if (size === 'L') {
		const labels = heatmap.createDiv({ cls: 'dashboard-tracker-heatmap-labels' });
		const dayNames = ['M', '', 'W', '', 'F', '', 'S'];
		for (const name of dayNames) {
			labels.createDiv({ cls: 'dashboard-tracker-heatmap-day-label', text: name });
		}
	}

	for (const week of visibleWeeks) {
		for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
			const point = week[dayIdx] ?? null;
			const cell = grid.createDiv({ cls: 'dashboard-tracker-heatmap-cell' });
			cell.style.width = `${cellSize}px`;
			cell.style.height = `${cellSize}px`;
			cell.style.borderRadius = `${Math.max(2, cellSize / 4)}px`;

			if (point === null || point.value === null) {
				cell.addClass('dashboard-tracker-heatmap-cell--empty');
			} else {
				const intensity = (point.value - minVal) / range;
				const alpha = 0.15 + intensity * 0.85;
				cell.style.backgroundColor = accentColor;
				cell.style.opacity = String(alpha);
				cell.title = `${point.date}: ${point.value}`;
			}
		}
	}
}
