import { moment, Notice, TFile } from 'obsidian';
import type { App } from 'obsidian';
import type DashboardPlugin from './main';
import type { DashboardData, DashboardCard } from './types';
import type { SyncEngine } from '../data/sync';
import { showConfirmDialog } from '../components/confirm-dialog';
import { archiveCompleted, serializeTasksForNote } from '../components/task-tree';
import { getDailyNotesPlugin, prependAfterFrontmatter } from './view-utils';
import { t } from '../utils/i18n';

// ---------------------------------------------------------------------------
// File drop handler
// ---------------------------------------------------------------------------

export function handleFileDrop(data: DashboardData | null, sync: SyncEngine, cardId: string, filePath: string): void {
	if (!data) return;
	let sectionType = 'projects';
	let cardType = 'generic';
	for (const col of data.columns) {
		const card = col.cards.find(c => c.id === cardId);
		if (card) {
			sectionType = col.sectionType ?? col.name.toLowerCase();
			cardType = card.type;
			break;
		}
	}
	if (cardType === 'weather' || cardType === 'tracker') return;
	if (cardType === 'task' || sectionType === 'todo') {
		void sync.addTask(cardId, `[[${filePath}]]`);
	} else if (sectionType === 'memo') {
		void sync.addFileLinkToMemo(cardId, filePath);
	} else {
		void sync.addDocToCard(cardId, filePath);
	}
}

// ---------------------------------------------------------------------------
// Ensure folder exists
// ---------------------------------------------------------------------------

export async function ensureFolder(app: App, folderPath: string): Promise<void> {
	const adapter = app.vault.adapter;
	const parts = folderPath.split('/').map(p => p.trim()).filter(Boolean);
	let current = '';
	for (const part of parts) {
		current = current ? `${current}/${part}` : part;
		if (!(await adapter.exists(current))) {
			await adapter.mkdir(current);
		}
	}
}

// ---------------------------------------------------------------------------
// Save memo as note
// ---------------------------------------------------------------------------

export async function saveMemoAsNote(app: App, plugin: DashboardPlugin, card: DashboardCard): Promise<void> {
	try {
		const now = new Date();
		const title = card.title?.trim() || t('notice.memoUntitled');
		const pad = (n: number) => String(n).padStart(2, '0');
		const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
		const iso = now.toISOString();

		const safeTitle = title.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim() || t('notice.memoUntitled');
		const fileName = `${safeTitle}-${ts}.md`;

		const folder = plugin.settings.memoSavePath.trim().replace(/^\/+|\/+$/g, '');
		const fullPath = folder ? `${folder}/${fileName}` : fileName;

		const frontmatter = [
			'---',
			`title: "${title.replace(/"/g, '\\"')}"`,
			`created: "${iso}"`,
			'source: obsidian-dashboard',
			'---',
			'',
		].join('\n');

		const sections: string[] = [frontmatter];
		if (card.blockquote && card.blockquote.trim()) {
			const quoteLines = card.blockquote.split('\n').map(l => `> ${l}`);
			sections.push(quoteLines.join('\n'));
		}
		if (card.body && card.body.trim()) {
			sections.push(card.body);
		}
		const content = sections.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';

		if (folder) {
			await ensureFolder(app, folder);
		}

		await app.vault.adapter.write(fullPath, content);
		new Notice(t('notice.memoSaved', { path: fullPath }), 4000);
	} catch (err) {
		console.error('[Dashboard] saveMemoAsNote failed:', err);
		new Notice(t('notice.memoSaveError'), 4000);
	}
}

// ---------------------------------------------------------------------------
// Save tasks to daily note
// ---------------------------------------------------------------------------

export async function saveTasksToDaily(app: App, plugin: DashboardPlugin, card: DashboardCard): Promise<void> {
	try {
		if (!card.tasks || card.tasks.length === 0) {
			new Notice(t('notice.noTasksToSave'));
			return;
		}

		const dailyPlugin = getDailyNotesPlugin(app);
		const options = dailyPlugin?.instance?.options;
		if (!dailyPlugin?.enabled || !options) {
			new Notice(t('notice.dailyNotesDisabled'), 5000);
			return;
		}

		const folder = (options.folder || '').trim().replace(/^\/+|\/+$/g, '');
		const format = options.format || 'YYYY-MM-DD';
		const dateStr = moment().format(format);
		const fileName = `${dateStr}.md`;
		const path = folder ? `${folder}/${fileName}` : fileName;

		const title = card.title?.trim() || t('notice.memoUntitled');
		const block = `### ${title}\n${serializeTasksForNote(card.tasks)}`;

		if (folder) await ensureFolder(app, folder);

		const existing = app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFile) {
			const raw = await app.vault.read(existing);
			await app.vault.modify(existing, prependAfterFrontmatter(raw, block));
		} else {
			await app.vault.adapter.write(path, `${block}\n`);
		}
		new Notice(t('notice.tasksSavedToDaily', { path }), 4000);
	} catch (err) {
		console.error('[Dashboard] saveTasksToDaily failed:', err);
		new Notice(t('notice.dailySaveError'), 4000);
	}
}

// ---------------------------------------------------------------------------
// Archive completed tasks
// ---------------------------------------------------------------------------

export async function archiveCompletedTasks(
	app: App,
	plugin: DashboardPlugin,
	data: DashboardData | null,
	sync: SyncEngine,
	columnName: string,
): Promise<void> {
	try {
		if (!data) return;
		const column = data.columns.find((c) => c.name === columnName);
		if (!column) return;

		const now = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		const time = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

		const entries: Array<{ task: string; card: string }> = [];
		for (const card of column.cards) {
			const { archived } = archiveCompleted(card.tasks);
			if (archived.length === 0) continue;
			const cardTitle = card.title?.trim() || t('notice.memoUntitled');
			for (const item of archived) {
				entries.push({ task: item.text, card: cardTitle });
			}
		}

		if (entries.length === 0) {
			new Notice(t('notice.archiveEmpty'));
			return;
		}

		const confirmed = await showConfirmDialog(app, {
			title: t('renderer.archiveTasks'),
			message: t('notice.archiveConfirm', { count: entries.length }),
		});
		if (!confirmed) return;

		const configured = plugin.settings.taskArchivePath.trim().replace(/^\/+|\/+$/g, '');
		const fullPath = configured || t('settings.defaultArchivePath');
		const slash = fullPath.lastIndexOf('/');
		const folder = slash >= 0 ? fullPath.slice(0, slash) : '';
		if (folder) await ensureFolder(app, folder);

		const lines = entries.map((e) => t('notice.archiveLine', { time, task: e.task, card: e.card }));
		const appendText = `${lines.join('\n')}\n`;

		const existing = app.vault.getAbstractFileByPath(fullPath);
		if (existing instanceof TFile) {
			const raw = await app.vault.read(existing);
			const sep = raw.endsWith('\n') ? '' : '\n';
			await app.vault.modify(existing, `${raw}${sep}${appendText}`);
		} else {
			await app.vault.adapter.write(fullPath, appendText);
		}

		await sync.archiveTasks(columnName);

		new Notice(t('notice.archived', { count: entries.length, path: fullPath }), 4000);
	} catch (err) {
		console.error('[Dashboard] archiveCompletedTasks failed:', err);
		new Notice(t('notice.archiveError'), 4000);
	}
}
