import { App, Modal } from 'obsidian';
import { t } from './i18n';

export class ConfirmModal extends Modal {
	private message: string;
	private onConfirm: () => void;

	constructor(app: App, message: string, onConfirm: () => void) {
		super(app);
		this.message = message;
		this.onConfirm = onConfirm;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass('dashboard-modal');

		contentEl.createEl('p', { text: this.message, cls: 'dashboard-confirm-message' });

		const actions = contentEl.createDiv({ cls: 'dashboard-modal-actions' });
		const confirmBtn = actions.createEl('button', { text: t('common.confirm'), cls: 'mod-warning' });
		confirmBtn.addEventListener('click', () => {
			this.onConfirm();
			this.close();
		});

		const cancelBtn = actions.createEl('button', { text: t('common.cancel') });
		cancelBtn.addEventListener('click', () => this.close());
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
