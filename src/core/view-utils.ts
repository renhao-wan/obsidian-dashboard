import type { App } from 'obsidian';

export const DASHBOARD_VIEW_TYPE = 'obsidian-dashboard-view';

interface DailyNotesOptions {
	folder?: string;
	format?: string;
}

interface DailyNotesPlugin {
	enabled?: boolean;
	instance?: { options?: DailyNotesOptions };
}

/** Read the core "Daily notes" plugin handle (folder/format live on instance.options). */
export function getDailyNotesPlugin(app: App): DailyNotesPlugin | undefined {
	const internalPlugins = (app as unknown as {
		internalPlugins?: { getPluginById?: (id: string) => DailyNotesPlugin | undefined };
	}).internalPlugins;
	return internalPlugins?.getPluginById?.('daily-notes');
}

/** Insert `block` right after the YAML frontmatter (or at the very top when there
 *  is none), preserving the original frontmatter text verbatim. */
export function prependAfterFrontmatter(md: string, block: string): string {
	const fmMatch = md.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
	if (fmMatch) {
		const header = fmMatch[0];
		const body = md.slice(header.length).replace(/^\s+/, '');
		return body ? `${header}${block}\n\n${body}` : `${header}${block}\n`;
	}
	const body = md.replace(/^\s+/, '');
	return body ? `${block}\n\n${body}` : `${block}\n`;
}
