import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type DashboardPlugin from './main';
import { DEFAULT_SETTINGS, type DashboardSettings, type CountdownConfig } from './types';
import { t, setLanguage, type Language } from '../utils/i18n';
import { geocodeCity } from '../services/weather';
import { CountdownSettingsModal } from '../modals/countdown';
import { showConfirmDialog } from '../components/confirm-dialog';

export type { DashboardSettings };

export class DashboardSettingTab extends PluginSettingTab {
	plugin: DashboardPlugin;

	constructor(app: App, plugin: DashboardPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.renderBasicSettings(containerEl);
		this.renderPathSettings(containerEl);
		this.renderFunctionSettings(containerEl);
		this.renderWidgetSettings(containerEl);
		this.renderOtherSettings(containerEl);

		containerEl.createDiv({ cls: 'dashboard-settings-footer', text: "crafted by Pandora's Digital Garden" });
	}

	private renderBasicSettings(containerEl: HTMLElement): void {
		const group = containerEl.createDiv({ cls: 'settings-group' });
		new Setting(group).setName(t('settings.basicSettings')).setHeading();

		new Setting(group)
			.setName(t('settings.language'))
			.setDesc(t('settings.languageDesc'))
			.addDropdown(dropdown => dropdown
				.addOptions({
					en: t('settings.languageEn'),
					zh: t('settings.languageZh'),
				})
				.setValue(this.plugin.settings.language)
				.onChange(async (value) => {
					const lang = value as Language;
					this.plugin.settings = {
						...this.plugin.settings,
						language: lang,
					};
					setLanguage(lang);
					await this.plugin.saveSettings();
					this.display();
					await this.plugin.updateDashboardDefaultContent();
					this.plugin.refreshAllDashboards();
				}));

		new Setting(group)
			.setName(t('settings.stylePreset'))
			.setDesc(t('settings.stylePresetDesc'))
			.addDropdown(dropdown => dropdown
				.addOptions({
					earth: t('settings.styleEarth'),
					nordic: t('settings.styleNordic'),
					aurora: t('settings.styleAurora'),
					island: t('settings.styleIsland'),
					tundra: t('settings.styleTundra'),
					blossom: t('settings.styleBlossom'),
					matcha: t('settings.styleMatcha'),
					lilac: t('settings.styleLilac'),
					haze: t('settings.styleHaze'),
					jade: t('settings.styleJade'),
					carbon: t('settings.styleCarbon'),
					onyx: t('settings.styleOnyx'),
					mono: t('settings.styleMono'),
				})
				.setValue(this.plugin.settings.stylePreset)
				.onChange(async (value) => {
					this.plugin.settings = {
						...this.plugin.settings,
						stylePreset: value,
					};
					await this.plugin.saveSettings();
					this.plugin.refreshAllDashboards();
				}));

		const recentSetting = new Setting(group)
			.setName(t('settings.recentCount') + '  ' + this.plugin.settings.recentDocCount)
			.setDesc(t('settings.recentCountDesc'))
			.addSlider(slider => slider
				.setLimits(3, 15, 1)
				.setValue(this.plugin.settings.recentDocCount)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings = {
						...this.plugin.settings,
						recentDocCount: value,
					};
					await this.plugin.saveSettings();
					recentSetting.nameEl.setText(t('settings.recentCount') + '  ' + value);
				}));
	}

	private renderPathSettings(containerEl: HTMLElement): void {
		const group = containerEl.createDiv({ cls: 'settings-group' });
		new Setting(group).setName(t('settings.pathSettings')).setHeading();

		new Setting(group)
			.setName(t('settings.dashboardFile'))
			.setDesc(t('settings.dashboardFileDesc'))
			.addText(text => text
				.setPlaceholder('.dashboard/dashboard')
				.setValue(this.plugin.settings.dashboardFile)
				.onChange(async (value) => {
					this.plugin.settings = {
						...this.plugin.settings,
						dashboardFile: value.trim().replace(/^\.\//, '') || DEFAULT_SETTINGS.dashboardFile,
					};
					await this.plugin.saveSettings();
				}));

		new Setting(group)
			.setName(t('settings.memoSavePath'))
			.setDesc(t('settings.memoSavePathDesc'))
			.addText(text => text
				.setPlaceholder('.dashboard/memo')
				.setValue(this.plugin.settings.memoSavePath)
				.onChange(async (value) => {
					this.plugin.settings = {
						...this.plugin.settings,
						memoSavePath: value.trim().replace(/^\.\//, ''),
					};
					await this.plugin.saveSettings();
				}));

		new Setting(group)
			.setName(t('settings.taskArchivePath'))
			.setDesc(t('settings.taskArchivePathDesc'))
			.addText(text => text
				.setPlaceholder('.dashboard/archive')
				.setValue(this.plugin.settings.taskArchivePath)
				.onChange(async (value) => {
					this.plugin.settings = {
						...this.plugin.settings,
						taskArchivePath: value.trim().replace(/^\.\//, ''),
					};
					await this.plugin.saveSettings();
				}));
	}

	private renderFunctionSettings(containerEl: HTMLElement): void {
		const group = containerEl.createDiv({ cls: 'settings-group' });
		new Setting(group).setName(t('settings.functionSettings')).setHeading();

		new Setting(group)
			.setName(t('settings.disableNotePopover'))
			.setDesc(t('settings.disableNotePopoverDesc'))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.disableNotePopover)
				.onChange(async (value) => {
					this.plugin.settings = { ...this.plugin.settings, disableNotePopover: value };
					await this.plugin.saveSettings();
				}));
	}

	private renderOtherSettings(containerEl: HTMLElement): void {
		const group = containerEl.createDiv({ cls: 'settings-group' });
		new Setting(group).setName(t('settings.otherSettings')).setHeading();

		this.renderLunarSettings(group);
		this.renderResetSection(group);
	}

	private renderWidgetSettings(containerEl: HTMLElement): void {
		const group = containerEl.createDiv({ cls: 'settings-group' });
		new Setting(group).setName(t('settings.widgetTheme')).setHeading();

		// --- Weather ---
		new Setting(group)
			.setName(t('settings.widgetWeatherEnabled'))
			.setDesc(t('settings.widgetWeatherEnabledDesc'))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.widgetWeatherEnabled)
				.onChange(async (value) => {
					this.plugin.settings = {
						...this.plugin.settings,
						widgetWeatherEnabled: value,
					};
					await this.plugin.saveSettings();
					this.plugin.refreshAllDashboards();
					this.display();
				}));

		if (this.plugin.settings.widgetWeatherEnabled) {
			new Setting(group)
				.setName(t('settings.widgetWeatherCity'))
				.setDesc(t('settings.widgetWeatherCityDesc'))
				.addText(text => {
					text
						.setPlaceholder(t('settings.widgetWeatherCityPlaceholder'))
						.setValue(this.plugin.settings.widgetWeatherCity)
						.onChange(async (value) => {
							this.plugin.settings = {
								...this.plugin.settings,
								widgetWeatherCity: value.trim(),
							};
							await this.plugin.saveSettings();
						});
					this.attachCitySuggest(text.inputEl);
				});
		}

		// --- Pomodoro ---
		const pomodoroPanel = group.createDiv({ cls: 'dashboard-settings-panel' });
		if (this.plugin.settings.pomodoroEnabled) {
			pomodoroPanel.addClass('is-expanded');
		}

		const pomodoroHeader = pomodoroPanel.createDiv({ cls: 'dashboard-settings-panel-header' });
		const pomodoroHeaderLeft = pomodoroHeader.createDiv({ cls: 'dashboard-settings-panel-header-left' });

		// 箭头图标
		const arrow = pomodoroHeaderLeft.createSvg('svg', {
			attr: {
				width: '16',
				height: '16',
				viewBox: '0 0 24 24',
				fill: 'none',
				stroke: 'currentColor',
				'stroke-width': '2',
				'stroke-linecap': 'round',
				'stroke-linejoin': 'round',
			},
		});
		arrow.createSvg('path', { attr: { d: 'M9 18l6-6-6-6' } });
		arrow.setAttribute('class', 'dashboard-settings-panel-arrow');

		const pomodoroTitle = pomodoroHeaderLeft.createSpan({ text: t('settings.pomodoroEnabled') });
		pomodoroTitle.className = 'dashboard-settings-panel-title';

		// 切换开关
		const pomodoroToggleContainer = pomodoroHeader.createDiv({ cls: 'dashboard-settings-panel-toggle' });
		const pomodoroToggle = new Setting(pomodoroToggleContainer)
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.pomodoroEnabled)
				.onChange(async (value) => {
					this.plugin.settings = {
						...this.plugin.settings,
						pomodoroEnabled: value,
					};
					await this.plugin.saveSettings();
					this.plugin.refreshAllDashboards();
					this.display();
				}));
		pomodoroToggle.settingEl.className = 'dashboard-settings-panel-toggle-setting';

		// 点击标题区域展开/折叠
		pomodoroHeader.addEventListener('click', (e) => {
			// 如果点击的是切换开关，不处理
			if (e.target instanceof HTMLElement && e.target.closest('.dashboard-settings-panel-toggle')) {
				return;
			}
			pomodoroPanel.toggleClass('is-expanded', !pomodoroPanel.hasClass('is-expanded'));
		});

		// 内容区域
		const pomodoroContent = pomodoroPanel.createDiv({ cls: 'dashboard-settings-panel-content' });
		const pomodoroContentInner = pomodoroContent.createDiv({ cls: 'dashboard-settings-panel-content-inner' });

		if (this.plugin.settings.pomodoroEnabled) {
			const workSetting = new Setting(pomodoroContentInner)
				.setName(t('settings.pomodoroWork') + '  ' + this.plugin.settings.pomodoroWorkMinutes + ' min')
				.addSlider(slider => slider
					.setLimits(15, 60, 5)
					.setValue(this.plugin.settings.pomodoroWorkMinutes)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings = {
							...this.plugin.settings,
							pomodoroWorkMinutes: value,
						};
						await this.plugin.saveSettings();
						workSetting.nameEl.setText(t('settings.pomodoroWork') + '  ' + value + ' min');
					}));

			const shortSetting = new Setting(pomodoroContentInner)
				.setName(t('settings.pomodoroShortBreak') + '  ' + this.plugin.settings.pomodoroShortBreakMinutes + ' min')
				.addSlider(slider => slider
					.setLimits(1, 15, 1)
					.setValue(this.plugin.settings.pomodoroShortBreakMinutes)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings = {
							...this.plugin.settings,
							pomodoroShortBreakMinutes: value,
						};
						await this.plugin.saveSettings();
						shortSetting.nameEl.setText(t('settings.pomodoroShortBreak') + '  ' + value + ' min');
					}));

			const longSetting = new Setting(pomodoroContentInner)
				.setName(t('settings.pomodoroLongBreak') + '  ' + this.plugin.settings.pomodoroLongBreakMinutes + ' min')
				.addSlider(slider => slider
					.setLimits(5, 30, 5)
					.setValue(this.plugin.settings.pomodoroLongBreakMinutes)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings = {
							...this.plugin.settings,
							pomodoroLongBreakMinutes: value,
						};
						await this.plugin.saveSettings();
						longSetting.nameEl.setText(t('settings.pomodoroLongBreak') + '  ' + value + ' min');
					}));

			const intervalSetting = new Setting(pomodoroContentInner)
				.setName(t('settings.pomodoroInterval') + '  ' + this.plugin.settings.pomodoroLongBreakInterval)
				.addSlider(slider => slider
					.setLimits(2, 6, 1)
					.setValue(this.plugin.settings.pomodoroLongBreakInterval)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings = {
							...this.plugin.settings,
							pomodoroLongBreakInterval: value,
						};
						await this.plugin.saveSettings();
						intervalSetting.nameEl.setText(t('settings.pomodoroInterval') + '  ' + value);
					}));

			new Setting(pomodoroContentInner)
				.setName(t('settings.pomodoroAutoStart'))
				.setDesc(t('settings.pomodoroAutoStartDesc'))
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.pomodoroAutoStartBreak)
					.onChange(async (value) => {
						this.plugin.settings = {
							...this.plugin.settings,
							pomodoroAutoStartBreak: value,
						};
						await this.plugin.saveSettings();
					}));

			new Setting(pomodoroContentInner)
				.setName(t('settings.pomodoroSound'))
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.pomodoroSoundEnabled)
					.onChange(async (value) => {
						this.plugin.settings = {
							...this.plugin.settings,
							pomodoroSoundEnabled: value,
						};
						await this.plugin.saveSettings();
					}));
		}

		// --- Countdown ---
		new Setting(group)
			.setName(t('settings.countdownEnabled'))
			.setDesc(t('settings.countdownEnabledDesc'))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.countdownEnabled)
				.onChange(async (value) => {
					this.plugin.settings = {
						...this.plugin.settings,
						countdownEnabled: value,
					};
					await this.plugin.saveSettings();
					this.plugin.refreshAllDashboards();
					this.display();
				}));

		if (this.plugin.settings.countdownEnabled) {
			this.renderCountdownList(group);
		}

		// --- Reading ---
		new Setting(group)
			.setName(t('settings.readingEnabled'))
			.setDesc(t('settings.readingEnabledDesc'))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.readingEnabled)
				.onChange(async (value) => {
					this.plugin.settings = {
						...this.plugin.settings,
						readingEnabled: value,
					};
					await this.plugin.saveSettings();
					this.plugin.refreshAllDashboards();
				}));

		if (this.plugin.settings.readingEnabled) {
			new Setting(group)
				.setName(t('settings.readingSound'))
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.readingSoundEnabled)
					.onChange(async (value) => {
						this.plugin.settings = {
							...this.plugin.settings,
							readingSoundEnabled: value,
						};
						await this.plugin.saveSettings();
					}));
		}
	}


	private renderCountdownList(containerEl: HTMLElement): void {
		const list = this.plugin.settings.countdowns ?? [];

		for (const cd of list) {
			const summary = cd.label || cd.targetDate || t('countdown.untitled');
			new Setting(containerEl)
				.setName(summary)
				.setDesc(cd.targetDate ? `${cd.targetDate} · ${t(`countdown.${cd.displayMode}`)}` : t('countdown.setTarget'))
				.addExtraButton(btn => btn
					.setIcon('pencil')
					.setTooltip(t('common.edit'))
					.onClick(() => this.editCountdown(cd)))
				.addExtraButton(btn => btn
					.setIcon('trash-2')
					.setTooltip(t('common.delete'))
					.onClick(async () => {
						this.plugin.settings = {
							...this.plugin.settings,
							countdowns: list.filter(c => c.id !== cd.id),
						};
						await this.plugin.saveSettings();
						this.plugin.refreshAllDashboards();
						this.display();
					}));
		}

		new Setting(containerEl)
			.addButton(btn => btn
				.setButtonText(t('countdown.add'))
				.setIcon('plus')
				.onClick(() => this.editCountdown(null)));
	}

	private editCountdown(existing: CountdownConfig | null): void {
		const baseline: CountdownConfig = existing ?? {
			id: `cd-${Date.now()}`,
			label: '',
			targetDate: '',
			displayMode: 'days',
			reminderDays: 0,
		};
		const modal = new CountdownSettingsModal(this.app, baseline, (updated) => {
			void this.applyCountdownUpdate(updated);
		});
		modal.open();
	}

	private async applyCountdownUpdate(updated: CountdownConfig): Promise<void> {
		const current = this.plugin.settings.countdowns ?? [];
		const exists = current.some(c => c.id === updated.id);
		this.plugin.settings = {
			...this.plugin.settings,
			countdowns: exists
				? current.map(c => c.id === updated.id ? updated : c)
				: [...current, updated],
		};
		await this.plugin.saveSettings();
		this.plugin.refreshAllDashboards();
		this.display();
	}

	private renderLunarSettings(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName(t('settings.widgetLunarEnabled'))
			.setDesc(t('settings.widgetLunarEnabledDesc'))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.widgetLunarEnabled)
				.onChange(async (value) => {
					this.plugin.settings = {
						...this.plugin.settings,
						widgetLunarEnabled: value,
					};
					await this.plugin.saveSettings();
					this.plugin.refreshAllDashboards();
					this.display();
				}));
	}

	private attachCitySuggest(inputEl: HTMLInputElement): void {
		let dropdown: HTMLElement | null = null;
		let debounceTimer: number | null = null;

		const close = () => {
			if (dropdown) { dropdown.remove(); dropdown = null; }
		};

		inputEl.addEventListener('input', () => {
			if (debounceTimer) window.clearTimeout(debounceTimer);
			const query = inputEl.value.trim();
			if (query.length < 2) { close(); return; }

			debounceTimer = window.setTimeout(() => {
				void this.suggestCities(inputEl, query, dropdown, close).then(next => {
					dropdown = next;
				});
			}, 300);
		});

		inputEl.addEventListener('blur', () => {
			window.setTimeout(close, 200);
		});
	}

	private async suggestCities(
		inputEl: HTMLInputElement,
		query: string,
		dropdown: HTMLElement | null,
		close: () => void,
	): Promise<HTMLElement | null> {
		const results = await geocodeCity(query);
		close();
		if (results.length === 0) return dropdown;

		const next = inputEl.ownerDocument.createElement('div');
		next.className = 'dashboard-city-suggest';
		Object.assign(next.style, {
			position: 'absolute',
			zIndex: '100',
			background: 'var(--background-secondary)',
			border: '1px solid var(--background-modifier-border)',
			borderRadius: '6px',
			boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
			maxHeight: '200px',
			overflowY: 'auto',
			width: inputEl.getBoundingClientRect().width + 'px',
		});

		const rect = inputEl.getBoundingClientRect();
		next.style.left = rect.left + 'px';
		next.style.top = (rect.bottom + 4) + 'px';

		for (const r of results) {
			const item = next.createDiv({ cls: 'dashboard-city-suggest-item' });
			const label = r.admin1 ? `${r.name}, ${r.admin1}, ${r.country}` : `${r.name}, ${r.country}`;
			item.textContent = label;
			Object.assign(item.style, {
				padding: '6px 10px',
				cursor: 'pointer',
				fontSize: '0.85em',
				borderBottom: '1px solid var(--background-modifier-border)',
			});
			item.addEventListener('mouseenter', () => {
				item.setCssProps({ background: 'var(--background-modifier-hover)' });
			});
			item.addEventListener('mouseleave', () => {
				item.setCssProps({ background: '' });
			});
			item.addEventListener('click', () => {
				void (async () => {
					inputEl.value = r.name;
					this.plugin.settings = {
						...this.plugin.settings,
						widgetWeatherCity: r.name,
						widgetWeatherLat: r.latitude,
						widgetWeatherLon: r.longitude,
					};
					await this.plugin.saveSettings();
					close();
					this.plugin.refreshAllDashboards();
				})();
			});
		}

		inputEl.ownerDocument.body.appendChild(next);
		return next;
	}

	private renderResetSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName(t('settings.resetToDefaults'))
			.setDesc(t('settings.resetToDefaultsDesc'))
			.addButton(btn => btn
				.setButtonText(t('settings.resetToDefaults'))
				.setWarning()
				.onClick(() => {
					showConfirmDialog(this.app, { title: t('settings.resetConfirm'), message: '' }).then(async (confirmed) => {
						if (confirmed) {
							this.plugin.settings = { ...DEFAULT_SETTINGS };
							await this.plugin.saveSettings();
							new Notice(t('settings.resetDone'));
							this.display();
							this.plugin.refreshAllDashboards();
						}
					}).catch(console.error);
				}));
	}
}
