# 设置界面 UI 重构设计文档

## 项目概述

**项目名称**：Obsidian Dashboard 插件设置界面重构
**日期**：2026-07-23
**目标**：重新设计设置界面的展示和排版，改善视觉层次，提升用户体验

## 设计目标

### 主要问题
当前设置界面存在以下问题：
1. 所有设置项平铺排列，缺乏分组
2. 视觉层次不清晰，标题、描述、控件之间缺乏视觉区分
3. Widget 设置太长，占用了太多空间
4. 整体排版太紧凑，设置项之间的间距不够

### 设计目标
1. **排版优化**：通过调整布局、间距、对齐方式来改善视觉层次
2. **左对齐**：所有设置项的名称和控件都左对齐，形成清晰的单列布局
3. **标题分组**：使用明确的标题来区分不同的设置区域
4. **结构清晰**：将设置项重新组织为有意义的分组，便于用户快速找到所需设置

## 当前状态分析

### 现有设置项
1. 语言选择
2. 样式预设（主题）
3. 最近文档数量
4. Dashboard 文件路径
5. Memo 保存路径
6. 任务归档路径
7. 禁用笔记弹窗
8. Widget 设置（天气、番茄钟、倒计时、阅读）
9. 农历设置
10. 重置设置

### 现有代码结构
- **入口文件**：`src/core/settings.ts`
- **样式文件**：`src/styles/components/sidebar.css`（包含 `dashboard-widget-settings-card` 样式）
- **使用组件**：Obsidian 原生的 `PluginSettingTab` 和 `Setting` 组件

## 设计方案

### 1. 设置分组结构

将当前平铺的设置项重新组织为以下分组：

```
┌─────────────────────────────────────────────┐
│ 基本设置                                      │
├─────────────────────────────────────────────┤
│ 语言选择                                      │
│ 样式预设（主题）                               │
│ 最近文档数量                                  │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 路径设置                                      │
├─────────────────────────────────────────────┤
│ Dashboard 文件路径                            │
│ Memo 保存路径                                 │
│ 任务归档路径                                  │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 功能设置                                      │
├─────────────────────────────────────────────┤
│ 禁用笔记弹窗                                  │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Widget 设置                                   │
├─────────────────────────────────────────────┤
│ 天气 Widget（启用/城市）                       │
│ 番茄钟 Widget（启用/时长/休息/声音）            │
│ 倒计时 Widget（启用/列表）                     │
│ 阅读 Widget（启用/声音）                       │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 其他设置                                      │
├─────────────────────────────────────────────┤
│ 农历 Widget                                   │
│ 重置设置                                      │
└─────────────────────────────────────────────┘
```

### 2. 视觉层次设计

#### 标题样式
- 分组标题：使用 `setHeading()` 方法，样式为：
  - 字号：1.1em
  - 字体粗细：600
  - 颜色：`var(--text-normal)`
  - 底部边框：1px solid `var(--background-modifier-border)`
  - 内边距：8px 0 12px 0

#### 设置项样式
- 左对齐：设置项名称和控件都左对齐
- 间距：
  - 设置项之间：8px
  - 分组之间：24px
  - 分组标题与内容：12px
- 描述文本：使用 `setDesc()` 方法，样式为：
  - 字号：0.85em
  - 颜色：`var(--text-muted)`
  - 上边距：4px

#### Widget 设置卡片
- 保持当前的卡片样式，但优化：
  - 卡片内边距：12px
  - 卡片间距：12px
  - 卡片边框：1px solid `var(--background-modifier-border)`
  - 卡片圆角：8px

### 3. 设置项排列顺序

每个分组内的设置项按以下顺序排列：

**基本设置**
1. 语言选择
2. 样式预设（主题）
3. 最近文档数量

**路径设置**
1. Dashboard 文件路径
2. Memo 保存路径
3. 任务归档路径

**功能设置**
1. 禁用笔记弹窗

**Widget 设置**
1. 天气 Widget
   - 启用开关
   - 城市设置（仅在启用时显示）
2. 番茄钟 Widget
   - 启用开关
   - 工作时长（仅在启用时显示）
   - 短休息时长（仅在启用时显示）
   - 长休息时长（仅在启用时显示）
   - 长休息间隔（仅在启用时显示）
   - 自动开始休息（仅在启用时显示）
   - 声音（仅在启用时显示）
3. 倒计时 Widget
   - 启用开关
   - 倒计时列表（仅在启用时显示）
4. 阅读 Widget
   - 启用开关
   - 声音（仅在启用时显示）

**其他设置**
1. 农历 Widget
2. 重置设置

## 实现细节

### 1. TypeScript 代码结构调整

```typescript
display(): void {
  const { containerEl } = this;
  containerEl.empty();

  // 基本设置
  this.renderBasicSettings(containerEl);

  // 路径设置
  this.renderPathSettings(containerEl);

  // 功能设置
  this.renderFunctionSettings(containerEl);

  // Widget 设置
  this.renderWidgetSettings(containerEl);

  // 其他设置
  this.renderOtherSettings(containerEl);

  // 页脚
  containerEl.createDiv({ cls: 'dashboard-settings-footer', text: "crafted by Pandora's Digital Garden" });
}

private renderBasicSettings(containerEl: HTMLElement): void {
  const group = containerEl.createDiv({ cls: 'settings-group' });
  new Setting(group).setName(t('settings.basicSettings')).setHeading();

  // 语言选择
  new Setting(group)
    .setName(t('settings.language'))
    .setDesc(t('settings.languageDesc'))
    .addDropdown(...);

  // 样式预设
  new Setting(group)
    .setName(t('settings.stylePreset'))
    .setDesc(t('settings.stylePresetDesc'))
    .addDropdown(...);

  // 最近文档数量
  new Setting(group)
    .setName(t('settings.recentCount'))
    .setDesc(t('settings.recentCountDesc'))
    .addSlider(...);
}

private renderPathSettings(containerEl: HTMLElement): void {
  const group = containerEl.createDiv({ cls: 'settings-group' });
  new Setting(group).setName(t('settings.pathSettings')).setHeading();

  // Dashboard 文件路径
  new Setting(group)
    .setName(t('settings.dashboardFile'))
    .setDesc(t('settings.dashboardFileDesc'))
    .addText(...);

  // Memo 保存路径
  new Setting(group)
    .setName(t('settings.memoSavePath'))
    .setDesc(t('settings.memoSavePathDesc'))
    .addText(...);

  // 任务归档路径
  new Setting(group)
    .setName(t('settings.taskArchivePath'))
    .setDesc(t('settings.taskArchivePathDesc'))
    .addText(...);
}

private renderFunctionSettings(containerEl: HTMLElement): void {
  const group = containerEl.createDiv({ cls: 'settings-group' });
  new Setting(group).setName(t('settings.functionSettings')).setHeading();

  // 禁用笔记弹窗
  new Setting(group)
    .setName(t('settings.disableNotePopover'))
    .setDesc(t('settings.disableNotePopoverDesc'))
    .addToggle(...);
}

private renderWidgetSettings(containerEl: HTMLElement): void {
  const group = containerEl.createDiv({ cls: 'settings-group' });
  new Setting(group).setName(t('settings.widgetTheme')).setHeading();

  // 天气 Widget
  this.renderWeatherWidget(group);

  // 番茄钟 Widget
  this.renderPomodoroWidget(group);

  // 倒计时 Widget
  this.renderCountdownWidget(group);

  // 阅读 Widget
  this.renderReadingWidget(group);
}

private renderOtherSettings(containerEl: HTMLElement): void {
  const group = containerEl.createDiv({ cls: 'settings-group' });
  new Setting(group).setName(t('settings.otherSettings')).setHeading();

  // 农历 Widget
  this.renderLunarSettings(group);

  // 重置设置
  this.renderResetSection(group);
}
```

### 2. CSS 样式调整

```css
/* 分组容器 */
.settings-group {
  margin-bottom: 24px;
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

/* Widget 设置卡片 */
.dashboard-widget-settings-card {
  border: 1px solid var(--background-modifier-border);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}
```

## 国际化需求

需要在 `src/utils/i18n.ts` 中添加以下文本：

```typescript
// 英文
'settings.basicSettings': 'Basic Settings',
'settings.pathSettings': 'Path Settings',
'settings.functionSettings': 'Function Settings',
'settings.otherSettings': 'Other Settings',

// 中文
'settings.basicSettings': '基本设置',
'settings.pathSettings': '路径设置',
'settings.functionSettings': '功能设置',
'settings.otherSettings': '其他设置',
```

## 测试计划

### 功能测试
1. 验证所有设置项都能正常工作
2. 验证设置的保存和加载功能
3. 验证设置更改后的实时预览效果
4. 验证重置设置功能

### 视觉测试
1. 验证分组标题的显示效果
2. 验证左对齐的布局效果
3. 验证间距和边距的视觉效果
4. 验证在不同主题下的显示效果
5. 验证在移动端的显示效果

### 兼容性测试
1. 验证在不同 Obsidian 版本下的兼容性
2. 验证在不同操作系统下的兼容性
3. 验证在不同屏幕尺寸下的兼容性

## 文件变更

### 需要修改的文件
1. `src/core/settings.ts` - 重构设置界面结构
2. `src/styles/components/sidebar.css` - 添加新的 CSS 样式
3. `src/utils/i18n.ts` - 添加国际化文本

### 不需要修改的文件
1. `src/core/types.ts` - 设置类型定义保持不变
2. `src/core/main.ts` - 插件入口保持不变
3. 其他服务文件 - 不受影响

## 风险评估

### 低风险
- CSS 样式调整：纯样式变更，不影响功能
- 国际化文本添加：新增文本，不影响现有功能

### 中风险
- TypeScript 代码重构：需要仔细测试，确保所有设置项都能正常工作
- Widget 设置卡片重构：需要确保条件显示逻辑正确

### 缓解措施
1. 在修改前备份当前代码
2. 逐步重构，每个分组完成后进行测试
3. 使用版本控制，便于回滚

## 时间估算

- **设计文档**：已完成
- **代码实现**：约2-3小时
  - TypeScript 代码重构：1-2小时
  - CSS 样式调整：30分钟
  - 国际化文本添加：15分钟
  - 测试和调试：30-45分钟
- **总时间**：约2-3小时

## 总结

本设计方案通过重构设置界面的结构和排版，解决了当前设置界面视觉层次不清晰的问题。主要改进包括：

1. **分组组织**：将设置项重新组织为5个有意义的分组
2. **标题分组**：使用明确的标题来区分不同的设置区域
3. **左对齐**：所有设置项都左对齐，形成清晰的单列布局
4. **视觉层次**：通过标题样式、间距、边框等元素来增强视觉层次
5. **结构清晰**：每个设置项都有明确的归属，便于用户快速找到所需设置

该设计方案保持了现有功能的完整性，只改变了展示方式，风险较低，可以安全实施。
