import { App, Platform, TFile, setIcon } from 'obsidian';
import type { HoverParent } from 'obsidian';
import type { LibraryConfig } from '../core/types';
import { t } from '../utils/i18n';
import { attachNoteHover } from '../modals/hover-preview';
import type { LibraryFileResult } from './library-config';
import { loadPreview, formatDate, formatBadgeValue, str } from './library-config';

// ===== Module-level hover context =====
// Set by the main library entry point so view renderers can route opens
// through the note popover and attach hover previews.

let libHoverParent: HoverParent | null = null;
let libOpener: ((file: TFile) => void) | null = null;

export function setLibraryHoverContext(hoverParent: HoverParent | null, opener: ((file: TFile) => void) | null): void {
	libHoverParent = hoverParent;
	libOpener = opener;
}

// ===== File Operations =====

function openFile(app: App, file: TFile): void {
	if (!Platform.isMobile && libOpener) {
		libOpener(file);
	} else {
		void app.workspace.getLeaf(false).openFile(file);
	}
}

/** Attach the native hover preview to a library item (desktop only). */
function attachItemHover(app: App, el: HTMLElement, file: TFile): void {
	if (!Platform.isMobile && libHoverParent) {
		attachNoteHover(app, el, file, libHoverParent);
	}
}

// ===== Pagination =====

export function renderPagination(
	container: HTMLElement,
	currentPage: number,
	totalPages: number,
	totalResults: number,
	onPageChange: (page: number) => void,
): void {
	const nav = container.createDiv({ cls: 'dashboard-library-pagination-nav' });

	// Previous button
	const prevBtn = nav.createDiv({
		cls: 'dashboard-library-pagination-btn' + (currentPage <= 1 ? ' disabled' : ''),
		text: '<',
	});
	if (currentPage > 1) {
		prevBtn.addEventListener('click', () => onPageChange(currentPage - 1));
	}

	// Page buttons
	const maxVisible = 5;
	let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
	const endPage = Math.min(totalPages, startPage + maxVisible - 1);
	startPage = Math.max(1, endPage - maxVisible + 1);

	if (startPage > 1) {
		const firstBtn = nav.createDiv({ cls: 'dashboard-library-pagination-page', text: '1' });
		firstBtn.addEventListener('click', () => onPageChange(1));
		if (startPage > 2) {
			nav.createDiv({ cls: 'dashboard-library-pagination-ellipsis', text: '...' });
		}
	}

	for (let i = startPage; i <= endPage; i++) {
		const pageBtn = nav.createDiv({
			cls: 'dashboard-library-pagination-page' + (i === currentPage ? ' active' : ''),
			text: String(i),
		});
		if (i !== currentPage) {
			pageBtn.addEventListener('click', () => onPageChange(i));
		}
	}

	if (endPage < totalPages) {
		if (endPage < totalPages - 1) {
			nav.createDiv({ cls: 'dashboard-library-pagination-ellipsis', text: '...' });
		}
		const lastBtn = nav.createDiv({ cls: 'dashboard-library-pagination-page', text: String(totalPages) });
		lastBtn.addEventListener('click', () => onPageChange(totalPages));
	}

	// Next button
	const nextBtn = nav.createDiv({
		cls: 'dashboard-library-pagination-btn' + (currentPage >= totalPages ? ' disabled' : ''),
		text: '>',
	});
	if (currentPage < totalPages) {
		nextBtn.addEventListener('click', () => onPageChange(currentPage + 1));
	}
}

// ===== Grid View =====

export function renderGridView(container: HTMLElement, results: LibraryFileResult[], app: App, showTags: boolean, config: LibraryConfig): void {
	const grid = container.createDiv({ cls: 'dashboard-library-grid' });
	const showProperties = config.showProperties !== false;
	const propertyLimit = Math.max(0, config.propertyLimit ?? 6);

	for (const result of results) {
		const card = grid.createDiv({ cls: 'dashboard-library-card' });
		attachItemHover(app, card, result.file);
		card.addEventListener('click', () => openFile(app, result.file));

		card.createDiv({ cls: 'dashboard-library-card-title', text: result.basename });

		// Tags (folder section) or path + creation time on the meta row
		const metaRow = card.createDiv({ cls: 'dashboard-library-card-meta' });
		if (showTags) {
			if (result.tags.length > 0) {
				const tagsRow = metaRow.createDiv({ cls: 'dashboard-library-card-tags' });
				const maxTags = 2;
				for (const tag of result.tags.slice(0, maxTags)) {
					tagsRow.createDiv({ cls: 'dashboard-library-card-tag', text: tag });
				}
				if (result.tags.length > maxTags) {
					tagsRow.createDiv({
						cls: 'dashboard-library-card-tag dashboard-library-card-tag--more',
						text: `+${result.tags.length - maxTags}`,
					});
				}
			}
		} else {
			const parts = result.file.path.split('/');
			if (parts.length > 1) {
				metaRow.createDiv({ cls: 'dashboard-library-card-path', text: parts.slice(0, -1).join('/') + '/' });
			}
		}
		metaRow.createDiv({ cls: 'dashboard-library-card-date', text: formatDate(result.ctime) });

		// Async body preview
		const previewEl = card.createDiv({ cls: 'dashboard-library-card-preview dashboard-library-card-preview--loading' });
		loadPreview(app, result.file).then(text => {
			if (!previewEl.isConnected) return;
			previewEl.removeClass('dashboard-library-card-preview--loading');
			if (text) {
				previewEl.textContent = text;
			} else {
				previewEl.remove();
			}
		}).catch(() => {
			if (previewEl.isConnected) previewEl.remove();
		});

		// Frontmatter property badges (excludes position; tags are rendered above
		// for folder sections). Capped to keep cards a uniform, bounded size.
		if (showProperties && propertyLimit > 0) {
			const badges = card.createDiv({ cls: 'dashboard-library-badges' });
			let count = 0;
			for (const [key, rawValue] of Object.entries(result.frontmatter)) {
				if (count >= propertyLimit) break;
				if (key === 'position' || key === 'tags') continue;
				const val = formatBadgeValue(rawValue);
				if (val === null) continue;
				const badge = badges.createDiv({ cls: 'dashboard-library-badge' });
				badge.createDiv({ cls: 'dashboard-library-badge-key', text: key });
				badge.createDiv({ cls: 'dashboard-library-badge-val', text: val });
				count++;
			}
			if (count === 0) badges.remove();
		}
	}
}

// ===== List View =====

export function renderListView(container: HTMLElement, results: LibraryFileResult[], app: App): void {
	const list = container.createDiv({ cls: 'dashboard-library-list' });

	for (const result of results) {
		const item = list.createDiv({ cls: 'dashboard-library-list-item' });
		attachItemHover(app, item, result.file);
		item.addEventListener('click', () => openFile(app, result.file));

		item.createDiv({ cls: 'dashboard-library-list-name', text: result.basename });
		item.createDiv({ cls: 'dashboard-library-list-spacer' });
		item.createDiv({ cls: 'dashboard-library-list-date', text: formatDate(result.ctime) });
	}
}

// ===== Table View =====

function startCellEdit(
	td: HTMLElement,
	file: TFile,
	prop: string,
	originalValue: unknown,
	app: App,
): void {
	if (td.querySelector('input, select')) return;

	const isArr = Array.isArray(originalValue);
	const displayValue = originalValue == null ? '' : isArr
		? (originalValue as unknown[]).map(String).join(', ')
		: str(originalValue);

	td.empty();
	td.removeClass('dashboard-library-table-empty');

	const input = td.createEl('input', {
		cls: 'dashboard-library-table-edit-input',
		attr: { type: 'text', value: displayValue },
	});
	input.focus();
	input.select();

	const finish = (save: boolean) => {
		if (!input.isConnected) return;
		const raw = input.value.trim();
		input.remove();

		if (!save) {
			td.textContent = displayValue || '—';
			if (!displayValue) td.addClass('dashboard-library-table-empty');
			return;
		}

		// Parse value
		let newValue: unknown;
		if (raw === '') {
			newValue = null;
		} else if (isArr) {
			newValue = raw.split(',').map(s => s.trim()).filter(Boolean);
		} else {
			const num = Number(raw);
			newValue = !isNaN(num) && raw !== '' ? num : raw;
		}

		// Write via processFrontMatter
		void app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			if (newValue === null) {
				delete fm[prop];
			} else {
				fm[prop] = newValue;
			}
		});

		// Update display
		if (newValue === null) {
			td.textContent = '—';
			td.addClass('dashboard-library-table-empty');
		} else if (Array.isArray(newValue)) {
			td.textContent = newValue.join(', ');
		} else {
			td.textContent = str(newValue);
		}
	};

	input.addEventListener('keydown', (e: KeyboardEvent) => {
		if (e.key === 'Enter') { e.preventDefault(); finish(true); }
		else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
	});
	input.addEventListener('blur', () => finish(true));
}

export function renderTableView(container: HTMLElement, results: LibraryFileResult[], app: App, config: LibraryConfig, onDelete: (file: TFile) => void): void {
	// Determine which property columns to show
	const propKeys = new Set<string>();
	for (const filter of config.filters) {
		if (filter.property !== 'tags' && filter.property !== 'modified' && filter.property !== 'created' && filter.property !== 'path') {
			propKeys.add(filter.property);
		}
	}
	// Also collect common properties from results
	for (const result of results.slice(0, 20)) {
		for (const key of Object.keys(result.frontmatter)) {
			if (key === 'position') continue;
			propKeys.add(key);
			if (propKeys.size >= 6) break;
		}
	}

	const columns = ['name', 'modified', ...propKeys];

	const table = container.createEl('table', { cls: 'dashboard-library-table' });
	const thead = table.createEl('thead');
	const headerRow = thead.createEl('tr');
	for (const col of columns) {
		const th = headerRow.createEl('th', {
			text: col === 'name' ? t('library.sortName') : col === 'modified' ? t('library.sortModified') : col,
		});
		th.dataset.sortKey = col;
	}
	// Action column (delete button) — empty label, rightmost
	const actionTh = headerRow.createEl('th', { cls: 'dashboard-library-table-op-col' });
	actionTh.setAttribute('aria-label', t('library.delete'));

	const tbody = table.createEl('tbody');
	for (const result of results) {
		const tr = tbody.createEl('tr');

		for (const col of columns) {
			const td = tr.createEl('td');
			if (col === 'name') {
				td.textContent = result.basename;
				td.addClass('dashboard-library-table-name');
				attachItemHover(app, td, result.file);
				td.addEventListener('click', (e) => {
					e.stopPropagation();
					openFile(app, result.file);
				});
			} else if (col === 'modified') {
				td.textContent = formatDate(result.mtime);
			} else {
				const value = result.frontmatter[col];
				if (value == null) {
					td.addClass('dashboard-library-table-empty');
					td.textContent = '—';
				} else if (Array.isArray(value)) {
					td.textContent = value.map(String).join(', ');
				} else {
					td.textContent = str(value);
				}
				td.addClass('dashboard-library-table-editable');
				td.addEventListener('dblclick', (e) => {
					e.stopPropagation();
					startCellEdit(td, result.file, col, value, app);
				});
			}
		}

		// Delete action cell (rightmost)
		const opTd = tr.createEl('td', { cls: 'dashboard-library-table-op' });
		const delBtn = opTd.createEl('button', {
			cls: 'dashboard-library-table-delete',
			attr: { 'aria-label': t('library.delete') },
		});
		delBtn.title = t('library.delete');
		setIcon(delBtn, 'trash-2');
		delBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			onDelete(result.file);
		});
	}
}

// ===== Kanban View =====

export function renderKanbanView(container: HTMLElement, results: LibraryFileResult[], app: App, config: LibraryConfig): void {
	const groupBy = config.kanbanGroupBy ?? 'tags';
	const kanban = container.createDiv({ cls: 'dashboard-library-kanban' });

	// Group results
	const groups = new Map<string, LibraryFileResult[]>();
	const noGroup: LibraryFileResult[] = [];

	for (const result of results) {
		const value = result.frontmatter[groupBy];
		if (value == null) {
			noGroup.push(result);
			continue;
		}
		if (Array.isArray(value)) {
			for (const v of value) {
				const key = String(v);
				if (!groups.has(key)) groups.set(key, []);
				groups.get(key)!.push(result);
			}
		} else {
			const key = str(value);
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)!.push(result);
		}
	}

	// Render columns
	for (const [groupName, groupResults] of groups) {
		const col = kanban.createDiv({ cls: 'dashboard-library-kanban-col' });
		col.createDiv({ cls: 'dashboard-library-kanban-col-title', text: `${groupName} (${groupResults.length})` });
		for (const result of groupResults) {
			const card = col.createDiv({ cls: 'dashboard-library-kanban-card' });
			attachItemHover(app, card, result.file);
			card.addEventListener('click', () => openFile(app, result.file));
			card.createDiv({ cls: 'dashboard-library-kanban-card-title', text: result.basename });
			card.createDiv({ cls: 'dashboard-library-kanban-card-date', text: formatDate(result.mtime) });
		}
	}

	if (noGroup.length > 0) {
		const col = kanban.createDiv({ cls: 'dashboard-library-kanban-col' });
		col.createDiv({ cls: 'dashboard-library-kanban-col-title', text: `${t('library.notSet')} (${noGroup.length})` });
		for (const result of noGroup) {
			const card = col.createDiv({ cls: 'dashboard-library-kanban-card' });
			attachItemHover(app, card, result.file);
			card.addEventListener('click', () => openFile(app, result.file));
			card.createDiv({ cls: 'dashboard-library-kanban-card-title', text: result.basename });
		}
	}
}
