# 设置界面 UI 重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构设置界面，通过分组、标题、左对齐和间距优化来改善视觉层次

**Architecture:** 将设置项重新组织为5个分组（基本设置、路径设置、功能设置、Widget设置、其他设置），每个分组使用明确的标题，所有设置项左对齐，通过CSS样式增强视觉层次

**Tech Stack:** TypeScript, Obsidian API, CSS

---

## 文件结构

### 需要修改的文件
1. `src/utils/i18n/en.ts` - 添加英文翻译键
2. `src/utils/i18n/zh.ts` - 添加中文翻译键
3. `src/core/settings.ts` - 重构设置界面结构
4. `src/styles/components/sidebar.css` - 添加新的 CSS 样式

### 不需要修改的文件
- `src/core/types.ts` - 设置类型定义保持不变
- `src/core/main.ts` - 插件入口保持不变
- 其他服务文件 - 不受影响

---

## Task 1: 添加国际化翻译键

**Files:**
- Modify: `src/utils/i18n/en.ts`
- Modify: `src/utils/i18n/zh.ts`

- [ ] **Step 1: 在英文翻译文件中添加新的翻译键**

在 `src/utils/i18n/en.ts` 文件的 Settings 部分添加以下翻译键：

```typescript
// 在 'settings.languageZh': 'English', 之后添加
'settings.basicSettings': 'Basic Settings',
'settings.pathSettings': 'Path Settings',
'settings.functionSettings': 'Function Settings',
'settings.otherSettings': 'Other Settings',
```

- [ ] **Step 2: 在中文翻译文件中添加新的翻译键**

在 `src/utils/i18n/zh.ts` 文件的 Settings 部分添加以下翻译键：

```typescript
// 在 'settings.languageZh': '中文', 之后添加
'settings.basicSettings': '基本设置',
'settings.pathSettings': '路径设置',
'settings.functionSettings': '功能设置',
'settings.otherSettings': '其他设置',
```

- [ ] **Step 3: 验证翻译键已添加**

运行以下命令检查翻译文件是否有语法错误：

```bash
npm run build
```

Expected: 构建成功，没有错误

- [ ] **Step 4: 提交翻译键更改**

```bash
git add src/utils/i18n/en.ts src/utils/i18n/zh.ts
git commit -m "feat(i18n): 添加设置界面分组标题翻译键"
```

---

## Task 2: 添加 CSS 样式

**Files:**
- Modify: `src/styles/components/sidebar.css`

- [ ] **Step 1: 在 sidebar.css 中添加分组容器样式**

在 `src/styles/components/sidebar.css` 文件的末尾添加以下样式：

```css
/* ===== Settings Groups ===== */
.settings-group {
  margin-bottom: 24px;
}

.settings-group:last-child {
  margin-bottom: 0;
}

/* 分组标题样式 */
.settings-group .setting-item-heading {
  font-size: 1.1em;
  font-weight: 600;
  color: var(--text-normal);
  border-bottom: 1px solid var(--background-modifier-border);
  padding-bottom: 12px;
  margin-bottom: 12px;
}

/* 设置项样式 */
.settings-group .setting-item {
  margin-bottom: 8px;
}

.settings-group .setting-item:last-child {
  margin-bottom: 0;
}

/* Widget 设置卡片样式优化 */
.dashboard-widget-settings-card {
  border: 1px solid var(--background-modifier-border);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}

.dashboard-widget-settings-card:last-child {
  margin-bottom: 0;
}

.dashboard-widget-settings-card > .setting-item:first-child {
  padding-top: 0;
}

.dashboard-widget-settings-card > .setting-item:last-child {
  padding-bottom: 0;
}
```

- [ ] **Step 2: 验证 CSS 样式**

运行以下命令检查 CSS 文件是否有语法错误：

```bash
npm run build
```

Expected: 构建成功，没有错误

- [ ] **Step 3: 提交 CSS 样式更改**

```bash
git add src/styles/components/sidebar.css
git commit -m "feat(styles): 添加设置界面分组样式"
```

---

## Task 3: 重构设置界面结构

**Files:**
- Modify: `src/core/settings.ts`

- [ ] **Step 1: 创建 renderBasicSettings 方法**

在 `src/core/settings.ts` 文件中，在 `display()` 方法之后添加以下方法：

```typescript
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
```

- [ ] **Step 2: 创建 renderPathSettings 方法**

在 `src/core/settings.ts` 文件中，在 `renderBasicSettings` 方法之后添加以下方法：

```typescript
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
```

- [ ] **Step 3: 创建 renderFunctionSettings 方法**

在 `src/core/settings.ts` 文件中，在 `renderPathSettings` 方法之后添加以下方法：

```typescript
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
```

- [ ] **Step 4: 创建 renderOtherSettings 方法**

在 `src/core/settings.ts` 文件中，在 `renderFunctionSettings` 方法之后添加以下方法：

```typescript
private renderOtherSettings(containerEl: HTMLElement): void {
  const group = containerEl.createDiv({ cls: 'settings-group' });
  new Setting(group).setName(t('settings.otherSettings')).setHeading();

  this.renderLunarSettings(group);
  this.renderResetSection(group);
}
```

- [ ] **Step 5: 修改 renderWidgetSettings 方法**

修改 `src/core/settings.ts` 文件中的 `renderWidgetSettings` 方法，使其接受一个容器参数：

```typescript
private renderWidgetSettings(containerEl: HTMLElement): void {
  const group = containerEl.createDiv({ cls: 'settings-group' });
  new Setting(group).setName(t('settings.widgetTheme')).setHeading();

  // --- Weather card ---
  const weatherCard = group.createDiv({ cls: 'dashboard-widget-settings-card' });
  new Setting(weatherCard)
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
    new Setting(weatherCard)
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

  // --- Pomodoro card ---
  const pomodoroCard = group.createDiv({ cls: 'dashboard-widget-settings-card' });
  new Setting(pomodoroCard)
    .setName(t('settings.pomodoroEnabled'))
    .setDesc(t('settings.pomodoroEnabledDesc'))
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

  if (this.plugin.settings.pomodoroEnabled) {
    const workSetting = new Setting(pomodoroCard)
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

    const shortSetting = new Setting(pomodoroCard)
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

    const longSetting = new Setting(pomodoroCard)
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

    const intervalSetting = new Setting(pomodoroCard)
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

    new Setting(pomodoroCard)
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

    new Setting(pomodoroCard)
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

  // --- Countdown card ---
  const countdownCard = group.createDiv({ cls: 'dashboard-widget-settings-card' });
  new Setting(countdownCard)
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
    this.renderCountdownList(countdownCard);
  }

  // --- Reading card ---
  const readingCard = group.createDiv({ cls: 'dashboard-widget-settings-card' });
  new Setting(readingCard)
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
    new Setting(readingCard)
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
```

- [ ] **Step 6: 修改 renderLunarSettings 方法**

修改 `src/core/settings.ts` 文件中的 `renderLunarSettings` 方法，使其接受一个容器参数：

```typescript
private renderLunarSettings(containerEl: HTMLElement): void {
  const lunarCard = containerEl.createDiv({ cls: 'dashboard-widget-settings-card' });
  new Setting(lunarCard)
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
```

- [ ] **Step 7: 修改 renderResetSection 方法**

修改 `src/core/settings.ts` 文件中的 `renderResetSection` 方法，使其接受一个容器参数：

```typescript
private renderResetSection(containerEl: HTMLElement): void {
  const resetCard = containerEl.createDiv({ cls: 'dashboard-widget-settings-card' });
  new Setting(resetCard)
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
```

- [ ] **Step 8: 修改 display 方法**

修改 `src/core/settings.ts` 文件中的 `display` 方法，使用新的分组方法：

```typescript
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
```

- [ ] **Step 9: 验证重构后的设置界面**

运行以下命令检查 TypeScript 文件是否有语法错误：

```bash
npm run build
```

Expected: 构建成功，没有错误

- [ ] **Step 10: 提交设置界面重构**

```bash
git add src/core/settings.ts
git commit -m "refactor(settings): 重构设置界面结构，添加分组和标题"
```

---

## Task 4: 测试和验证

**Files:**
- Test: 手动测试设置界面

- [ ] **Step 1: 启动开发模式**

运行以下命令启动开发模式：

```bash
npm run dev
```

- [ ] **Step 2: 测试设置界面**

1. 在 Obsidian 中打开设置界面
2. 验证设置项是否按分组显示
3. 验证分组标题是否正确显示
4. 验证所有设置项是否正常工作
5. 验证设置的保存和加载功能
6. 验证在不同主题下的显示效果

- [ ] **Step 3: 提交最终更改**

```bash
git add .
git commit -m "feat(settings): 完成设置界面 UI 重构"
```

---

## 总结

本实施计划通过4个任务完成了设置界面的UI重构：

1. **Task 1**：添加国际化翻译键
2. **Task 2**：添加 CSS 样式
3. **Task 3**：重构设置界面结构
4. **Task 4**：测试和验证

每个任务都包含详细的步骤和代码示例，确保实施过程清晰可控。实施完成后，设置界面将具有更好的视觉层次和用户体验。
