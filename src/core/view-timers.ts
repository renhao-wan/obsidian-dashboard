import { Events, Notice, TFile } from 'obsidian';
import type { App } from 'obsidian';
import type DashboardPlugin from './main';
import type { DashboardData } from './types';
import type { SyncEngine } from '../data/sync';
import { clearWeatherCache } from '../services/weather';
import { refreshSidebarWeekCalendar } from '../renderers/dashboard';
import { ReminderNoticeModal } from '../components/reminder-notice';
import { t } from '../utils/i18n';

// ---------------------------------------------------------------------------
// Timer state
// ---------------------------------------------------------------------------

export interface TimerState {
	recentDocsTimer: number | null;
	libraryRefreshTimer: number | null;
	reminderTimer: number | null;
	weatherRefreshTimer: number | null;
	dayRolloverTimer: number | null;
	lastRenderedDay: string;
	vaultEventRefs: Array<{ evt: Events; ref: unknown }>;
	firedReminders: Set<string>;
}

const REMINDER_CHECK_MS = 60 * 1000;
const WEATHER_REFRESH_MS = 30 * 60 * 1000;
const DAY_ROLLOVER_CHECK_MS = 60 * 1000;
const RECENT_DOCS_DEBOUNCE = 500;

// ---------------------------------------------------------------------------
// Reminder checker
// ---------------------------------------------------------------------------

export function startReminderChecker(state: TimerState, onCheck: () => void): void {
	onCheck();
	state.reminderTimer = window.setInterval(onCheck, REMINDER_CHECK_MS);
}

export function stopReminderChecker(state: TimerState): void {
	if (state.reminderTimer) {
		window.clearInterval(state.reminderTimer);
		state.reminderTimer = null;
	}
}

export function checkReminders(
	data: DashboardData | null,
	state: TimerState,
	plugin: DashboardPlugin,
	sync: SyncEngine,
	app: App,
): void {
	if (!data) return;
	const now = new Date();

	for (const col of data.columns) {
		for (const card of col.cards) {
			for (let i = 0; i < card.tasks.length; i++) {
				const task = card.tasks[i]!;
				if (!task.reminder || task.checked) continue;

				const key = `${card.id}-${JSON.stringify([i])}`;
				if (state.firedReminders.has(key)) continue;

				const parts = task.reminder.trim().split(/\s+/);
				if (parts.length < 2) continue;
				const [dateStr, timeStr] = parts;
				const [year, month, day] = dateStr!.split('-').map(Number);
				const [hour, min] = timeStr!.split(':').map(Number);
				if (!year || !month || !day) continue;
				const due = new Date(year, month - 1, day, hour ?? 0, min ?? 0);

				if (now >= due) {
					state.firedReminders.add(key);
					const cleanText = task.text.replace(/\[\[[^\]]+\]\]/g, (match) => {
						const inner = match.slice(2, -2);
						return inner.split('|').pop()?.split('/').pop()?.replace(/\.md$/, '') ?? inner;
					});
					showReminderModal(app, sync, state, cleanText, card.id, [i]);
				}
			}
		}

		if (plugin.settings.countdownEnabled) {
			for (const cd of plugin.settings.countdowns ?? []) {
				if (!cd.targetDate || cd.reminderDays <= 0) continue;
				const ckKey = `countdown-remind-${cd.id}`;
				if (state.firedReminders.has(ckKey)) continue;
				const raw = cd.targetDate;
				const target = raw.includes('T') ? new Date(raw) : new Date(raw + 'T00:00:00');
				const diffMs = target.getTime() - now.getTime();
				const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
				if (daysLeft >= 0 && daysLeft <= cd.reminderDays) {
					state.firedReminders.add(ckKey);
					const label = cd.label || cd.targetDate;
					new Notice(t('countdown.reminderNotice', { label, days: String(daysLeft) }));
				}
			}
		}
	}
}

function showReminderModal(
	app: App,
	sync: SyncEngine,
	state: TimerState,
	taskText: string,
	cardId: string,
	taskPath: number[],
): void {
	const modal = new ReminderNoticeModal(
		app,
		taskText,
		() => {
			void sync.editTaskReminder(cardId, taskPath, undefined);
		},
		() => {
			const snoozed = new Date(Date.now() + 60 * 60 * 1000);
			const pad = (n: number) => String(n).padStart(2, '0');
			const newReminder = `${snoozed.getFullYear()}-${pad(snoozed.getMonth() + 1)}-${pad(snoozed.getDate())} ${pad(snoozed.getHours())}:${pad(snoozed.getMinutes())}`;
			state.firedReminders.delete(`${cardId}-${JSON.stringify(taskPath)}`);
			void sync.editTaskReminder(cardId, taskPath, newReminder);
		},
	);
	modal.open();
}

// ---------------------------------------------------------------------------
// Weather refresh
// ---------------------------------------------------------------------------

export function startWeatherRefresh(state: TimerState, getData: () => DashboardData | null, onRefresh: () => void): void {
	state.weatherRefreshTimer = window.setInterval(() => {
		const data = getData();
		if (!data) return;
		const hasWeather = data.columns.some(col =>
			col.cards.some(c => c.type === 'weather')
		);
		if (hasWeather) {
			onRefresh();
		}
	}, WEATHER_REFRESH_MS);
}

export function stopWeatherRefresh(state: TimerState): void {
	if (state.weatherRefreshTimer) {
		window.clearInterval(state.weatherRefreshTimer);
		state.weatherRefreshTimer = null;
	}
	clearWeatherCache();
}

// ---------------------------------------------------------------------------
// Day rollover
// ---------------------------------------------------------------------------

export function startDayRolloverChecker(state: TimerState, onCheck: () => void): void {
	state.dayRolloverTimer = window.setInterval(onCheck, DAY_ROLLOVER_CHECK_MS);
}

export function stopDayRolloverChecker(state: TimerState): void {
	if (state.dayRolloverTimer) {
		window.clearInterval(state.dayRolloverTimer);
		state.dayRolloverTimer = null;
	}
}

export function checkDayRollover(
	state: TimerState,
	data: DashboardData | null,
	containerEl: HTMLElement,
	onRender: () => void,
): void {
	if (!data) return;
	const todayKey = new Date().toDateString();
	if (todayKey === state.lastRenderedDay) return;

	state.lastRenderedDay = todayKey;
	const root = containerEl.children[1] as HTMLElement | undefined;
	if (root && refreshSidebarWeekCalendar(root)) {
		return;
	}
	onRender();
}

// ---------------------------------------------------------------------------
// Vault event listeners
// ---------------------------------------------------------------------------

export function registerVaultListeners(
	app: App,
	state: TimerState,
	onRefreshRecent: () => void,
	onRefreshSections: (structure: boolean) => void,
): void {
	const events = app.vault;
	const handler = (structure: boolean): void => {
		onRefreshRecent();
		onRefreshSections(structure);
	};

	const createRef = events.on('create', () => handler(true));
	const modifyRef = events.on('modify', (file) => {
		if (file instanceof TFile && file.extension === 'md') {
			handler(false);
		}
	});
	const deleteRef = events.on('delete', () => handler(true));
	const renameRef = events.on('rename', () => handler(true));

	state.vaultEventRefs = [
		{ evt: events, ref: createRef },
		{ evt: events, ref: modifyRef },
		{ evt: events, ref: deleteRef },
		{ evt: events, ref: renameRef },
	];
}

export function unregisterVaultListeners(state: TimerState): void {
	for (const { evt, ref } of state.vaultEventRefs) {
		evt.offref(ref as Parameters<typeof evt.offref>[0]);
	}
	state.vaultEventRefs = [];
	if (state.recentDocsTimer) {
		window.clearTimeout(state.recentDocsTimer);
		state.recentDocsTimer = null;
	}
}

export function debouncedRefreshRecentDocs(state: TimerState, callback: () => void): void {
	if (state.recentDocsTimer) window.clearTimeout(state.recentDocsTimer);
	state.recentDocsTimer = window.setTimeout(callback, RECENT_DOCS_DEBOUNCE);
}

export function debouncedRefreshSections(state: TimerState, callback: () => void): void {
	if (state.libraryRefreshTimer) window.clearTimeout(state.libraryRefreshTimer);
	state.libraryRefreshTimer = window.setTimeout(callback, 500);
}
