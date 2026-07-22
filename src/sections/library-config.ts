import { App, TFile } from 'obsidian';
import type { LibraryConfig, PropertyFilter } from '../core/types';
import { t, getLanguage } from '../utils/i18n';

// ===== Types & Constants =====

export interface LibraryFileResult {
	file: TFile;
	basename: string;
	mtime: number;
	ctime: number;
	frontmatter: Record<string, unknown>;
	preview: string;
	tags: string[];
}

export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50];

// ===== Data Query =====

export function extractFrontmatterProperties(app: App): Map<string, Set<string>> {
	const props = new Map<string, Set<string>>();
	props.set('tags', new Set());
	props.set('modified', new Set());
	props.set('created', new Set());
	props.set('path', new Set());

	for (const file of app.vault.getMarkdownFiles()) {
		if (file.path.startsWith('.')) continue;
		const cache = app.metadataCache.getFileCache(file);
		if (!cache?.frontmatter) continue;

		const fm = cache.frontmatter;
		for (const [key, value] of Object.entries(fm)) {
			if (key === 'position') continue;
			if (!props.has(key)) props.set(key, new Set());
			const set = props.get(key)!;
			if (Array.isArray(value)) {
				for (const item of value) {
					if (item != null) set.add(String(item));
				}
			} else if (value != null) {
				set.add(String(value));
			}
		}

		// Tags from frontmatter and inline
		const tagsSet = props.get('tags')!;
		if (fm.tags) {
			if (Array.isArray(fm.tags)) {
				for (const tag of fm.tags) tagsSet.add(String(tag));
			} else {
				tagsSet.add(String(fm.tags));
			}
		}
		if (cache.tags) {
			for (const tag of cache.tags) tagsSet.add(tag.tag);
		}
	}

	return props;
}

export function getAllTags(app: App): string[] {
	return [...(extractFrontmatterProperties(app).get('tags') ?? [])].sort();
}

/** Render clickable tag chips; toggling a tag calls onToggle(tag). Caller owns selection state. */
export function renderTagsSelector(
	container: HTMLElement,
	allTags: string[],
	selectedTags: string[],
	onToggle: (tag: string) => void,
): void {
	container.empty();
	if (allTags.length === 0) {
		container.createDiv({ cls: 'dashboard-library-filter-empty', text: t('library.noTags') });
		return;
	}
	for (const tag of allTags) {
		const chip = container.createDiv({
			cls: 'dashboard-library-filter-chip' + (selectedTags.includes(tag) ? ' active' : ''),
			text: tag,
		});
		chip.addEventListener('click', () => onToggle(tag));
	}
}

export function queryVaultFiles(app: App, config: LibraryConfig): LibraryFileResult[] {
	const files = app.vault.getMarkdownFiles();
	const results: LibraryFileResult[] = [];

	// Folder section: restrict to files under any configured folder (recursive, OR).
	const scanFolders = (config.folders ?? [])
		.map(f => f.trim().replace(/^\/+|\/+$/g, ''))
		.filter(f => f.length > 0);

	for (const file of files) {
		if (file.path.startsWith('.')) continue;

		if (scanFolders.length > 0) {
			const lp = file.path.toLowerCase();
			if (!scanFolders.some(f => lp.startsWith(f.toLowerCase() + '/'))) continue;
		}

		const cache = app.metadataCache.getFileCache(file);
		const fm = (cache?.frontmatter ?? {}) as Record<string, unknown>;

		// Apply filters (AND logic)
		let matches = true;
		for (const filter of config.filters) {
			if (!evaluateFilter(file, fm, filter, cache)) {
				matches = false;
				break;
			}
		}
		if (!matches) continue;

		const tags: string[] = [];
		if (cache?.tags) {
			for (const tag of cache.tags) tags.push(tag.tag);
		}

		results.push({
			file,
			basename: file.basename,
			mtime: file.stat.mtime,
			ctime: file.stat.ctime,
			frontmatter: fm,
			preview: '',
			tags,
		});
	}

	// Sort
	sortResults(results, config.sortBy, config.sortDesc);

	return results;
}

// ===== Internal Helpers =====

function evaluateFilter(
	file: TFile,
	fm: Record<string, unknown>,
	filter: PropertyFilter,
	cache: ReturnType<typeof import('obsidian').App.prototype.metadataCache.getFileCache>,
): boolean {
		if (filter.values.length === 0 && !filter.dateRange) return true;

	const prop = filter.property;

	if (prop === 'tags') {
		const fileTags: string[] = [];
		if (fm.tags) {
			if (Array.isArray(fm.tags)) {
				fileTags.push(...fm.tags.map(String));
			} else {
				fileTags.push(str(fm.tags));
			}
		}
		if (cache?.tags) {
			for (const tag of cache.tags) fileTags.push(tag.tag);
		}
		return fileTags.some(tag => filter.values.includes(tag));
	}

	if (prop === 'modified' || prop === 'created') {
		const ts = prop === 'modified' ? file.stat.mtime : file.stat.ctime;
		const dateStr = new Date(ts).toISOString().slice(0, 10);
		if (filter.dateRange) {
			if (filter.dateRange.start && dateStr < filter.dateRange.start) return false;
			if (filter.dateRange.end && dateStr > filter.dateRange.end) return false;
			return true;
		}
		return filter.values.includes(dateStr);
	}

	if (prop === 'path') {
		return filter.values.some(v => file.path.toLowerCase().includes(v.toLowerCase()));
	}

	// Frontmatter property
	const value = fm[prop];
	if (value == null) return false;

	if (Array.isArray(value)) {
		return value.some(item => filter.values.includes(String(item)));
	}

	return filter.values.includes(str(value));
}

export function str(v: unknown): string {
	if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
	return '';
}

export async function loadPreview(app: App, file: TFile): Promise<string> {
	const cache = app.metadataCache.getFileCache(file);
	const position = cache?.frontmatter?.position as { end: { line: number } } | undefined;
	if (!position) return '';
	const startLine = position.end.line + 1;
	const raw = await app.vault.cachedRead(file);
	const lines = raw.split('\n');
	const previewLines: string[] = [];
	for (let i = startLine; i < lines.length && previewLines.length < 3; i++) {
		const line = lines[i]!.replace(/^#+\s*/, '').trim();
		if (line && !line.startsWith('---') && !line.startsWith('```')) previewLines.push(line);
	}
	return previewLines.join(' ').slice(0, 120);
}

function sortResults(results: LibraryFileResult[], sortBy: string, desc: boolean): void {
	results.sort((a, b) => {
		let cmp = 0;
		if (sortBy === 'name') {
			cmp = a.basename.localeCompare(b.basename);
		} else if (sortBy === 'modified') {
			cmp = a.mtime - b.mtime;
		} else if (sortBy === 'created') {
			cmp = a.ctime - b.ctime;
		} else {
			const aVal = a.frontmatter[sortBy];
			const bVal = b.frontmatter[sortBy];
			cmp = comparePropertyValues(aVal, bVal);
		}
		return desc ? -cmp : cmp;
	});
}

function comparePropertyValues(a: unknown, b: unknown): number {
	if (a == null && b == null) return 0;
	if (a == null) return 1;
	if (b == null) return -1;
	const sa = str(a);
	const sb = str(b);
	const na = Number(sa);
	const nb = Number(sb);
	if (!isNaN(na) && !isNaN(nb)) return na - nb;
	return sa.localeCompare(sb);
}

export function formatDate(ts: number): string {
	const d = new Date(ts);
	const now = new Date();
	const diffMs = now.getTime() - d.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays === 0) {
		const diffH = Math.floor(diffMs / (1000 * 60 * 60));
		if (diffH === 0) {
			const diffM = Math.floor(diffMs / (1000 * 60));
			return diffM <= 1 ? t('recent.justNow') : t('recent.minutesAgo', { count: diffM });
		}
		return t('recent.hoursAgo', { count: diffH });
	}
	if (diffDays < 30) return t('recent.daysAgo', { count: diffDays });
	const lang = getLanguage() === 'zh' ? 'zh-CN' : 'en';
	return d.toLocaleDateString(lang, { month: 'short', day: 'numeric' });
}

/** Coerce a frontmatter value into a compact badge string, or null to hide it. */
export function formatBadgeValue(value: unknown): string | null {
	if (value == null) return null;
	if (value instanceof Date) {
		return value.toISOString().slice(0, 10);
	}
	if (Array.isArray(value)) {
		const items = value.map(v => (v == null ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v))).filter(v => v.length > 0);
		return items.length > 0 ? items.join(', ') : null;
	}
	if (typeof value === 'object') {
		try {
			const s = JSON.stringify(value).replace(/"/g, '').trim();
			return s.length > 0 && s.length <= 60 ? s : null;
		} catch {
			return null;
		}
	}
	const s = str(value).trim();
	return s.length > 0 ? s : null;
}
