/**
 * Shared utilities for timer-based services (Pomodoro, Reading).
 */

/** Format a Date as 'YYYY-MM-DD' in local timezone. */
export function formatDate(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

/**
 * Calculate a consecutive-day streak ending today (or yesterday if today has
 * no entries yet. `dates` must be sorted descending (newest first).
 */
export function calcStreak(dates: string[]): number {
	if (dates.length === 0) return 0;

	let streak = 0;
	let expected = formatDate(new Date());

	// If today has no entries yet, start checking from yesterday
	if (dates[0] !== expected) {
		const d = new Date();
		d.setDate(d.getDate() - 1);
		expected = formatDate(d);
	}

	for (const date of dates) {
		if (date === expected) {
			streak++;
			const d = new Date(expected + 'T00:00:00');
			d.setDate(d.getDate() - 1);
			expected = formatDate(d);
		} else if (date < expected) {
			break;
		}
	}

	return streak;
}

/** Timer mixin for services that need a periodic tick interval. */
export interface TickController {
	tickInterval: number | null;
	ensureTickInterval(tick: () => void): void;
	clearTickInterval(): void;
}

export function createTickController(): TickController {
	return {
		tickInterval: null,
		ensureTickInterval(tick: () => void) {
			if (this.tickInterval) return;
			this.tickInterval = window.setInterval(tick, 1000);
		},
		clearTickInterval() {
			if (this.tickInterval) {
				window.clearInterval(this.tickInterval);
				this.tickInterval = null;
			}
		},
	};
}
