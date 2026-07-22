import { App, Platform } from 'obsidian';
import type { HoverParent, TFile } from 'obsidian';
import { t } from '../utils/i18n';
import { Chart, LineController, LineElement, PointElement, BarController, BarElement, LinearScale, CategoryScale, Filler, Tooltip } from 'chart.js';

Chart.register(LineController, LineElement, PointElement, BarController, BarElement, LinearScale, CategoryScale, Filler, Tooltip);

// ===== Shared State =====

export const chartInstances = new Map<string, Chart>();
export const countdownTimers = new Set<number>();

export let taskDragSource: { cardId: string; taskPath: number[] } | null = null;
export let docDragSource: { cardId: string; docPath: number[] } | null = null;

// Set once per render pass by renderDashboard so the deep doc/wikilink renderers
// can attach hover previews and open the note popover without threading these
// through every function signature. Mirrors the docDragSource module-level idiom.
export let activeHoverParent: HoverParent | null = null;
export let activeNoteOpener: ((file: TFile) => void) | null = null;

export const VAULT_FILE_EXTS = new Set(['md', 'pdf', 'canvas', 'base', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'mp3', 'mp4', 'm4a', 'm4b', 'mov', 'mkv', 'avi']);

// ===== Setter Functions =====

export function setTaskDragSource(value: { cardId: string; taskPath: number[] } | null): void {
	taskDragSource = value;
}

export function setDocDragSource(value: { cardId: string; docPath: number[] } | null): void {
	docDragSource = value;
}

export function setActiveHoverParent(value: HoverParent | null): void {
	activeHoverParent = value;
}

export function setActiveNoteOpener(value: ((file: TFile) => void) | null): void {
	activeNoteOpener = value;
}

// ===== Chart & Timer Management =====

export function destroyChart(cardId: string): void {
	const chart = chartInstances.get(cardId);
	if (chart) {
		chart.destroy();
		chartInstances.delete(cardId);
	}
}

export function destroyAllCharts(): void {
	for (const [, chart] of chartInstances) {
		chart.destroy();
	}
	chartInstances.clear();
	for (const t of countdownTimers) {
		window.clearInterval(t);
	}
	countdownTimers.clear();
}

// ===== CSS & Color Utilities =====

export function getCSSVar(name: string): string {
	const el = activeDocument.querySelector('.obsidian-dashboard-root');
	if (!el) return '';
	return getComputedStyle(el).getPropertyValue(name).trim();
}

// Determine whether the dashboard accent is light enough that white text on it
// would be unreadable (e.g. the mono/墨白 and carbon themes in dark mode).
export function isAccentLight(): boolean {
	const el = activeDocument.querySelector('.obsidian-dashboard-root');
	if (!el) return false;
	return isLightColor(getComputedStyle(el).getPropertyValue('--db-accent').trim());
}

// Accepts "#rgb", "#rrggbb", "rgb(...)" or "rgba(...)"; returns true when the
// color is bright enough that dark text reads better than white.
export function isLightColor(color: string): boolean {
	const value = color.trim();
	if (value.startsWith('rgb')) {
		const nums = value.match(/[\d.]+/g);
		if (!nums || nums.length < 3) return false;
		return relativeLuminance(Number(nums[0]), Number(nums[1]), Number(nums[2])) > 0.6;
	}
	const hex = value.replace(/^#/, '');
	if (!/^[0-9a-fA-F]+$/.test(hex)) return false;
	const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
	if (full.length !== 6) return false;
	return relativeLuminance(
		parseInt(full.slice(0, 2), 16),
		parseInt(full.slice(2, 4), 16),
		parseInt(full.slice(4, 6), 16),
	) > 0.6;
}

// WCAG relative luminance (0..1).
export function relativeLuminance(r: number, g: number, b: number): number {
	const toLinear = (c: number) => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
	};
	return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

// ===== File Resolution =====

export function getSearchableFiles(app: App) {
	return app.vault.getFiles()
		.filter(f => !f.path.startsWith('.') && VAULT_FILE_EXTS.has(f.extension));
}

/**
 * Resolve a raw doc/wikilink target to a TFile, trying the path verbatim, with
 * an implicit `.md`, and finally a basename fallback. Centralised so the doc
 * list and inline wikilinks resolve links identically.
 */
export function resolveNoteFile(app: App, rawPath: string): TFile | null {
	const direct = app.vault.getFileByPath(rawPath);
	if (direct) return direct;
	const withMd = rawPath.includes('.') ? rawPath : `${rawPath}.md`;
	const tried = app.vault.getFileByPath(withMd);
	if (tried) return tried;
	const basename = rawPath.split('/').pop()?.replace(/\.md$/, '') ?? '';
	if (basename) {
		return getSearchableFiles(app).find(mf => mf.basename === basename) ?? null;
	}
	return null;
}

// ===== Format Helpers =====

export function formatMinutes(minutes: number): string {
	if (minutes < 60) {
		return t('pomodoro.minutes', { count: minutes });
	}
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	if (mins === 0) return t('pomodoro.hours', { count: hours });
	return t('pomodoro.hours', { count: hours }) + ' ' + t('pomodoro.minutes', { count: mins });
}

export function formatTime(seconds: number): string {
	if (seconds >= 3600) {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = seconds % 60;
		return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	}
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatReadingDuration(totalSeconds: number): string {
	const hours = Math.floor(totalSeconds / 3600);
	const mins = Math.floor((totalSeconds % 3600) / 60);
	if (hours > 0 && mins > 0) return t('reading.timeHM', { h: hours, m: mins });
	if (hours > 0) return t('reading.hours', { count: hours });
	return t('reading.minutes', { count: Math.max(1, mins) });
}

export function formatShortDuration(totalSeconds: number): string {
	const h = Math.floor(totalSeconds / 3600);
	const m = Math.floor((totalSeconds % 3600) / 60);
	if (h > 0) return `${h}h${m > 0 ? m + 'm' : ''}`;
	return `${Math.max(1, m)}m`;
}
