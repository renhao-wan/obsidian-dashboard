import { App, Platform, setIcon } from 'obsidian';
import type { DashboardSettings, WeatherData } from '../core/types';
import { t, getLanguage } from '../utils/i18n';
import { renderSidebarLunarWidget } from '../modals/lunar';
import type { HolidayInfo } from '../services/holiday';
import { CountdownSettingsModal } from '../modals/countdown';
import { fetchWeather, getCachedWeather, getWeatherEmoji, getWeatherDescription } from '../services/weather';
import type { PomodoroService } from '../services/pomodoro';
import type { ReadingService } from '../services/reading';
import { activityColor } from '../services/pomodoro';
import { searchBooks, downloadCoverAsBlobUrl } from '../services/book';
import {
	isAccentLight,
	countdownTimers,
	formatMinutes,
	formatTime,
	formatReadingDuration,
	formatShortDuration,
} from './utils';

// ===== Sidebar Widget Rendering =====

export function renderSidebarWeekCalendar(container: HTMLElement): void {
	// Reuse the existing calendar node so cross-day refreshes don't grow the DOM.
	let row = container.querySelector<HTMLElement>('.dashboard-sidebar-week-calendar');
	if (row) {
		row.empty();
	} else {
		row = container.createDiv({ cls: 'dashboard-sidebar-week-calendar' });
	}

	const now = new Date();
	const today = now.getDay();
	const mondayOffset = today === 0 ? -6 : 1 - today;
	const monday = new Date(now);
	monday.setDate(now.getDate() + mondayOffset);

	const lang = getLanguage() === 'zh' ? 'zh-CN' : 'en';
	const accentLight = isAccentLight();

	for (let i = 0; i < 7; i++) {
		const d = new Date(monday);
		d.setDate(monday.getDate() + i);
		const isToday = d.toDateString() === now.toDateString();

		const cell = row.createDiv({
			cls: 'dashboard-sidebar-week-cell'
				+ (isToday ? ' dashboard-sidebar-week-cell--today' : '')
				+ (isToday && accentLight ? ' dashboard-sidebar-week-cell--today-on-light' : ''),
		});
		cell.createDiv({
			cls: 'dashboard-sidebar-week-day',
			text: d.toLocaleDateString(lang, { weekday: 'narrow' }),
		});
		cell.createDiv({
			cls: 'dashboard-sidebar-week-date',
			text: String(d.getDate()),
		});
	}
}

// Returns true if the live sidebar week calendar was re-rendered, false if it isn't in the DOM.
export function refreshSidebarWeekCalendar(root: HTMLElement): boolean {
	const scroll = root.querySelector<HTMLElement>('.dashboard-sidebar-scroll');
	if (!scroll) return false;
	renderSidebarWeekCalendar(scroll);
	return true;
}

type WidgetEntry = { key: string; render: () => void };

export function renderSidebarWidgets(
	container: HTMLElement,
	settings: DashboardSettings,
	app: App,
	pomodoroService?: PomodoroService,
	readingService?: ReadingService,
	holidayData?: Record<string, HolidayInfo>,
	onWidgetReorder?: (order: string[]) => void,
): void {
	const anyEnabled = settings.widgetWeatherEnabled || settings.pomodoroEnabled || settings.widgetLunarEnabled || (settings.countdownEnabled && (settings.countdowns?.length ?? 0) > 0) || settings.readingEnabled;
	if (!anyEnabled) return;

	const widgetArea = container.createDiv({ cls: 'dashboard-sidebar-widgets' });

	const DEFAULT_ORDER = ['lunar', 'weather', 'pomodoro', 'reading', 'countdown'];
	const order = settings.widgetOrder?.length ? settings.widgetOrder : DEFAULT_ORDER;

	const enabled: WidgetEntry[] = [];
	if (settings.widgetLunarEnabled) {
		enabled.push({ key: 'lunar', render: () => renderSidebarLunarWidget(widgetArea, holidayData ?? {}, app) });
	}
	if (settings.widgetWeatherEnabled) {
		enabled.push({ key: 'weather', render: () => renderSidebarWeather(widgetArea, settings, app) });
	}
	if (settings.pomodoroEnabled && pomodoroService) {
		enabled.push({ key: 'pomodoro', render: () => renderSidebarPomodoro(widgetArea, pomodoroService, settings) });
	}
	if (settings.readingEnabled && readingService) {
		enabled.push({ key: 'reading', render: () => renderSidebarReading(widgetArea, readingService) });
	}
	if (settings.countdownEnabled) {
		for (const cd of settings.countdowns ?? []) {
			const cdRef = cd;
			enabled.push({ key: `countdown-${cd.id}`, render: () => renderSidebarCountdown(widgetArea, cdRef, app) });
		}
	}

	const ordered = sortByOrder(enabled, order);

	for (const { key, render } of ordered) {
		const childCount = widgetArea.children.length;
		render();
		const el = widgetArea.children[childCount] as HTMLElement | undefined;
		if (el) el.dataset.widgetKey = key;
	}

	if (onWidgetReorder) {
		setupWidgetDnD(widgetArea, ordered.map(e => e.key), onWidgetReorder);
	}
}

function sortByOrder(items: WidgetEntry[], order: string[]): WidgetEntry[] {
	const orderMap = new Map(order.map((k, i) => [k, i]));
	const sorted = [...items].sort((a, b) => {
		const ai = orderMap.get(a.key) ?? order.length;
		const bi = orderMap.get(b.key) ?? order.length;
		return ai - bi;
	});
	return sorted;
}

function setupWidgetDnD(
	widgetArea: HTMLElement,
	currentKeys: string[],
	onReorder: (order: string[]) => void,
): void {
	let draggedKey: string | null = null;

	const widgets = () => widgetArea.querySelectorAll('.dashboard-sidebar-widget');

	widgets().forEach(el => {
		const wEl = el as HTMLElement;
		wEl.setAttribute('draggable', 'true');
		wEl.dataset.widgetKey ??= wEl.dataset.widgetKey ?? '';

		wEl.addEventListener('dragstart', (e) => {
			draggedKey = wEl.dataset.widgetKey ?? null;
			wEl.addClass('dashboard-sidebar-widget--dragging');
			if (e.dataTransfer) {
				e.dataTransfer.effectAllowed = 'move';
				e.dataTransfer.setData('text/plain', draggedKey ?? '');
			}
		});

		wEl.addEventListener('dragend', () => {
			wEl.removeClass('dashboard-sidebar-widget--dragging');
			widgets().forEach(el2 => el2.removeClass('dashboard-sidebar-widget--drag-over'));
			draggedKey = null;
		});

		wEl.addEventListener('dragover', (e) => {
			e.preventDefault();
			if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
			if (!draggedKey || wEl.dataset.widgetKey === draggedKey) return;
			widgets().forEach(el2 => el2.removeClass('dashboard-sidebar-widget--drag-over'));
			const rect = wEl.getBoundingClientRect();
			const midY = rect.top + rect.height / 2;
			if (e.clientY < midY) {
				wEl.addClass('dashboard-sidebar-widget--drag-over-top');
				wEl.removeClass('dashboard-sidebar-widget--drag-over-bottom');
			} else {
				wEl.addClass('dashboard-sidebar-widget--drag-over-bottom');
				wEl.removeClass('dashboard-sidebar-widget--drag-over-top');
			}
		});

		wEl.addEventListener('dragleave', () => {
			wEl.removeClass('dashboard-sidebar-widget--drag-over-top');
			wEl.removeClass('dashboard-sidebar-widget--drag-over-bottom');
		});

		wEl.addEventListener('drop', (e) => {
			e.preventDefault();
			wEl.removeClass('dashboard-sidebar-widget--drag-over-top');
			wEl.removeClass('dashboard-sidebar-widget--drag-over-bottom');
			if (!draggedKey || wEl.dataset.widgetKey === draggedKey) return;

			const targetKey = wEl.dataset.widgetKey ?? '';
			const rect = wEl.getBoundingClientRect();
			const midY = rect.top + rect.height / 2;
			const insertBefore = e.clientY < midY;

			const keys = [...currentKeys];
			const fromIdx = keys.indexOf(draggedKey);
			if (fromIdx === -1) return;
			keys.splice(fromIdx, 1);
			let toIdx = keys.indexOf(targetKey);
			if (toIdx === -1) return;
			if (!insertBefore) toIdx += 1;
			keys.splice(toIdx, 0, draggedKey);
			onReorder(keys);
		});
	});
}

function renderSidebarWeather(container: HTMLElement, settings: DashboardSettings, app: App): void {
	const widget = container.createDiv({ cls: 'dashboard-sidebar-widget dashboard-sidebar-weather' });
	const cityName = settings.widgetWeatherCity || '';

	widget.createDiv({ cls: 'dashboard-sidebar-weather-loading', text: '...' });

	const config = {
		latitude: settings.widgetWeatherLat || 31.23,
		longitude: settings.widgetWeatherLon || 121.47,
		cityName: cityName || 'Shanghai',
	};

	const cached = getCachedWeather(config);
	if (cached) {
		widget.empty();
		renderSidebarWeatherContent(widget, cached, config.cityName);
		return;
	}

	fetchWeather(config).then(data => {
		widget.empty();
		renderSidebarWeatherContent(widget, data, config.cityName);
	}).catch(() => {
		widget.empty();
		widget.createDiv({ cls: 'dashboard-sidebar-weather-error', text: '--' });
	});
}

function renderSidebarWeatherContent(el: HTMLElement, data: WeatherData, cityName: string): void {
	const top = el.createDiv({ cls: 'dashboard-sidebar-weather-top' });
	top.createDiv({ cls: 'dashboard-sidebar-weather-icon', text: getWeatherEmoji(data.weatherCode) });
	const tempWrap = top.createDiv({ cls: 'dashboard-sidebar-weather-temp-wrap' });
	tempWrap.createDiv({ cls: 'dashboard-sidebar-weather-temp', text: `${Math.round(data.temperature)}°` });

	const info = el.createDiv({ cls: 'dashboard-sidebar-weather-info' });
	info.createDiv({ cls: 'dashboard-sidebar-weather-city', text: cityName });
	const descLine = info.createDiv({ cls: 'dashboard-sidebar-weather-desc-line' });
	descLine.createSpan({ cls: 'dashboard-sidebar-weather-desc', text: getWeatherDescription(data.weatherCode) });

	const details = el.createDiv({ cls: 'dashboard-sidebar-weather-details' });
	details.createDiv({ cls: 'dashboard-sidebar-weather-detail', text: `${t('weather.feelsLike') ?? 'Feels like'} ${Math.round(data.feelsLike)}°` });
	details.createDiv({ cls: 'dashboard-sidebar-weather-detail', text: `${t('weather.humidity') ?? 'Humidity'} ${Math.round(data.humidity)}%` });
	details.createDiv({ cls: 'dashboard-sidebar-weather-detail', text: `${Math.round(data.windSpeed)} km/h` });

	if (data.dailyDates.length > 1) {
		const forecast = el.createDiv({ cls: 'dashboard-sidebar-weather-forecast' });
		const count = Math.min(data.dailyDates.length, 5);
		for (let i = 0; i < count; i++) {
			const day = forecast.createDiv({ cls: 'dashboard-sidebar-weather-fday' });
			const d = new Date(data.dailyDates[i]! + 'T00:00:00');
			const dayName = d.toLocaleDateString(getLanguage() === 'zh' ? 'zh-CN' : 'en', { weekday: 'short' });
			day.createDiv({ cls: 'dashboard-sidebar-weather-fday-name', text: i === 0 ? t('weather.today') ?? 'Today' : dayName });
			day.createDiv({ cls: 'dashboard-sidebar-weather-fday-icon', text: getWeatherEmoji(data.dailyCodes[i]!) });
			const temps = day.createDiv({ cls: 'dashboard-sidebar-weather-fday-temps' });
			temps.createSpan({ cls: 'dashboard-sidebar-weather-fday-high', text: `${Math.round(data.dailyMax[i]!)}°` });
			temps.createSpan({ cls: 'dashboard-sidebar-weather-fday-low', text: `${Math.round(data.dailyMin[i]!)}°` });
		}
	}
}

export function renderSidebarPomodoro(
	container: HTMLElement,
	service: PomodoroService,
	settings: DashboardSettings,
): void {
	const widget = container.createDiv({ cls: 'dashboard-sidebar-widget dashboard-sidebar-pomodoro' });

	const state = service.getState();
	const isRunning = state.status === 'running';

	// Top row: today count left + activity selector centered + stats button right
	const topRow = widget.createDiv({ cls: 'dashboard-sidebar-pomodoro-top' });

	const todayCount = service.getTodayCount();
	const statsHint = topRow.createDiv({
		cls: 'dashboard-sidebar-pomodoro-stats-hint',
		text: '🍅 ' + t('pomodoro.today') + ' ' + todayCount,
	});

	topRow.createDiv({ cls: 'dashboard-sidebar-pomodoro-top-spacer' });

	// Activity selector (in title position)
	const currentActivity = service.getActivity();
	createActivitySelector(topRow, service, currentActivity);

	const statsBtn = topRow.createDiv({ cls: 'dashboard-sidebar-pomodoro-stats-btn' });
	setIcon(statsBtn, 'bar-chart-2');

	// Ring
	const ringWrap = widget.createDiv({ cls: 'dashboard-sidebar-pomodoro-ring-wrap' });
	const svgSize = 72;
	const strokeWidth = 6;
	const radius = (svgSize - strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;

	const svg = ringWrap.createSvg('svg', {
		cls: 'dashboard-sidebar-pomodoro-ring',
		attr: { viewBox: `0 0 ${svgSize} ${svgSize}`, width: String(svgSize), height: String(svgSize) },
	});
	svg.createSvg('circle', {
		cls: 'dashboard-sidebar-pomodoro-ring-bg',
		attr: { cx: svgSize / 2, cy: svgSize / 2, r: radius, 'stroke-width': strokeWidth, fill: 'none' },
	});
	const progressCircle = svg.createSvg('circle', {
		cls: 'dashboard-sidebar-pomodoro-ring-progress',
		attr: {
			cx: svgSize / 2, cy: svgSize / 2, r: radius, 'stroke-width': strokeWidth, fill: 'none',
			'stroke-linecap': 'round', 'stroke-dasharray': circumference, 'stroke-dashoffset': '0',
			transform: `rotate(-90 ${svgSize / 2} ${svgSize / 2})`,
		},
	});
	const timeText = ringWrap.createDiv({
		cls: 'dashboard-sidebar-pomodoro-time',
		text: formatTime(state.remainingSeconds),
	});

	// Dots inside ring, below time
	const dotsWrap = ringWrap.createDiv({ cls: 'dashboard-sidebar-pomodoro-dots' });
	const interval = settings.pomodoroLongBreakInterval;
	for (let i = 0; i < interval; i++) {
		dotsWrap.createDiv({
			cls: 'dashboard-sidebar-pomodoro-dot' + (i < state.completedWorkSessions ? ' dashboard-sidebar-pomodoro-dot--filled' : ''),
		});
	}

	// Start/stop button
	const mainBtn = widget.createEl('button', {
		cls: 'dashboard-sidebar-pomodoro-main-btn',
		text: isRunning ? t('pomodoro.stop') : t('pomodoro.startFocus'),
	});
	if (isRunning) {
		mainBtn.addClass('dashboard-sidebar-pomodoro-main-btn--running');
	}

	// --- Helpers ---
	function updateRing(remaining: number, total: number): void {
		const progress = total > 0 ? remaining / total : 1;
		progressCircle.setAttribute('stroke-dashoffset', String(circumference * (1 - progress)));
		timeText.textContent = formatTime(remaining);
	}
	updateRing(state.remainingSeconds, state.totalSeconds);

	function updateUI(): void {
		const s = service.getState();
		updateRing(s.remainingSeconds, s.totalSeconds);
		const running = s.status === 'running';
		mainBtn.textContent = running ? t('pomodoro.stop') : t('pomodoro.startFocus');
		mainBtn.toggleClass('dashboard-sidebar-pomodoro-main-btn--running', running);
		const dots = dotsWrap.querySelectorAll('.dashboard-sidebar-pomodoro-dot');
		dots.forEach((dot, i) => dot.toggleClass('dashboard-sidebar-pomodoro-dot--filled', i < s.completedWorkSessions));
		const tc = service.getTodayCount();
		statsHint.textContent = t('pomodoro.today') + ' ' + tc;
	}

	service.setOnTick(() => {
		const s = service.getState();
		updateRing(s.remainingSeconds, s.totalSeconds);
	});

	service.setOnComplete(() => updateUI());

	mainBtn.addEventListener('click', () => {
		if (service.getState().status === 'running') {
			service.reset();
			updateUI();
		} else {
			service.start();
			updateUI();
		}
	});

	statsBtn.addEventListener('click', () => {
		showPomodoroStats(widget.ownerDocument, service);
	});
}

function createActivitySelector(
	parent: HTMLElement,
	service: PomodoroService,
	initialActivity: string,
): { activityTrigger: HTMLElement; updateActivityDisplay: (name: string) => void } {
	const wrap = parent.createDiv({ cls: 'dashboard-pomodoro-activity-selector' });

	const trigger = wrap.createDiv({
		cls: 'dashboard-pomodoro-activity-trigger' + (initialActivity ? ' dashboard-pomodoro-activity-trigger--set' : ''),
	});

	let colorDot: HTMLElement | null = null;

	if (initialActivity) {
		colorDot = trigger.createDiv({ cls: 'dashboard-pomodoro-activity-color-dot' });
		colorDot.style.backgroundColor = activityColor(initialActivity);
		trigger.createSpan({ text: initialActivity });
	} else {
		trigger.createSpan({ text: t('pomodoro.tapToSetActivity'), cls: 'dashboard-pomodoro-activity-placeholder' });
	}

	let panel: HTMLElement | null = null;

	function updateActivityDisplay(name: string): void {
		trigger.empty();
		trigger.toggleClass('dashboard-pomodoro-activity-trigger--set', name.length > 0);
		if (name) {
			const dot = trigger.createDiv({ cls: 'dashboard-pomodoro-activity-color-dot' });
			dot.style.backgroundColor = activityColor(name);
			trigger.createSpan({ text: name });
		} else {
			trigger.createSpan({ text: t('pomodoro.tapToSetActivity'), cls: 'dashboard-pomodoro-activity-placeholder' });
		}
	}

	function closePanel(): void {
		if (panel) {
			panel.remove();
			panel = null;
		}
	}

	function openPanel(): void {
		closePanel();

		panel = wrap.createDiv({ cls: 'dashboard-pomodoro-activity-panel' });

		const input = panel.createEl('input', {
			cls: 'dashboard-pomodoro-activity-panel-input',
			attr: { type: 'text', placeholder: t('pomodoro.inputActivity') },
		});

		const recentActivities = service.getRecentActivities(6);
		if (recentActivities.length > 0) {
			const chipsWrap = panel.createDiv({ cls: 'dashboard-pomodoro-activity-chips' });
			for (const act of recentActivities) {
				const chip = chipsWrap.createDiv({ cls: 'dashboard-pomodoro-activity-chip' });
				const dot = chip.createDiv({ cls: 'dashboard-pomodoro-activity-color-dot' });
				dot.style.backgroundColor = activityColor(act);
				chip.createSpan({ text: act });
				chip.addEventListener('click', (e) => {
					e.stopPropagation();
					service.setActivity(act);
					updateActivityDisplay(act);
					closePanel();
				});
			}
		}

		input.focus();

		const finish = (save: boolean) => {
			const val = input.value.trim();
			if (save && val) {
				service.setActivity(val);
				updateActivityDisplay(val);
			}
			closePanel();
		};

		input.addEventListener('keydown', (e: KeyboardEvent) => {
			if (e.key === 'Enter') { e.preventDefault(); finish(true); }
			else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
		});
	}

	trigger.addEventListener('click', (e) => {
		e.stopPropagation();
		if (panel) {
			closePanel();
		} else {
			openPanel();
		}
	});

	// Close panel when clicking outside
	const doc = parent.ownerDocument;
	const onDocClick = (e: MouseEvent) => {
		if (panel && !panel.contains(e.target as Node) && !trigger.contains(e.target as Node)) {
			closePanel();
		}
	};
	doc.addEventListener('click', onDocClick);

	return { activityTrigger: trigger, updateActivityDisplay };
}

export function renderSidebarCountdown(
	container: HTMLElement,
	cd: import('../core/types').CountdownConfig,
	app: App,
): void {
	const widget = container.createDiv({ cls: 'dashboard-sidebar-widget dashboard-sidebar-countdown' });

	// Settings button (absolute positioned)
	const settingsBtn = widget.createEl('button', {
		cls: 'dashboard-sidebar-countdown-settings-btn',
		attr: { 'aria-label': t('countdown.settingsTitle') },
	});
	setIcon(settingsBtn, 'settings');

	settingsBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		const modal = new CountdownSettingsModal(app, cd, (updated) => {
			const plugin = (app as unknown as { plugins: { plugins: Record<string, { settings?: DashboardSettings; saveSettings?: () => Promise<void>; refreshAllDashboards?: () => void }> } }).plugins?.plugins?.['obsidian-dashboard'];
			if (plugin?.settings) {
				plugin.settings = {
					...plugin.settings,
					countdowns: (plugin.settings.countdowns ?? []).map(c => c.id === updated.id ? updated : c),
				};
				void plugin.saveSettings?.();
				plugin.refreshAllDashboards?.();
			}
		});
		modal.open();
	});

	// Content
	const content = widget.createDiv({ cls: 'dashboard-sidebar-countdown-content' });

	const targetDate = cd.targetDate;
	if (!targetDate) {
		content.createDiv({ cls: 'dashboard-sidebar-countdown-placeholder', text: t('countdown.setTarget') });
		return;
	}

	const target = targetDate.includes('T') ? new Date(targetDate) : new Date(targetDate + 'T00:00:00');
	const now = new Date();

	if (now >= target) {
		if (cd.label) {
			content.createDiv({ cls: 'dashboard-sidebar-countdown-until', text: t('countdown.untilLabel', { label: cd.label }) });
		}
		content.createDiv({ cls: 'dashboard-sidebar-countdown-expired', text: t('countdown.expired') });
		return;
	}

	const diffMs = target.getTime() - now.getTime();
	const remainDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
	const remainHours = Math.ceil(diffMs / (1000 * 60 * 60));
	const displayMode = cd.displayMode;
	const remainMinutes = Math.ceil(diffMs / (1000 * 60));
	const currentVal = displayMode === 'minutes' ? remainMinutes : displayMode === 'hours' ? remainHours : remainDays;

	// "距离xx还有" label above the number
	if (cd.label) {
		content.createDiv({ cls: 'dashboard-sidebar-countdown-until', text: t('countdown.untilLabel', { label: cd.label }) });
	}

	// Value display with flip
	const flipWrap = content.createDiv({ cls: 'dashboard-sidebar-countdown-flip' });
	const valueEl = flipWrap.createDiv({ cls: 'dashboard-sidebar-countdown-value', text: String(currentVal) });
	flipWrap.createDiv({ cls: 'dashboard-sidebar-countdown-unit', text: displayMode === 'minutes' ? t('countdown.minutes') : displayMode === 'hours' ? t('countdown.hours') : t('countdown.days') });

	// Auto-refresh with flip animation
	let prevVal = currentVal;
	const timer = window.setInterval(() => {
		if (!content.isConnected) {
			window.clearInterval(timer);
			countdownTimers.delete(timer);
			return;
		}
		const now2 = new Date();
		if (now2 >= target) {
			window.clearInterval(timer);
			countdownTimers.delete(timer);
			content.empty();
			content.createDiv({ cls: 'dashboard-sidebar-countdown-expired', text: t('countdown.expired') });
			return;
		}
		const diff = target.getTime() - now2.getTime();
		const newVal = displayMode === 'minutes' ? Math.ceil(diff / (1000 * 60)) : displayMode === 'hours' ? Math.ceil(diff / (1000 * 60 * 60)) : Math.ceil(diff / (1000 * 60 * 60 * 24));
		if (newVal !== prevVal) {
			prevVal = newVal;
			valueEl.textContent = String(newVal);
			valueEl.addClass('dashboard-sidebar-countdown-value--flip');
			window.setTimeout(() => valueEl.removeClass('dashboard-sidebar-countdown-value--flip'), 400);
		}
	}, 60000);
	countdownTimers.add(timer);
}

function showPomodoroStats(doc: Document, service: PomodoroService): void {
	const overlay = doc.body.createDiv({ cls: 'dashboard-pomodoro-stats-overlay' });
	const modal = overlay.createDiv({ cls: 'dashboard-pomodoro-stats-modal' });

	function close() {
		doc.removeEventListener('keydown', onKey);
		overlay.remove();
	}
	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}
	doc.addEventListener('keydown', onKey);

	// Header
	const header = modal.createDiv({ cls: 'dashboard-pomodoro-stats-header' });
	header.createDiv({ cls: 'dashboard-pomodoro-stats-header-title', text: t('pomodoro.statsTitle') });
	const closeBtn = header.createDiv({ cls: 'dashboard-pomodoro-stats-close' });
	setIcon(closeBtn, 'x');
	closeBtn.addEventListener('click', () => close());
	overlay.addEventListener('click', (e) => {
		if (e.target === overlay) close();
	});

	// Summary cards
	const summary = modal.createDiv({ cls: 'dashboard-pomodoro-stats-summary' });

	const totalMin = service.getTotalFocusMinutes();
	const todayMin = service.getTodayFocusMinutes();
	const streak = service.getStreak();

	const totalCard = summary.createDiv({ cls: 'dashboard-pomodoro-stats-card' });
	totalCard.createDiv({ cls: 'dashboard-pomodoro-stats-card-value', text: formatMinutes(totalMin) });
	totalCard.createDiv({ cls: 'dashboard-pomodoro-stats-card-label', text: t('pomodoro.totalFocus') });

	const todayCard = summary.createDiv({ cls: 'dashboard-pomodoro-stats-card' });
	todayCard.createDiv({ cls: 'dashboard-pomodoro-stats-card-value', text: formatMinutes(todayMin) });
	todayCard.createDiv({ cls: 'dashboard-pomodoro-stats-card-label', text: t('pomodoro.todayFocus') });

	const streakCard = summary.createDiv({ cls: 'dashboard-pomodoro-stats-card' });
	streakCard.createDiv({ cls: 'dashboard-pomodoro-stats-card-value', text: String(streak) });
	streakCard.createDiv({ cls: 'dashboard-pomodoro-stats-card-label', text: t('pomodoro.streakDays') });

	// Donut chart section with range toggle
	const donutSection = modal.createDiv({ cls: 'dashboard-pomodoro-stats-section' });

	// Range toggle: Day / Week / Month
	const rangeToggle = donutSection.createDiv({ cls: 'dashboard-pomodoro-range-toggle' });
	const ranges: { key: string; label: string; days: number }[] = [
		{ key: 'day', label: t('pomodoro.rangeDay'), days: 1 },
		{ key: 'week', label: t('pomodoro.rangeWeek'), days: 7 },
		{ key: 'month', label: t('pomodoro.rangeMonth'), days: 30 },
	];
	let activeRange = 'week';

	const toggleButtons = ranges.map(r => {
		const btn = rangeToggle.createDiv({
			cls: 'dashboard-pomodoro-range-btn' + (r.key === activeRange ? ' dashboard-pomodoro-range-btn--active' : ''),
			text: r.label,
		});
		return btn;
	});

	// Donut chart container
	const donutContainer = donutSection.createDiv({ cls: 'dashboard-pomodoro-donut-container' });

	function renderDonut(rangeKey: string): void {
		donutContainer.empty();

		const rangeInfo = ranges.find(r => r.key === rangeKey);
		if (!rangeInfo) return;

		const breakdown = rangeKey === 'week'
			? service.getActivityBreakdownByCalendarWeek()
			: rangeKey === 'month'
				? service.getActivityBreakdownByCalendarMonth()
				: service.getActivityBreakdownByRange(rangeInfo.days);
		const sorted = [...breakdown.entries()].sort((a, b) => b[1] - a[1]);
		const totalRangeMin = sorted.reduce((sum, [, m]) => sum + m, 0);

		if (totalRangeMin === 0) {
			donutContainer.createDiv({ cls: 'dashboard-pomodoro-donut-empty', text: t('pomodoro.noRecords') });
			return;
		}

		// SVG donut chart
		const size = 160;
		const strokeWidth = 28;
		const donutR = (size - strokeWidth) / 2;
		const circumference = 2 * Math.PI * donutR;

		const svg = donutContainer.createSvg('svg', {
			cls: 'dashboard-pomodoro-donut-svg',
			attr: { viewBox: `0 0 ${size} ${size}`, width: String(size), height: String(size) },
		});

		// Background circle
		svg.createSvg('circle', {
			attr: { cx: size / 2, cy: size / 2, r: donutR, fill: 'none', 'stroke-width': strokeWidth },
			cls: 'dashboard-pomodoro-donut-bg',
		});

		// Draw arcs
		let offset = 0;
		const gap = sorted.length > 1 ? 3 : 0;
		for (const [name, mins] of sorted) {
			const pct = mins / totalRangeMin;
			const dashLen = Math.max(0, circumference * pct - gap);
			const circle = svg.createSvg('circle', {
				cls: 'dashboard-pomodoro-donut-segment',
				attr: {
					cx: size / 2, cy: size / 2, r: donutR, fill: 'none',
					'stroke-width': strokeWidth,
					'stroke-dasharray': `${dashLen} ${circumference - dashLen}`,
					'stroke-dashoffset': String(-offset),
					transform: `rotate(-90 ${size / 2} ${size / 2})`,
					'stroke-linecap': 'butt',
				},
			});
			circle.style.stroke = activityColor(name);
			offset += dashLen + gap;
		}

		// Center text: total time
		const centerValue = svg.createSvg('text', {
			attr: {
				x: size / 2, y: size / 2 - 6,
				'text-anchor': 'middle', 'dominant-baseline': 'middle',
			},
			cls: 'dashboard-pomodoro-donut-center-value',
		});
		centerValue.textContent = formatMinutes(totalRangeMin);

		const centerLabel = svg.createSvg('text', {
			attr: {
				x: size / 2, y: size / 2 + 14,
				'text-anchor': 'middle', 'dominant-baseline': 'middle',
			},
			cls: 'dashboard-pomodoro-donut-center-label',
		});
		centerLabel.textContent = rangeInfo.label;

		// Legend with percentages
		const legend = donutContainer.createDiv({ cls: 'dashboard-pomodoro-donut-legend' });
		for (const [name, mins] of sorted) {
			const pct = Math.round((mins / totalRangeMin) * 100);
			const item = legend.createDiv({ cls: 'dashboard-pomodoro-donut-legend-item' });
			const dot = item.createDiv({ cls: 'dashboard-pomodoro-donut-legend-dot' });
			dot.style.backgroundColor = activityColor(name);
			item.createDiv({ cls: 'dashboard-pomodoro-donut-legend-name', text: name });
			item.createDiv({ cls: 'dashboard-pomodoro-donut-legend-pct', text: pct + '%' });
			item.createDiv({ cls: 'dashboard-pomodoro-donut-legend-time', text: formatMinutes(mins) });
		}
	}

	// Toggle handlers
	toggleButtons.forEach((btn, i) => {
		btn.addEventListener('click', () => {
			activeRange = ranges[i]!.key;
			toggleButtons.forEach((b, j) => b.toggleClass('dashboard-pomodoro-range-btn--active', j === i));
			renderDonut(activeRange);
		});
	});

	renderDonut(activeRange);

	// Recent sessions with activity color dots
	const recentRecords = service.getRecentRecords(10);
	if (recentRecords.length > 0) {
		const recentSection = modal.createDiv({ cls: 'dashboard-pomodoro-stats-section' });
		recentSection.createDiv({ cls: 'dashboard-pomodoro-stats-section-title', text: t('pomodoro.recentSessions') });
		for (const rec of recentRecords) {
			const row = recentSection.createDiv({ cls: 'dashboard-pomodoro-stats-record-row' });
			const actDot = row.createDiv({ cls: 'dashboard-pomodoro-stats-record-dot' });
			actDot.style.backgroundColor = activityColor(rec.activity || t('pomodoro.defaultActivity'));
			const ts = new Date(rec.timestamp);
			const dateStr = ts.getMonth() + 1 + '/' + ts.getDate() + ' ' +
				String(ts.getHours()).padStart(2, '0') + ':' + String(ts.getMinutes()).padStart(2, '0');
			row.createDiv({ cls: 'dashboard-pomodoro-stats-record-date', text: dateStr });
			row.createDiv({ cls: 'dashboard-pomodoro-stats-record-activity', text: rec.activity });
			row.createDiv({ cls: 'dashboard-pomodoro-stats-record-duration', text: rec.duration + ' min' });
		}
	}
}

export function renderSidebarReading(
	container: HTMLElement,
	service: ReadingService,
): void {
	const widget = container.createDiv({ cls: 'dashboard-sidebar-widget dashboard-sidebar-reading' });

	// Title row
	const titleRow = widget.createDiv({ cls: 'dashboard-reading-title-row' });
	titleRow.createDiv({ cls: 'dashboard-reading-title', text: t('reading.title') });
	titleRow.createDiv({ cls: 'dashboard-reading-title-spacer' });
	const addBtn = titleRow.createDiv({ cls: 'dashboard-reading-add-btn' });
	setIcon(addBtn, 'plus');
	const statsBtn = titleRow.createDiv({ cls: 'dashboard-reading-stats-btn' });
	setIcon(statsBtn, 'bar-chart-2');

	// Book cards scroll area
	const scrollArea = widget.createDiv({ cls: 'dashboard-reading-scroll' });

	const state = service.getState();
	const activeBooks = service.getActiveBooks();

	for (const book of activeBooks) {
		const isActive = state.status !== 'idle' && state.currentBook?.title === book.title;
		const isRunning = isActive && state.status === 'running';
		const card = scrollArea.createDiv({
			cls: 'dashboard-reading-book-card' + (isActive ? ' dashboard-reading-book-card--active' : ''),
		});

		// Cover - always show title fallback, async load real cover
		const coverWrap = card.createDiv({ cls: 'dashboard-reading-book-card-cover-wrap' });
		const placeholder = coverWrap.createDiv({ cls: 'dashboard-reading-book-card-cover-placeholder' });
		placeholder.textContent = book.title.length > 8 ? book.title.slice(0, 8) + '..' : book.title;
		if (book.coverUrl) {
			void downloadCoverAsBlobUrl(book.coverUrl).then(blobUrl => {
				if (blobUrl) {
					placeholder.setCssProps({ display: 'none' });
					coverWrap.style.backgroundImage = `url(${blobUrl})`;
				}
			});
		}

		// Info area
		const info = card.createDiv({ cls: 'dashboard-reading-book-card-info' });
		info.createDiv({ cls: 'dashboard-reading-book-card-title', text: book.title });
		if (book.author) {
			info.createDiv({ cls: 'dashboard-reading-book-card-author', text: book.author });
		}

		// Timer row
		const timerRow = info.createDiv({ cls: 'dashboard-reading-book-card-timer' });

		if (isActive) {
			timerRow.createDiv({
				cls: 'dashboard-reading-book-card-time dashboard-reading-book-card-time--active',
				text: formatTime(state.elapsedSeconds),
			});
		} else {
			const todaySec = service.getTodaySecondsForBook(book.title);
			timerRow.createDiv({
				cls: 'dashboard-reading-book-card-time',
				text: todaySec > 0 ? formatShortDuration(todaySec) : '--',
			});
		}

		// Play/pause/stop buttons
		const actions = timerRow.createDiv({ cls: 'dashboard-reading-book-card-actions' });

		if (isRunning) {
			const pauseBtn = actions.createDiv({ cls: 'dashboard-reading-book-card-btn dashboard-reading-book-card-btn--pause' });
			setIcon(pauseBtn, 'pause');
			pauseBtn.addEventListener('click', (e) => { e.stopPropagation(); service.pause(); refreshCards(); });
			const stopBtn = actions.createDiv({ cls: 'dashboard-reading-book-card-btn dashboard-reading-book-card-btn--stop' });
			setIcon(stopBtn, 'square');
			stopBtn.addEventListener('click', (e) => { e.stopPropagation(); service.pause(); showEndModal(book); });
		} else if (isActive && state.status === 'paused') {
			const resumeBtn = actions.createDiv({ cls: 'dashboard-reading-book-card-btn dashboard-reading-book-card-btn--play' });
			setIcon(resumeBtn, 'play');
			resumeBtn.addEventListener('click', (e) => { e.stopPropagation(); service.resume(); refreshCards(); });
			const stopBtn = actions.createDiv({ cls: 'dashboard-reading-book-card-btn dashboard-reading-book-card-btn--stop' });
			setIcon(stopBtn, 'square');
			stopBtn.addEventListener('click', (e) => { e.stopPropagation(); showEndModal(book); });
		} else {
			const playBtn = actions.createDiv({ cls: 'dashboard-reading-book-card-btn dashboard-reading-book-card-btn--play' });
			setIcon(playBtn, 'play');
			playBtn.addEventListener('click', (e) => { e.stopPropagation(); service.startReading(book); refreshCards(); });
		}

		// Progress bar
		if (book.totalPages > 0) {
			const progressWrap = info.createDiv({ cls: 'dashboard-reading-book-card-progress' });
			const pct = book.finished ? 100 : Math.min(100, Math.round((book.currentPage / book.totalPages) * 100));
			const progressBar = progressWrap.createDiv({ cls: 'dashboard-reading-book-card-progress-bar' });
			progressBar.createDiv({
				cls: 'dashboard-reading-book-card-progress-fill' + (book.finished ? ' dashboard-reading-book-card-progress-fill--done' : ''),
				attr: { style: `width:${pct}%` },
			});
			progressWrap.createDiv({
				cls: 'dashboard-reading-book-card-progress-text',
				text: book.finished ? '100%' : `${book.currentPage}/${book.totalPages}`,
			});
		}

		// Action buttons (edit / remove)
		const editBtn = card.createDiv({ cls: 'dashboard-reading-book-card-action dashboard-reading-book-card-edit' });
		setIcon(editBtn, 'pencil');
		editBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			openEditBookInfo(widget.ownerDocument, service, book, () => refreshCards());
		});

		const removeBtn = card.createDiv({ cls: 'dashboard-reading-book-card-action dashboard-reading-book-card-remove' });
		setIcon(removeBtn, 'x');
		removeBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			void service.removeActiveBook(book.title).then(() => refreshCards());
		});
	}

	// Timer tick - update active timer display
	service.setOnTick(() => {
		const s = service.getState();
		if (s.status === 'running') {
			const activeTime = scrollArea.querySelector('.dashboard-reading-book-card-time--active');
			if (activeTime) activeTime.textContent = formatTime(s.elapsedSeconds);
		}
	});

	addBtn.addEventListener('click', () => {
		openBookSearch(widget.ownerDocument, service, (book) => {
			if (book) void service.addActiveBook(book).then(() => refreshCards());
		});
	});

	statsBtn.addEventListener('click', () => {
		showReadingStats(widget.ownerDocument, service);
	});

	function showEndModal(book: import('../services/reading').BookInfo): void {
		const elapsed = service.getElapsedSeconds();
		openEndReadingModal(widget.ownerDocument, service, book, elapsed, () => refreshCards());
	}

	function refreshCards(): void {
		service.setOnTick(null);
		const parent = widget.parentElement!;
		widget.remove();
		renderSidebarReading(parent, service);
	}
}

function openEndReadingModal(
	doc: Document,
	service: ReadingService,
	book: import('../services/reading').BookInfo,
	elapsedSeconds: number,
	onDone: () => void,
): void {
	const overlay = doc.body.createDiv({ cls: 'dashboard-reading-end-overlay' });
	const modal = overlay.createDiv({ cls: 'dashboard-reading-end-modal' });

	function close() {
		doc.removeEventListener('keydown', onKey);
		overlay.remove();
	}
	function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close(); }
	doc.addEventListener('keydown', onKey);
	overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

	// Header
	const header = modal.createDiv({ cls: 'dashboard-reading-end-header' });
	header.createDiv({ cls: 'dashboard-reading-end-title', text: t('reading.endTitle') });
	const closeBtn = header.createDiv({ cls: 'dashboard-reading-end-close' });
	setIcon(closeBtn, 'x');
	closeBtn.addEventListener('click', close);

	// Body
	const body = modal.createDiv({ cls: 'dashboard-reading-end-body' });

	// Date row
	const dateRow = body.createDiv({ cls: 'dashboard-reading-end-row' });
	dateRow.createDiv({ cls: 'dashboard-reading-end-label', text: t('reading.endDate') });
	const now = new Date();
	dateRow.createDiv({
		cls: 'dashboard-reading-end-value',
		text: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
	});

	// Duration row
	const durRow = body.createDiv({ cls: 'dashboard-reading-end-row' });
	durRow.createDiv({ cls: 'dashboard-reading-end-label', text: t('reading.endDuration') });
	durRow.createDiv({ cls: 'dashboard-reading-end-value', text: formatReadingDuration(elapsedSeconds) });

	// Progress section
	const progressSection = body.createDiv({ cls: 'dashboard-reading-end-section' });
	progressSection.createDiv({ cls: 'dashboard-reading-end-section-title', text: t('reading.endProgress') });

	// Mode toggle: page / percentage
	let progressMode: 'page' | 'pct' = book.totalPages > 0 ? 'page' : 'pct';
	const modeToggle = progressSection.createDiv({ cls: 'dashboard-reading-end-mode-toggle' });
	const pageModeBtn = modeToggle.createDiv({
		cls: 'dashboard-reading-end-mode-btn' + (progressMode === 'page' ? ' dashboard-reading-end-mode-btn--active' : ''),
		text: t('reading.endModePage'),
	});
	const pctModeBtn = modeToggle.createDiv({
		cls: 'dashboard-reading-end-mode-btn' + (progressMode === 'pct' ? ' dashboard-reading-end-mode-btn--active' : ''),
		text: t('reading.endModePct'),
	});

	// Inputs container
	const inputsContainer = progressSection.createDiv({ cls: 'dashboard-reading-end-inputs' });

	function renderInputs(): void {
		inputsContainer.empty();
		const pageRow = inputsContainer.createDiv({ cls: 'dashboard-reading-end-page-row' });

		// Start value (readonly)
		const startCol = pageRow.createDiv({ cls: 'dashboard-reading-end-page-col' });
		startCol.createDiv({ cls: 'dashboard-reading-end-page-label', text: t('reading.endStartPage') });
		const startVal = progressMode === 'pct'
			? (book.totalPages > 0 ? Math.round((book.currentPage / book.totalPages) * 100) : 0)
			: book.currentPage;
		const suffix = progressMode === 'pct' ? '%' : '';
		startCol.createDiv({ cls: 'dashboard-reading-end-page-readonly', text: `${startVal}${suffix}` });

		pageRow.createDiv({ cls: 'dashboard-reading-end-page-arrow' });

		// End value (input)
		const endCol = pageRow.createDiv({ cls: 'dashboard-reading-end-page-col' });
		endCol.createDiv({ cls: 'dashboard-reading-end-page-label', text: t('reading.endEndPage') });
		const endInput = endCol.createEl('input', {
			cls: 'dashboard-reading-end-page-input',
			attr: {
				type: 'number',
				min: '0',
				max: progressMode === 'pct' ? '100' : '',
				placeholder: progressMode === 'pct' ? '0%' : '0',
			},
		});
		endInput.focus();

		// Total pages row (page mode, unknown total)
		if (progressMode === 'page' && !book.totalPages) {
			const totalRow = inputsContainer.createDiv({ cls: 'dashboard-reading-end-total-row' });
			totalRow.createDiv({ cls: 'dashboard-reading-end-page-label', text: t('reading.endTotalPages') });
			totalRow.createEl('input', {
				cls: 'dashboard-reading-end-page-input dashboard-reading-end-page-input--total',
				attr: { type: 'number', min: '0', placeholder: '?' },
			});
		}
	}
	renderInputs();

	pageModeBtn.addEventListener('click', () => {
		progressMode = 'page';
		pageModeBtn.addClass('dashboard-reading-end-mode-btn--active');
		pctModeBtn.removeClass('dashboard-reading-end-mode-btn--active');
		renderInputs();
	});
	pctModeBtn.addEventListener('click', () => {
		progressMode = 'pct';
		pctModeBtn.addClass('dashboard-reading-end-mode-btn--active');
		pageModeBtn.removeClass('dashboard-reading-end-mode-btn--active');
		renderInputs();
	});

	// Finished checkbox
	const finishedRow = body.createDiv({ cls: 'dashboard-reading-end-finished' });
	const checkbox = finishedRow.createEl('input', {
		cls: 'dashboard-reading-end-checkbox',
		attr: { type: 'checkbox', id: 'reading-finished' },
	});
	const checkLabel = finishedRow.createEl('label', {
		cls: 'dashboard-reading-end-checkbox-label',
		attr: { for: 'reading-finished' },
	});
	checkLabel.textContent = t('reading.endMarkFinished');

	// Footer
	const footer = modal.createDiv({ cls: 'dashboard-reading-end-footer' });

	footer.createEl('button', {
		cls: 'dashboard-reading-end-btn dashboard-reading-end-btn--cancel',
		text: t('reading.endCancel'),
	}).addEventListener('click', close);

	footer.createEl('button', {
		cls: 'dashboard-reading-end-btn dashboard-reading-end-btn--discard',
		text: t('reading.endDiscard'),
	}).addEventListener('click', () => {
		service.discardSession();
		close();
		onDone();
	});

	footer.createEl('button', {
		cls: 'dashboard-reading-end-btn dashboard-reading-end-btn--confirm',
		text: t('reading.endConfirm'),
	}).addEventListener('click', () => {
		void (async () => {
			const endInput = inputsContainer.querySelector<HTMLInputElement>('.dashboard-reading-end-page-input:not(.dashboard-reading-end-page-input--total)');
			const totalInput = inputsContainer.querySelector<HTMLInputElement>('.dashboard-reading-end-page-input--total');
			const endVal = parseInt(endInput?.value || '0') || 0;
			const finished = checkbox.checked;

			let endPage: number;
			let totalPages = book.totalPages;

			if (progressMode === 'pct') {
				if (totalPages > 0) {
					endPage = Math.round((Math.min(endVal, 100) / 100) * totalPages);
				} else {
					endPage = Math.min(endVal, 100);
					totalPages = 100;
				}
			} else {
				endPage = endVal;
				if (totalInput) {
					totalPages = parseInt(totalInput.value) || 0;
				}
			}

			await service.finishSession(endPage, totalPages, finished);
			close();
			onDone();
		})();
	});
}

function openEditBookInfo(
	doc: Document,
	service: ReadingService,
	book: import('../services/reading').BookInfo,
	onDone: () => void,
): void {
	const overlay = doc.body.createDiv({ cls: 'dashboard-reading-end-overlay' });
	const modal = overlay.createDiv({ cls: 'dashboard-reading-end-modal' });

	function close() {
		doc.removeEventListener('keydown', onKey);
		overlay.remove();
	}
	function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close(); }
	doc.addEventListener('keydown', onKey);
	overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

	const header = modal.createDiv({ cls: 'dashboard-reading-end-header' });
	header.createDiv({ cls: 'dashboard-reading-end-title', text: t('reading.editTitle') });
	const closeBtn = header.createDiv({ cls: 'dashboard-reading-end-close' });
	setIcon(closeBtn, 'x');
	closeBtn.addEventListener('click', close);

	const body = modal.createDiv({ cls: 'dashboard-reading-end-body' });

	body.createDiv({ cls: 'dashboard-reading-end-label', text: t('reading.editBookName') });
	const titleInput = body.createEl('input', {
		cls: 'dashboard-reading-end-input',
		attr: { type: 'text' },
	});
	titleInput.value = book.title;

	body.createDiv({ cls: 'dashboard-reading-end-label', text: t('reading.editAuthorName') });
	const authorInput = body.createEl('input', {
		cls: 'dashboard-reading-end-input',
		attr: { type: 'text' },
	});
	authorInput.value = book.author;

	body.createDiv({ cls: 'dashboard-reading-end-label', text: t('reading.editTotalPages') });
	const pagesInput = body.createEl('input', {
		cls: 'dashboard-reading-end-input',
		attr: { type: 'number', min: '0' },
	});
	pagesInput.value = String(book.totalPages || '');

	body.createDiv({ cls: 'dashboard-reading-end-label', text: t('reading.editCoverUrl') });
	const coverInput = body.createEl('input', {
		cls: 'dashboard-reading-end-input',
		attr: { type: 'text', placeholder: t('reading.editCoverPlaceholder') },
	});
	coverInput.value = book.coverUrl;

	const footer = modal.createDiv({ cls: 'dashboard-reading-end-footer' });
	const saveBtn = footer.createEl('button', {
		cls: 'dashboard-reading-end-btn dashboard-reading-end-btn--confirm',
		text: t('reading.editConfirm'),
	});
	footer.createEl('button', {
		cls: 'dashboard-reading-end-btn dashboard-reading-end-btn--cancel',
		text: t('reading.endCancel'),
	}).addEventListener('click', close);

	const deleteBtn = footer.createEl('button', {
		cls: 'dashboard-reading-end-btn dashboard-reading-end-btn--delete',
		text: t('reading.editDeleteBook'),
	});
	deleteBtn.addEventListener('click', () => {
		void (async () => {
			await service.removeActiveBook(book.title);
			close();
			onDone();
		})();
	});

	saveBtn.addEventListener('click', () => {
		void (async () => {
			const newTitle = titleInput.value.trim();
			if (!newTitle) return;

			await service.updateBookInfo(book.title, {
				title: newTitle,
				author: authorInput.value.trim(),
				coverUrl: coverInput.value.trim(),
				totalPages: parseInt(pagesInput.value) || 0,
			});
			close();
			onDone();
		})();
	});

	titleInput.focus();
}

function openBookSearch(
	doc: Document,
	service: ReadingService,
	onSelect: (book: import('../services/reading').BookInfo | null) => void,
): void {
	const overlay = doc.body.createDiv({ cls: 'dashboard-reading-book-overlay' });
	const modal = overlay.createDiv({ cls: 'dashboard-reading-book-modal' });

	function close() {
		doc.removeEventListener('keydown', onKey);
		overlay.remove();
	}
	function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close(); }
	doc.addEventListener('keydown', onKey);

	overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

	const header = modal.createDiv({ cls: 'dashboard-reading-book-header' });
	header.createDiv({ cls: 'dashboard-reading-book-header-title', text: t('reading.selectBook') });
	const closeBtn = header.createDiv({ cls: 'dashboard-reading-book-close' });
	setIcon(closeBtn, 'x');
	closeBtn.addEventListener('click', close);

	const inputArea = modal.createDiv({ cls: 'dashboard-reading-book-input-area' });
	const input = inputArea.createEl('input', {
		cls: 'dashboard-reading-book-input',
		attr: { type: 'text', placeholder: t('reading.searchBook') },
	});
	input.focus();

	const resultsArea = modal.createDiv({ cls: 'dashboard-reading-book-results' });

	// Manual input row (always at bottom)
	const manualRow = resultsArea.createDiv({ cls: 'dashboard-reading-book-manual' });
	manualRow.createDiv({ cls: 'dashboard-reading-book-manual-label', text: t('reading.manualInput') });
	const manualInput = manualRow.createEl('input', {
		cls: 'dashboard-reading-book-manual-input',
		attr: { type: 'text', placeholder: t('reading.manualPlaceholder') },
	});
	const manualBtn = manualRow.createEl('button', {
		cls: 'dashboard-reading-book-manual-btn',
		text: 'OK',
	});
	manualBtn.addEventListener('click', () => {
		const val = manualInput.value.trim();
		if (val) {
			onSelect({ title: val, author: '', coverUrl: '', isbn: '', source: 'manual', currentPage: 0, totalPages: 0, finished: false });
			close();
		}
	});

	let searchTimer: number | null = null;
	let searching = false;

	input.addEventListener('input', () => {
		if (searchTimer) window.clearTimeout(searchTimer);
		const query = input.value.trim();

		// Remove previous search results (keep manual row)
		while (resultsArea.firstChild && resultsArea.firstChild !== manualRow) {
			resultsArea.removeChild(resultsArea.firstChild);
		}

		if (!query) return;

		const indicator = resultsArea.createDiv({ cls: 'dashboard-reading-book-searching', text: t('reading.searching') });
		resultsArea.insertBefore(indicator, manualRow);

		searchTimer = window.setTimeout(() => {
			void (async () => {
				if (searching) return;
				searching = true;

				let results: import('../services/book').BookSearchResult[] = [];
				try {
					results = await searchBooks(query);
				} catch {
					results = [];
				}
				searching = false;

				// Remove previous results
				while (resultsArea.firstChild && resultsArea.firstChild !== manualRow) {
					resultsArea.removeChild(resultsArea.firstChild);
				}

				if (results.length === 0) {
					const noResult = resultsArea.createDiv({ cls: 'dashboard-reading-book-no-results', text: t('reading.noResults') });
					resultsArea.insertBefore(noResult, manualRow);
					return;
				}

				for (const book of results) {
					const item = resultsArea.createDiv({ cls: 'dashboard-reading-book-item' });
					if (book.coverUrl) {
						const c = item.createDiv({ cls: 'dashboard-reading-book-item-cover' });
						void downloadCoverAsBlobUrl(book.coverUrl).then(url => { if (url) c.style.backgroundImage = `url(${url})`; });
					} else {
						item.createDiv({ cls: 'dashboard-reading-book-item-nocover' });
					}
					const info = item.createDiv({ cls: 'dashboard-reading-book-item-info' });
					info.createDiv({ cls: 'dashboard-reading-book-item-title', text: book.title });
					if (book.author) {
						info.createDiv({ cls: 'dashboard-reading-book-item-author', text: book.author });
					}
					item.addEventListener('click', () => {
						onSelect({
							title: book.title, author: book.author, coverUrl: book.coverUrl,
							isbn: book.isbn, source: 'google', currentPage: 0, totalPages: 0, finished: false,
						});
						close();
					});
					resultsArea.insertBefore(item, manualRow);
				}
			})();
		}, 500);
	});
}

function showReadingStats(doc: Document, service: ReadingService): void {
	const overlay = doc.body.createDiv({ cls: 'dashboard-pomodoro-stats-overlay' });
	const modal = overlay.createDiv({ cls: 'dashboard-pomodoro-stats-modal' });

	function close() {
		doc.removeEventListener('keydown', onKey);
		overlay.remove();
	}
	function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close(); }
	doc.addEventListener('keydown', onKey);
	overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

	const header = modal.createDiv({ cls: 'dashboard-pomodoro-stats-header' });
	header.createDiv({ cls: 'dashboard-pomodoro-stats-header-title', text: t('reading.statsTitle') });
	const closeBtn = header.createDiv({ cls: 'dashboard-pomodoro-stats-close' });
	setIcon(closeBtn, 'x');
	closeBtn.addEventListener('click', close);

	const content = modal.createDiv({ cls: 'dashboard-reading-stats-content' });

	function renderContent(): void {
		content.empty();

		// Summary card
		const summaryCard = content.createDiv({ cls: 'dashboard-reading-stats-card' });
		const summaryGrid = summaryCard.createDiv({ cls: 'dashboard-reading-stats-summary' });
		const totalItem = summaryGrid.createDiv({ cls: 'dashboard-reading-stats-summary-item' });
		totalItem.createDiv({ cls: 'dashboard-reading-stats-summary-value', text: formatReadingDuration(service.getTotalSeconds()) });
		totalItem.createDiv({ cls: 'dashboard-reading-stats-summary-label', text: t('reading.totalReading') });
		const todayItem = summaryGrid.createDiv({ cls: 'dashboard-reading-stats-summary-item' });
		todayItem.createDiv({ cls: 'dashboard-reading-stats-summary-value', text: formatReadingDuration(service.getTodaySeconds()) });
		todayItem.createDiv({ cls: 'dashboard-reading-stats-summary-label', text: t('reading.todayReading') });
		const bookItem = summaryGrid.createDiv({ cls: 'dashboard-reading-stats-summary-item' });
		bookItem.createDiv({ cls: 'dashboard-reading-stats-summary-value', text: String(service.getBookCountInRange(365)) });
		bookItem.createDiv({ cls: 'dashboard-reading-stats-summary-label', text: t('reading.bookCount') });
		const streakItem = summaryGrid.createDiv({ cls: 'dashboard-reading-stats-summary-item' });
		streakItem.createDiv({ cls: 'dashboard-reading-stats-summary-value', text: String(service.getStreak()) });
		streakItem.createDiv({ cls: 'dashboard-reading-stats-summary-label', text: t('reading.streakDays') });

		// Book list card
		const bookCard = content.createDiv({ cls: 'dashboard-reading-stats-card' });
		bookCard.createDiv({ cls: 'dashboard-reading-stats-card-title', text: t('reading.bookList') });
		const rangeToggle = bookCard.createDiv({ cls: 'dashboard-reading-stats-range' });
		const ranges: { key: string; label: string; days: number }[] = [
			{ key: 'week', label: t('reading.rangeWeek'), days: 7 },
			{ key: 'month', label: t('reading.rangeMonth'), days: 30 },
			{ key: 'year', label: t('reading.rangeYear'), days: 365 },
		];
		let activeRange = 'month';
		const toggleButtons = ranges.map(r => rangeToggle.createDiv({
			cls: 'dashboard-reading-stats-range-btn' + (r.key === activeRange ? ' dashboard-reading-stats-range-btn--active' : ''),
			text: r.label,
		}));
		const bookListContainer = bookCard.createDiv({ cls: 'dashboard-reading-book-list' });

		function renderBookList(rangeKey: string): void {
			bookListContainer.empty();
			const rangeInfo = ranges.find(r => r.key === rangeKey);
			if (!rangeInfo) return;
			const books = service.getBookBreakdownInRange(rangeInfo.days);
			if (books.length === 0) {
				bookListContainer.createDiv({ cls: 'dashboard-reading-stats-empty', text: t('reading.noRecords') });
				return;
			}
			for (const book of books) {
				const row = bookListContainer.createDiv({ cls: 'dashboard-reading-book-list-row' });
				if (book.coverUrl) {
					const c = row.createDiv({ cls: 'dashboard-reading-book-list-cover' });
					void downloadCoverAsBlobUrl(book.coverUrl).then(url => {
						if (url) c.style.backgroundImage = `url(${url})`;
					});
				} else {
					row.createDiv({ cls: 'dashboard-reading-book-list-nocover' });
				}
				const info = row.createDiv({ cls: 'dashboard-reading-book-list-info' });
				info.createDiv({ cls: 'dashboard-reading-book-list-title', text: book.title });
				if (book.author) info.createDiv({ cls: 'dashboard-reading-book-list-author', text: book.author });
				const meta = row.createDiv({ cls: 'dashboard-reading-book-list-meta' });
				meta.createDiv({ cls: 'dashboard-reading-book-list-duration', text: formatReadingDuration(book.totalSeconds) });
				meta.createDiv({ cls: 'dashboard-reading-book-list-sessions', text: t('reading.times', { count: book.sessions }) });
				const del = meta.createDiv({ cls: 'dashboard-reading-stats-record-del' });
				setIcon(del, 'trash-2');
				del.addEventListener('click', (e) => {
					e.stopPropagation();
					void (async () => {
						await service.deleteBookRecords(book.title);
						renderBookList(rangeKey);
					})();
				});
			}
		}
		toggleButtons.forEach((btn, i) => {
			btn.addEventListener('click', () => {
				activeRange = ranges[i]!.key;
				toggleButtons.forEach((b, j) => b.toggleClass('dashboard-reading-stats-range-btn--active', j === i));
				renderBookList(activeRange);
			});
		});
		renderBookList(activeRange);

		// Recent records card
		const recentRecords = service.getRecentRecords(10);
		if (recentRecords.length > 0) {
			const recentCard = content.createDiv({ cls: 'dashboard-reading-stats-card' });
			recentCard.createDiv({ cls: 'dashboard-reading-stats-card-title', text: t('reading.recentRecords') });
			for (const rec of recentRecords) {
				const row = recentCard.createDiv({ cls: 'dashboard-reading-stats-record' });
				const ts = new Date(rec.timestamp);
				const dateText = `${ts.getMonth() + 1}/${ts.getDate()} ${String(ts.getHours()).padStart(2, '0')}:${String(ts.getMinutes()).padStart(2, '0')}`;
				row.createDiv({ cls: 'dashboard-reading-stats-record-date', text: dateText });
				row.createDiv({ cls: 'dashboard-reading-stats-record-book', text: rec.bookTitle });
				row.createDiv({ cls: 'dashboard-reading-stats-record-dur', text: formatReadingDuration(rec.durationSeconds) });
				const del = row.createDiv({ cls: 'dashboard-reading-stats-record-del' });
				setIcon(del, 'trash-2');
				del.addEventListener('click', (e) => {
					e.stopPropagation();
					void (async () => {
						await service.deleteRecord(rec.timestamp);
						renderContent();
					})();
				});
			}
		}
	}

	renderContent();
}
