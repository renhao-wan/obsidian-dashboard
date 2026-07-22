import { App, Notice, TFile, setIcon } from 'obsidian';
import type { HoverParent } from 'obsidian';
import type { LibraryConfig, PropertyFilter, LibraryViewMode } from '../core/types';
import { t, getLanguage } from '../i18n';
import { FolderSuggestModal } from '../modals/folder-config';
import { showConfirmDialog } from '../components/confirm-dialog';
import { LibraryFileResult, DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, queryVaultFiles } from './library-config';
import { setLibraryHoverContext, renderGridView, renderListView, renderTableView, renderKanbanView, renderPagination } from './library-views';

// ===== Calendar Popup =====

let activeCalendarPopup: HTMLElement | null = null;

function closeCalendarPopup(): void {
	if (activeCalendarPopup) {
		activeCalendarPopup.remove();
		activeCalendarPopup = null;
	}
}

function showCalendarPopup(anchor: HTMLElement, initialValue: string, onSelect: (date: string) => void): void {
	closeCalendarPopup();

		const popup = activeDocument.body.createDiv({ cls: 'dashboard-task-reminder-popup dashboard-library-calendar-popup' });

	const dashboardRoot = anchor.closest('.obsidian-dashboard-root') as HTMLElement;
	if (dashboardRoot) {
		const rs = getComputedStyle(dashboardRoot);
		const themeVars = ['--db-bg', '--db-bg-card', '--db-bg-card-hover', '--db-border-card',
			'--db-text', '--db-text-muted', '--db-accent', '--db-radius-md', '--db-radius-sm', '--db-font'];
		themeVars.forEach(v => {
			const val = rs.getPropertyValue(v).trim();
			if (val) popup.style.setProperty(v, val);
		});
	}

	popup.setCssProps({
		background: 'var(--db-bg-card, rgba(255, 255, 255, 0.06))',
		backdropFilter: 'blur(16px)',
		color: 'var(--db-text, var(--text-normal))',
		borderColor: 'var(--db-border-card, rgba(255,255,255,0.1))',
	});

	const rect = anchor.getBoundingClientRect();
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

	let selectedYear: number;
	let selectedMonth: number;
	let selectedDay: number;

	const now = new Date();
	if (initialValue) {
		const dp = initialValue.split('-').map(Number);
		selectedYear = dp[0] ?? now.getFullYear();
		selectedMonth = (dp[1] ?? now.getMonth() + 1) - 1;
		selectedDay = dp[2] ?? now.getDate();
	} else {
		selectedYear = now.getFullYear();
		selectedMonth = now.getMonth();
		selectedDay = now.getDate();
	}

	const viewYear = { value: selectedYear };
	const viewMonth = { value: selectedMonth };
	const lang = getLanguage();
	const dayNames = lang === 'zh' ? ['日', '一', '二', '三', '四', '五', '六'] : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

	const calNav = popup.createDiv({ cls: 'dashboard-task-reminder-calendar-nav' });
	const prevBtn = calNav.createEl('button', { text: '<' });
	const monthLabel = calNav.createSpan();
	const nextBtn = calNav.createEl('button', { text: '>' });

	const calGrid = popup.createDiv({ cls: 'dashboard-task-reminder-calendar' });

	const btnRow = popup.createDiv({ cls: 'dashboard-task-reminder-popup-btns' });
	btnRow.createEl('button', { cls: 'mod-cta', text: t('common.save') });
	btnRow.createEl('button', { text: t('common.cancel') });

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

	btnRow.querySelector('.mod-cta')!.addEventListener('click', (e) => {
		e.stopPropagation();
		const date = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
		onSelect(date);
		closeCalendarPopup();
	});

	btnRow.querySelectorAll('button')[1]!.addEventListener('click', (e) => {
		e.stopPropagation();
		closeCalendarPopup();
	});

	const outsideClick = (ev: MouseEvent) => {
		if (!popup.contains(ev.target as Node) && !anchor.contains(ev.target as Node)) {
			closeCalendarPopup();
			activeDocument.removeEventListener('mousedown', outsideClick);
		}
	};
	window.setTimeout(() => activeDocument.addEventListener('mousedown', outsideClick), 0);

	activeCalendarPopup = popup;
	renderCalendar();
}

// ===== Main Entry Point =====

export function renderLibrarySection(
	el: HTMLElement,
	column: { name: string; color: string; sectionType?: string; libraryConfig?: LibraryConfig },
	app: App,
	onConfigChange: (config: LibraryConfig) => void,
	hoverParent: HoverParent | null = null,
	onOpenNote: ((file: TFile) => void) | null = null,
): void {
	setLibraryHoverContext(hoverParent, onOpenNote);
	const config = column.libraryConfig ?? {
		filters: [] as PropertyFilter[],
		viewMode: 'grid' as LibraryViewMode,
		sortBy: 'modified',
		sortDesc: true,
	};
	const isFolder = column.sectionType === 'folder';

	const sectionContent = el.createDiv({ cls: 'dashboard-library-content' });

	// Toolbar
	const toolbar = sectionContent.createDiv({ cls: 'dashboard-library-toolbar' });

	// Search
	const searchInput = toolbar.createEl('input', {
		cls: 'dashboard-library-search',
		attr: { type: 'text', placeholder: t('library.searchPlaceholder') },
	});

	// Sort
	const sortSelect = toolbar.createEl('select', { cls: 'dashboard-library-sort' });
	const sortOptions = [
		{ value: 'modified', label: t('library.sortModified') },
		{ value: 'created', label: t('library.sortCreated') },
		{ value: 'name', label: t('library.sortName') },
	];
	for (const opt of sortOptions) {
		const option = sortSelect.createEl('option', { text: opt.label, attr: { value: opt.value } });
		if (opt.value === config.sortBy) option.selected = true;
	}

	// Sort direction toggle
	const sortDirBtn = toolbar.createDiv({ cls: 'dashboard-library-sort-dir' });
	setIcon(sortDirBtn, config.sortDesc ? 'arrow-down-wide-narrow' : 'arrow-up-wide-narrow');

	// View mode toggle
	const viewToggle = toolbar.createDiv({ cls: 'dashboard-library-view-toggle' });
	const viewModes: LibraryViewMode[] = ['grid', 'list', 'table', 'kanban'];
	const viewIcons: Record<string, string> = { grid: 'layout-grid', list: 'list', table: 'table', kanban: 'columns' };
	for (const mode of viewModes) {
		const btn = viewToggle.createDiv({
			cls: 'dashboard-library-view-btn' + (mode === config.viewMode ? ' active' : ''),
		});
		setIcon(btn, viewIcons[mode] ?? 'file');
		btn.title = t('library.view' + mode.charAt(0).toUpperCase() + mode.slice(1));
		btn.dataset.viewMode = mode;
		btn.addEventListener('click', () => {
			viewToggle.querySelectorAll('.dashboard-library-view-btn').forEach(b => b.removeClass('active'));
			btn.addClass('active');
			const newConfig = { ...config, viewMode: mode };
			onConfigChange(newConfig);
			Object.assign(config, { viewMode: mode });
			currentPage = 1;
			renderContent(config);
		});
	}

		// Quick date filter button
		const filterBtn = toolbar.createDiv({ cls: 'dashboard-library-filter-btn' });
		setIcon(filterBtn, 'filter');
		filterBtn.title = t('library.quickFilter');

		// Filter tag
		const filterTag = toolbar.createDiv({ cls: 'dashboard-library-filter-tags' });

		// Quick date filter state (separate from config.filters)
		let quickProp: 'created' | 'modified' = config.quickDateFilter?.property ?? 'created';
		let quickStart = config.quickDateFilter?.start ?? '';
		let quickEnd = config.quickDateFilter?.end ?? '';

		// Popup
		let filterPopup: HTMLElement | null = null;
	let funnelFolders: string[] = [...(config.folderFilter ?? [])];


		function applyQuickFilter(): void {
			config.quickDateFilter = (quickStart || quickEnd) ? { property: quickProp, start: quickStart, end: quickEnd } : undefined;
			onConfigChange({ ...config });
			currentPage = 1;
			renderContent(config);
			renderFilterTag();
			updateFilterBtnState();
		}

		function applyFunnelFolders(): void {
			config.folderFilter = funnelFolders.length > 0 ? [...funnelFolders] : undefined;
			onConfigChange({ ...config });
			currentPage = 1;
			renderContent(config);
			renderFilterTag();
			updateFilterBtnState();
		}

		function openPopup(): void {
			closePopup();
			filterPopup = activeDocument.body.createDiv({ cls: 'dashboard-library-filter-popup' });

			// Inherit theme from dashboard
			const dashboardRoot = filterBtn.closest('.obsidian-dashboard-root') as HTMLElement;
			if (dashboardRoot) {
				const rs = getComputedStyle(dashboardRoot);
				['--db-bg', '--db-bg-card', '--db-bg-card-hover', '--db-border-card',
					'--db-text', '--db-text-muted', '--db-accent', '--db-radius-md', '--db-radius-sm', '--db-font',
					'--db-bg-input', '--db-bg-hover', '--db-bg-btn', '--db-text-normal', '--db-border-input'].forEach(v => {
					const val = rs.getPropertyValue(v).trim();
					if (val) filterPopup!.style.setProperty(v, val);
				});
			}

			// Position below the filter button
			const rect = filterBtn.getBoundingClientRect();
			filterPopup.setCssProps({
				position: 'fixed',
				top: `${rect.bottom + 4}px`,
				left: `${rect.left}px`,
				zIndex: '10000',
			});

			// Property selector
			const propRow = filterPopup.createDiv({ cls: 'dashboard-library-quickfilter-row' });
			propRow.createDiv({ cls: 'dashboard-library-quickfilter-label', text: t('library.filterProperty') });
			const propSelect = propRow.createEl('select', { cls: 'dashboard-library-filter-popup-prop' });
			propSelect.createEl('option', { text: t('library.created'), attr: { value: 'created' } });
			propSelect.createEl('option', { text: t('library.modified'), attr: { value: 'modified' } });
			propSelect.value = quickProp;
			propSelect.addEventListener('change', () => {
				quickProp = propSelect.value as 'created' | 'modified';
			});

			// Date range
			const dateRow = filterPopup.createDiv({ cls: 'dashboard-library-quickfilter-row' });
			dateRow.createDiv({ cls: 'dashboard-library-quickfilter-label', text: t('library.filterDateRange') });
			const dateWrap = dateRow.createDiv({ cls: 'dashboard-library-filter-popup-dates' });
			const startBtn = dateWrap.createEl('button', {
				cls: 'dashboard-library-filter-date-btn' + (quickStart ? ' has-value' : ''),
				text: quickStart || t('library.dateStart'),
			});
			const endBtn = dateWrap.createEl('button', {
				cls: 'dashboard-library-filter-date-btn' + (quickEnd ? ' has-value' : ''),
				text: quickEnd || t('library.dateEnd'),
			});

			startBtn.addEventListener('click', (ev) => {
				ev.stopPropagation();
				showCalendarPopup(startBtn, quickStart, (date) => {
					quickStart = date;
					applyQuickFilter();
					if (activeDocument.body.contains(filterBtn)) openPopup();
				});
			});
			endBtn.addEventListener('click', (ev) => {
				ev.stopPropagation();
				showCalendarPopup(endBtn, quickEnd, (date) => {
					quickEnd = date;
					applyQuickFilter();
					if (activeDocument.body.contains(filterBtn)) openPopup();
				});
			});

			// Folder filter
			const folderRow = filterPopup.createDiv({ cls: 'dashboard-library-quickfilter-row' });
			folderRow.createDiv({ cls: 'dashboard-library-quickfilter-label', text: t('media.filterFolder') });
			const folderChipsHost = folderRow.createDiv({ cls: 'dashboard-alltasks-exclude-chips' });
			const folderAddRow = folderRow.createDiv({ cls: 'dashboard-media-folder-input-row' });
			const folderInput = folderAddRow.createEl('input', {
				cls: 'dashboard-media-filter-folder',
				attr: { type: 'text', placeholder: t('media.filterFolderPlaceholder') },
			});
			const folderBrowseBtn = folderAddRow.createEl('button', { cls: 'dashboard-media-folder-browse', text: t('media.browseFolder') });
			folderBrowseBtn.addEventListener('click', () => {
				new FolderSuggestModal(app, (folder) => { folderInput.value = folder.path; addFunnelFolder(); }).open();
			});
			const renderFolderChips = (): void => {
				folderChipsHost.empty();
				if (funnelFolders.length === 0) {
					folderChipsHost.createDiv({ cls: 'dashboard-library-filter-empty', text: t('folder.noFolders') });
					return;
				}
				for (const folder of funnelFolders) {
					const chip = folderChipsHost.createDiv({ cls: 'dashboard-alltasks-exclude-chip' });
					chip.createSpan({ text: folder });
					const x = chip.createSpan({ cls: 'dashboard-alltasks-exclude-chip-x', text: '×' });
					x.addEventListener('click', () => {
						funnelFolders = funnelFolders.filter(f => f !== folder);
						applyFunnelFolders();
						renderFolderChips();
					});
				}
			};
			const addFunnelFolder = (): void => {
				const folder = folderInput.value.trim().replace(/^\/+|\/+$/g, '');
				folderInput.value = '';
				if (!folder) return;
				if (funnelFolders.some(f => f.toLowerCase() === folder.toLowerCase())) return;
				funnelFolders = [...funnelFolders, folder];
				applyFunnelFolders();
				renderFolderChips();
			};
			folderInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addFunnelFolder(); } });
			renderFolderChips();

			// Clear button
			if (quickStart || quickEnd || funnelFolders.length > 0) {
				const clearBtn = filterPopup.createEl('button', {
					cls: 'dashboard-library-filter-popup-clear',
					text: t('reminder.clearReminder'),
				});
				clearBtn.addEventListener('click', (ev) => {
					ev.stopPropagation();
					quickStart = '';
					quickEnd = '';
					funnelFolders = [];
					applyQuickFilter();
					applyFunnelFolders();
					closePopup();
				});
			}
		}

		function closePopup(): void {
			if (filterPopup) {
				filterPopup.remove();
				filterPopup = null;
			}
		}

		function renderFilterTag(): void {
			filterTag.empty();
			if (quickStart && quickEnd) {
				const start = quickStart || '...';
				const end = quickEnd || '...';
				const tag = filterTag.createDiv({
					cls: 'dashboard-library-filter-tag',
					text: `${quickProp}: ${start} ~ ${end}`,
				});
				const x = tag.createSpan({ cls: 'dashboard-library-filter-tag-x', text: '×' });
				x.addEventListener('click', () => {
					quickStart = '';
					quickEnd = '';
					applyQuickFilter();
					openPopup();
				});
			}
			for (const folder of funnelFolders) {
				const tag = filterTag.createDiv({ cls: 'dashboard-library-filter-tag' });
				const label = tag.createSpan({ cls: 'dashboard-library-filter-tag-label', text: folder.split('/').filter(Boolean).pop() ?? folder });
				label.title = folder;
				const x = tag.createSpan({ cls: 'dashboard-library-filter-tag-x', text: '×' });
				x.addEventListener('click', () => {
					funnelFolders = funnelFolders.filter(f => f !== folder);
					applyFunnelFolders();
				});
			}
		}

		function updateFilterBtnState(): void {
			filterBtn.classList.toggle('active', !!(quickStart || quickEnd || (config.folderFilter?.length ?? 0) > 0));
		}

		filterBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			if (filterPopup) {
				closePopup();
			} else {
				openPopup();
			}
		});

		activeDocument.addEventListener('click', (e) => {
			if (!filterPopup) return;
			const target = e.target as Node;
			if (filterPopup.contains(target) || filterBtn.contains(target)) return;
			if (target.instanceOf(Element) && target.closest('.modal-container')) return;
			closePopup();
		});

		renderFilterTag();
		updateFilterBtnState();


	// Spacer
	toolbar.createDiv({ cls: 'dashboard-library-toolbar-spacer' });

	// File count
	const countEl = toolbar.createDiv({ cls: 'dashboard-library-count' });

	// Page size selector
	const pageSize = config.pageSize ?? DEFAULT_PAGE_SIZE;
	const pageSizeSelect = toolbar.createEl('select', { cls: 'dashboard-library-page-size' });
	for (const size of PAGE_SIZE_OPTIONS) {
		const opt = pageSizeSelect.createEl('option', { text: t('library.pageSize', { count: size }), attr: { value: String(size) } });
		if (size === pageSize) opt.selected = true;
	}
	pageSizeSelect.addEventListener('change', () => {
		const newSize = parseInt(pageSizeSelect.value) || DEFAULT_PAGE_SIZE;
		Object.assign(config, { pageSize: newSize });
		onConfigChange({ ...config });
		currentPage = 1;
		renderContent(config);
	});

	// Configure button
	const configBtn = toolbar.createDiv({ cls: 'dashboard-library-config-btn' });
	setIcon(configBtn, 'settings');
	configBtn.title = t('library.configure');

	// Content area
	const contentArea = sectionContent.createDiv({ cls: 'dashboard-library-files' });

	// Pagination area
	const paginationArea = sectionContent.createDiv({ cls: 'dashboard-library-pagination' });

	let currentPage = 1;

	async function deleteLibraryFileWithConfirm(file: TFile): Promise<void> {
		const confirmed = await showConfirmDialog(app, {
			title: t('common.confirmDelete'),
			message: t('library.confirmDelete', { name: file.basename }),
		});
		if (!confirmed) return;
		try {
			await app.fileManager.trashFile(file);
			new Notice(t('library.deleted'));
			renderContent(config);
		} catch (err) {
			console.error('[Dashboard] library delete failed:', err);
			new Notice(t('library.deleteFailed'));
		}
	}

	function renderContent(currentConfig: LibraryConfig): void {
		contentArea.empty();
		paginationArea.empty();

		let results = queryVaultFiles(app, currentConfig);

		// Apply search
		const search = searchInput.value.trim().toLowerCase();
		if (search) {
			results = results.filter(r => r.basename.toLowerCase().includes(search));
		}

			// Apply quick date filter
			if (currentConfig.quickDateFilter) {
				const qdf = currentConfig.quickDateFilter;
				results = results.filter(r => {
					const ts = qdf.property === 'modified' ? r.mtime : r.ctime;
					const dateStr = new Date(ts).toISOString().slice(0, 10);
					if (qdf.start && dateStr < qdf.start) return false;
					if (qdf.end && dateStr > qdf.end) return false;
					return true;
				});
			}

			// Apply folder funnel filter (OR across selected folders)
			if (currentConfig.folderFilter && currentConfig.folderFilter.length > 0) {
				const ff = currentConfig.folderFilter
					.map(f => f.trim().replace(/^\/+|\/+$/g, ''))
					.filter(f => f.length > 0);
				if (ff.length > 0) {
					results = results.filter(r => {
						const lp = r.file.path.toLowerCase();
						return ff.some(f => lp.startsWith(f.toLowerCase() + '/'));
					});
				}
			}

		const totalResults = results.length;
		countEl.textContent = t('library.fileCount', { count: totalResults });

		if (totalResults === 0 && currentConfig.filters.length === 0 && !(currentConfig.folders && currentConfig.folders.length)) {
			contentArea.createDiv({ cls: 'dashboard-library-empty', text: t('library.noConfig') });
			return;
		}

		if (totalResults === 0) {
			contentArea.createDiv({ cls: 'dashboard-library-empty', text: t('library.noFiles') });
			return;
		}

		// Paginate (kanban skips pagination — it scrolls horizontally instead)
		const isKanban = currentConfig.viewMode === 'kanban';
		const effectivePageSize = isKanban ? totalResults : (currentConfig.pageSize ?? DEFAULT_PAGE_SIZE);
		const totalPages = isKanban ? 1 : Math.ceil(totalResults / effectivePageSize);
		if (currentPage > totalPages) currentPage = totalPages;
		if (currentPage < 1) currentPage = 1;

		const startIdx = isKanban ? 0 : (currentPage - 1) * effectivePageSize;
		const endIdx = isKanban ? totalResults : Math.min(startIdx + effectivePageSize, totalResults);
		const pageResults = results.slice(startIdx, endIdx);

		switch (currentConfig.viewMode) {
			case 'grid':
				renderGridView(contentArea, pageResults, app, isFolder, currentConfig);
				break;
			case 'list':
				renderListView(contentArea, pageResults, app);
				break;
			case 'table':
				renderTableView(contentArea, pageResults, app, currentConfig, (f) => { void deleteLibraryFileWithConfirm(f); });
				break;
			case 'kanban':
				renderKanbanView(contentArea, pageResults, app, currentConfig);
				break;
		}

		// Render pagination controls (kanban scrolls horizontally, no pagination)
		if (!isKanban && totalPages > 1) {
			renderPagination(paginationArea, currentPage, totalPages, totalResults, (page) => {
				currentPage = page;
				renderContent(currentConfig);
				// Scroll to top of section content
				sectionContent.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
			});
		}
	}

	// Search handler
	let searchTimer: number | null = null;
	searchInput.addEventListener('input', () => {
		if (searchTimer) window.clearTimeout(searchTimer);
		searchTimer = window.setTimeout(() => {
			currentPage = 1;
			renderContent(config);
		}, 200);
	});

	// Sort handlers
	sortSelect.addEventListener('change', () => {
		config.sortBy = sortSelect.value;
		onConfigChange(config);
		currentPage = 1;
		renderContent(config);
	});

	sortDirBtn.addEventListener('click', () => {
		config.sortDesc = !config.sortDesc;
		setIcon(sortDirBtn, config.sortDesc ? 'arrow-down-wide-narrow' : 'arrow-up-wide-narrow');
		onConfigChange(config);
		currentPage = 1;
		renderContent(config);
	});

	// Config button handler - will be wired in view.ts via custom event
	configBtn.addEventListener('click', () => {
		const event = new CustomEvent('dashboard-library-config', { detail: { columnName: column.name }, bubbles: true });
		el.dispatchEvent(event);
	});

	// Initial render
	renderContent(config);
}
