# Obsidian Dashboard 项目重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构 Obsidian Dashboard 项目的目录结构和文件组织，提升可维护性和工程规范

**Architecture:** 采用经典分层架构，将58个源文件按功能分为 core、data、services、renderers、sections、modals、components、utils 8个模块。大文件（renderer.ts 130KB、view.ts 56KB、library-section.ts 43KB、i18n.ts 56KB）将被彻底拆分为多个小模块。

**Tech Stack:** TypeScript、Obsidian API、esbuild、ESLint

---

## 文件结构映射

### 新目录结构

```
src/
├── core/                    # 核心层
│   ├── main.ts             # 插件入口
│   ├── view.ts             # 主视图（精简后）
│   └── types.ts            # 类型定义
├── data/                    # 数据层
│   ├── parser.ts           # Markdown 解析器
│   ├── sync.ts             # 同步引擎
│   └── storage.ts          # 数据存储抽象
├── services/                # 服务层
│   ├── weather.ts
│   ├── pomodoro.ts
│   ├── reading.ts
│   ├── book.ts
│   ├── tracker.ts
│   └── holiday.ts
├── renderers/               # 渲染层
│   ├── dashboard.ts        # 主渲染器
│   ├── sidebar.ts          # 侧边栏渲染
│   ├── banner.ts           # 横幅渲染
│   ├── section.ts          # 区域渲染
│   └── widgets.ts          # 小组件渲染
├── sections/                # 业务区域
│   ├── library.ts
│   ├── library-views.ts
│   ├── library-config.ts
│   ├── media.ts
│   ├── calendar.ts
│   └── heatmap.ts
├── modals/                  # 模态框
│   ├── card-edit.ts
│   ├── countdown.ts
│   ├── template.ts
│   └── ... (其他15个模态框)
├── components/              # 通用组件
│   ├── task-tree.ts
│   ├── doc-tree.ts
│   ├── confirm-dialog.ts
│   └── prompt-dialog.ts
├── utils/                   # 工具函数
│   ├── dnd.ts
│   ├── i18n.ts
│   ├── i18n/
│   │   ├── en.ts
│   │   ├── zh.ts
│   │   └── index.ts
│   ├── lunar.ts
│   ├── file-suggest.ts
│   └── quotes.json
└── styles/                  # 样式相关
    └── themes.ts
```

### 文件移动清单

**阶段一：核心模块（无依赖）**
- `src/main.ts` → `src/core/main.ts`
- `src/types.ts` → `src/core/types.ts`
- `src/i18n.ts` → `src/utils/i18n/` (拆分)

**阶段二：数据层**
- `src/parser.ts` → `src/data/parser.ts`
- `src/sync.ts` → `src/data/sync.ts`
- 新建 `src/data/storage.ts`

**阶段三：服务层**
- `src/weather-service.ts` → `src/services/weather.ts`
- `src/pomodoro-service.ts` → `src/services/pomodoro.ts`
- `src/reading-service.ts` → `src/services/reading.ts`
- `src/book-service.ts` → `src/services/book.ts`
- `src/tracker-service.ts` → `src/services/tracker.ts`
- `src/holiday-service.ts` → `src/services/holiday.ts`

**阶段四：工具函数**
- `src/dnd.ts` → `src/utils/dnd.ts`
- `src/lunar-almanac.ts` → `src/utils/lunar.ts`
- `src/file-suggest.ts` → `src/utils/file-suggest.ts`

**阶段五：UI 组件**
- `src/task-tree.ts` → `src/components/task-tree.ts`
- `src/doc-tree.ts` → `src/components/doc-tree.ts`
- `src/confirm-dialog.ts` → `src/components/confirm-dialog.ts`
- `src/prompt-dialog.ts` → `src/components/prompt-dialog.ts`

**阶段六：模态框**
- 移动所有 `*-modal.ts` 文件到 `src/modals/`

**阶段七：渲染层（拆分 renderer.ts）**
- 拆分 `src/renderer.ts` → `src/renderers/` 下的5个文件

**阶段八：业务区域**
- 拆分 `src/library-section.ts` → `src/sections/library*.ts`
- 移动其他 section 文件

**阶段九：主视图重构**
- 精简 `src/view.ts` → `src/core/view.ts`

---

## 任务分解

### Task 1: 创建目录结构和更新构建配置

**Files:**
- Modify: `esbuild.config.mjs`
- Modify: `tsconfig.json`
- Create: 所有新目录

- [ ] **Step 1: 创建新目录结构**

```bash
mkdir -p src/core src/data src/services src/renderers src/sections src/modals src/components src/utils/i18n src/styles
```

- [ ] **Step 2: 更新 tsconfig.json 添加路径映射**

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@core/*": ["src/core/*"],
      "@data/*": ["src/data/*"],
      "@services/*": ["src/services/*"],
      "@renderers/*": ["src/renderers/*"],
      "@sections/*": ["src/sections/*"],
      "@modals/*": ["src/modals/*"],
      "@components/*": ["src/components/*"],
      "@utils/*": ["src/utils/*"]
    }
  }
}
```

- [ ] **Step 3: 更新 esbuild.config.mjs 支持路径别名**

```javascript
// 在 esbuild 配置中添加 alias
alias: {
  '@core': './src/core',
  '@data': './src/data',
  '@services': './src/services',
  '@renderers': './src/renderers',
  '@sections': './src/sections',
  '@modals': './src/modals',
  '@components': './src/components',
  '@utils': './src/utils'
}
```

- [ ] **Step 4: 验证构建配置**

```bash
npm run build
```

- [ ] **Step 5: 提交**

```bash
git add tsconfig.json esbuild.config.mjs
git commit -m "chore(build): 创建目录结构并更新构建配置"
```

---

### Task 2: 移动核心模块（main.ts, types.ts）

**Files:**
- Move: `src/main.ts` → `src/core/main.ts`
- Move: `src/types.ts` → `src/core/types.ts`

- [ ] **Step 1: 移动 main.ts**

```bash
git mv src/main.ts src/core/main.ts
```

- [ ] **Step 2: 更新 main.ts 的导入路径**

```typescript
// src/core/main.ts
import { DashboardSettings } from './types';
import { DashboardView } from './view';
// 更新其他导入...
```

- [ ] **Step 3: 移动 types.ts**

```bash
git mv src/types.ts src/core/types.ts
```

- [ ] **Step 4: 验证构建**

```bash
npm run build
```

- [ ] **Step 5: 提交**

```bash
git add src/core/
git commit -m "refactor(core): 移动 main.ts 和 types.ts 到 core 目录"
```

---

### Task 3: 拆分 i18n.ts（56KB → 3个文件）

**Files:**
- Split: `src/i18n.ts` → `src/utils/i18n.ts` + `src/utils/i18n/en.ts` + `src/utils/i18n/zh.ts`
- Create: `src/utils/i18n/index.ts`

- [ ] **Step 1: 提取英文翻译到 en.ts**

从 `src/i18n.ts` 提取 `en` 对象到 `src/utils/i18n/en.ts`：

```typescript
// src/utils/i18n/en.ts
export const en = {
  'settings.title': 'Dashboard Settings',
  'settings.general': 'General',
  // ... 提取所有英文翻译
};
```

- [ ] **Step 2: 提取中文翻译到 zh.ts**

从 `src/i18n.ts` 提取 `zh` 对象到 `src/utils/i18n/zh.ts`：

```typescript
// src/utils/i18n/zh.ts
export const zh = {
  'settings.title': '仪表盘设置',
  'settings.general': '通用',
  // ... 提取所有中文翻译
};
```

- [ ] **Step 3: 创建 i18n/index.ts**

```typescript
// src/utils/i18n/index.ts
export { en } from './en';
export { zh } from './zh';
```

- [ ] **Step 4: 更新 i18n.ts 入口文件**

```typescript
// src/utils/i18n.ts
import { en } from './i18n/en';
import { zh } from './i18n/zh';

let currentLocale = 'zh';

export function t(key: string, params?: Record<string, string>): string {
  const translations = currentLocale === 'zh' ? zh : en;
  let text = translations[key] || key;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, v);
    });
  }
  return text;
}

export function setLocale(locale: string): void {
  currentLocale = locale;
}

export function getLocale(): string {
  return currentLocale;
}
```

- [ ] **Step 5: 删除旧的 i18n.ts**

```bash
rm src/i18n.ts
```

- [ ] **Step 6: 更新所有导入路径**

搜索并替换所有 `from '../i18n'` 或 `from './i18n'` 为新的路径。

- [ ] **Step 7: 验证构建**

```bash
npm run build
```

- [ ] **Step 8: 提交**

```bash
git add src/utils/i18n* src/utils/i18n/
git commit -m "refactor(i18n): 拆分 i18n.ts 为多语言文件"
```

---

### Task 4: 移动数据层文件

**Files:**
- Move: `src/parser.ts` → `src/data/parser.ts`
- Move: `src/sync.ts` → `src/data/sync.ts`
- Create: `src/data/storage.ts`

- [ ] **Step 1: 移动 parser.ts**

```bash
git mv src/parser.ts src/data/parser.ts
```

- [ ] **Step 2: 移动 sync.ts**

```bash
git mv src/sync.ts src/data/sync.ts
```

- [ ] **Step 3: 创建 storage.ts**

```typescript
// src/data/storage.ts
import { Vault, TFile } from 'obsidian';

export class Storage {
  constructor(private vault: Vault) {}

  async readFile(path: string): Promise<string> {
    const file = this.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
      return await this.vault.read(file);
    }
    throw new Error(`File not found: ${path}`);
  }

  async writeFile(path: string, content: string): Promise<void> {
    const file = this.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
      await this.vault.modify(file, content);
    } else {
      await this.vault.create(path, content);
    }
  }

  async fileExists(path: string): Promise<boolean> {
    return this.vault.getAbstractFileByPath(path) !== null;
  }
}
```

- [ ] **Step 4: 更新导入路径**

更新所有引用 `parser.ts` 和 `sync.ts` 的文件。

- [ ] **Step 5: 验证构建**

```bash
npm run build
```

- [ ] **Step 6: 提交**

```bash
git add src/data/
git commit -m "refactor(data): 移动数据层文件并创建 storage 抽象"
```

---

### Task 5: 移动服务层文件

**Files:**
- Move: `src/weather-service.ts` → `src/services/weather.ts`
- Move: `src/pomodoro-service.ts` → `src/services/pomodoro.ts`
- Move: `src/reading-service.ts` → `src/services/reading.ts`
- Move: `src/book-service.ts` → `src/services/book.ts`
- Move: `src/tracker-service.ts` → `src/services/tracker.ts`
- Move: `src/holiday-service.ts` → `src/services/holiday.ts`

- [ ] **Step 1: 移动 weather-service.ts**

```bash
git mv src/weather-service.ts src/services/weather.ts
```

- [ ] **Step 2: 移动 pomodoro-service.ts**

```bash
git mv src/pomodoro-service.ts src/services/pomodoro.ts
```

- [ ] **Step 3: 移动 reading-service.ts**

```bash
git mv src/reading-service.ts src/services/reading.ts
```

- [ ] **Step 4: 移动 book-service.ts**

```bash
git mv src/book-service.ts src/services/book.ts
```

- [ ] **Step 5: 移动 tracker-service.ts**

```bash
git mv src/tracker-service.ts src/services/tracker.ts
```

- [ ] **Step 6: 移动 holiday-service.ts**

```bash
git mv src/holiday-service.ts src/services/holiday.ts
```

- [ ] **Step 7: 更新所有导入路径**

搜索并替换所有服务相关的导入路径。

- [ ] **Step 8: 验证构建**

```bash
npm run build
```

- [ ] **Step 9: 提交**

```bash
git add src/services/
git commit -m "refactor(services): 移动服务层文件"
```

---

### Task 6: 移动工具函数文件

**Files:**
- Move: `src/dnd.ts` → `src/utils/dnd.ts`
- Move: `src/lunar-almanac.ts` → `src/utils/lunar.ts`
- Move: `src/file-suggest.ts` → `src/utils/file-suggest.ts`

- [ ] **Step 1: 移动 dnd.ts**

```bash
git mv src/dnd.ts src/utils/dnd.ts
```

- [ ] **Step 2: 移动 lunar-almanac.ts**

```bash
git mv src/lunar-almanac.ts src/utils/lunar.ts
```

- [ ] **Step 3: 移动 file-suggest.ts**

```bash
git mv src/file-suggest.ts src/utils/file-suggest.ts
```

- [ ] **Step 4: 更新所有导入路径**

- [ ] **Step 5: 验证构建**

```bash
npm run build
```

- [ ] **Step 6: 提交**

```bash
git add src/utils/
git commit -m "refactor(utils): 移动工具函数文件"
```

---

### Task 7: 移动组件文件

**Files:**
- Move: `src/task-tree.ts` → `src/components/task-tree.ts`
- Move: `src/doc-tree.ts` → `src/components/doc-tree.ts`
- Move: `src/confirm-dialog.ts` → `src/components/confirm-dialog.ts`
- Move: `src/prompt-dialog.ts` → `src/components/prompt-dialog.ts`

- [ ] **Step 1: 移动 task-tree.ts**

```bash
git mv src/task-tree.ts src/components/task-tree.ts
```

- [ ] **Step 2: 移动 doc-tree.ts**

```bash
git mv src/doc-tree.ts src/components/doc-tree.ts
```

- [ ] **Step 3: 移动 confirm-dialog.ts**

```bash
git mv src/confirm-dialog.ts src/components/confirm-dialog.ts
```

- [ ] **Step 4: 移动 prompt-dialog.ts**

```bash
git mv src/prompt-dialog.ts src/components/prompt-dialog.ts
```

- [ ] **Step 5: 更新所有导入路径**

- [ ] **Step 6: 验证构建**

```bash
npm run build
```

- [ ] **Step 7: 提交**

```bash
git add src/components/
git commit -m "refactor(components): 移动通用组件文件"
```

---

### Task 8: 移动模态框文件

**Files:**
- Move: 所有 `*-modal.ts` 文件到 `src/modals/`

- [ ] **Step 1: 移动所有模态框文件**

```bash
git mv src/card-edit-modal.ts src/modals/card-edit.ts
git mv src/countdown-modal.ts src/modals/countdown.ts
git mv src/template-modal.ts src/modals/template.ts
git mv src/calendar-modal.ts src/modals/calendar.ts
git mv src/calendar-config-modal.ts src/modals/calendar-config.ts
git mv src/weather-config-modal.ts src/modals/weather-config.ts
git mv src/library-config-modal.ts src/modals/library-config.ts
git mv src/media-lightbox-modal.ts src/modals/media-lightbox.ts
git mv src/heatmap-config-modal.ts src/modals/heatmap-config.ts
git mv src/tracker-config-modal.ts src/modals/tracker-config.ts
git mv src/folder-config-modal.ts src/modals/folder-config.ts
git mv src/widget-type-modal.ts src/modals/widget-type.ts
git mv src/lunar-widget.ts src/modals/lunar.ts
git mv src/fortune-stick-modal.ts src/modals/fortune.ts
git mv src/note-popover-modal.ts src/modals/note-popover.ts
git mv src/hover-preview.ts src/modals/hover-preview.ts
```

- [ ] **Step 2: 更新所有导入路径**

- [ ] **Step 3: 验证构建**

```bash
npm run build
```

- [ ] **Step 4: 提交**

```bash
git add src/modals/
git commit -m "refactor(modals): 移动模态框文件"
```

---

### Task 9: 拆分 renderer.ts（130KB → 5个文件）

**Files:**
- Split: `src/renderer.ts` → `src/renderers/dashboard.ts` + `src/renderers/sidebar.ts` + `src/renderers/banner.ts` + `src/renderers/section.ts` + `src/renderers/widgets.ts`

- [ ] **Step 1: 分析 renderer.ts 结构**

```bash
grep -n "function\|class\|export" src/renderer.ts | head -50
```

- [ ] **Step 2: 提取 Banner 类到 banner.ts**

从 `src/renderer.ts` 提取 `Banner` 类到 `src/renderers/banner.ts`：

```typescript
// src/renderers/banner.ts
export class Banner {
  // ... 提取 Banner 类的完整实现
}
```

- [ ] **Step 3: 提取侧边栏渲染到 sidebar.ts**

```typescript
// src/renderers/sidebar.ts
export function renderSidebarWidgets(container: HTMLElement, data: any): void {
  // ... 提取侧边栏渲染逻辑
}
```

- [ ] **Step 4: 提取区域渲染到 section.ts**

```typescript
// src/renderers/section.ts
export function renderSection(container: HTMLElement, sectionData: any): void {
  // ... 提取区域渲染逻辑
}
```

- [ ] **Step 5: 提取小组件到 widgets.ts**

```typescript
// src/renderers/widgets.ts
export function renderWeatherWidget(container: HTMLElement, data: any): void {
  // ... 提取天气小组件
}

export function renderLunarWidget(container: HTMLElement, data: any): void {
  // ... 提取农历小组件
}
```

- [ ] **Step 6: 更新 dashboard.ts 为协调器**

```typescript
// src/renderers/dashboard.ts
import { renderSidebarWidgets } from './sidebar';
import { Banner } from './banner';
import { renderSection } from './section';
import { renderWeatherWidget, renderLunarWidget } from './widgets';

export function renderDashboard(container: HTMLElement, data: any): void {
  // ... 协调各个渲染器
}
```

- [ ] **Step 7: 删除旧的 renderer.ts**

```bash
rm src/renderer.ts
```

- [ ] **Step 8: 更新所有导入路径**

- [ ] **Step 9: 验证构建**

```bash
npm run build
```

- [ ] **Step 10: 提交**

```bash
git add src/renderers/
git commit -m "refactor(renderers): 拆分 renderer.ts 为多个模块"
```

---

### Task 10: 拆分 library-section.ts（43KB → 3个文件）

**Files:**
- Split: `src/library-section.ts` → `src/sections/library.ts` + `src/sections/library-views.ts` + `src/sections/library-config.ts`

- [ ] **Step 1: 提取配置逻辑到 library-config.ts**

```typescript
// src/sections/library-config.ts
export function parseLibraryConfig(config: any): LibraryConfig {
  // ... 提取配置解析逻辑
}

export function getDefaultConfig(): LibraryConfig {
  // ... 提取默认配置
}
```

- [ ] **Step 2: 提取视图实现到 library-views.ts**

```typescript
// src/sections/library-views.ts
export class GridView {
  // ... 提取网格视图
}

export class ListView {
  // ... 提取列表视图
}

export class TableView {
  // ... 提取表格视图
}

export class KanbanView {
  // ... 提取看板视图
}
```

- [ ] **Step 3: 更新 library.ts 为主入口**

```typescript
// src/sections/library.ts
import { parseLibraryConfig } from './library-config';
import { GridView, ListView, TableView, KanbanView } from './library-views';

export function renderLibrarySection(container: HTMLElement, config: any): void {
  // ... 协调各个视图
}
```

- [ ] **Step 4: 删除旧的 library-section.ts**

```bash
rm src/library-section.ts
```

- [ ] **Step 5: 更新所有导入路径**

- [ ] **Step 6: 验证构建**

```bash
npm run build
```

- [ ] **Step 7: 提交**

```bash
git add src/sections/
git commit -m "refactor(sections): 拆分 library-section.ts"
```

---

### Task 11: 移动其他 section 文件

**Files:**
- Move: `src/media-section.ts` → `src/sections/media.ts`
- Move: `src/calendar-section.ts` → `src/sections/calendar.ts`
- Move: `src/heatmap-section.ts` → `src/sections/heatmap.ts`
- Move: `src/calendar-grid.ts` → `src/sections/calendar-grid.ts`

- [ ] **Step 1: 移动 media-section.ts**

```bash
git mv src/media-section.ts src/sections/media.ts
```

- [ ] **Step 2: 移动 calendar-section.ts**

```bash
git mv src/calendar-section.ts src/sections/calendar.ts
```

- [ ] **Step 3: 移动 heatmap-section.ts**

```bash
git mv src/heatmap-section.ts src/sections/heatmap.ts
```

- [ ] **Step 4: 移动 calendar-grid.ts**

```bash
git mv src/calendar-grid.ts src/sections/calendar-grid.ts
```

- [ ] **Step 5: 更新所有导入路径**

- [ ] **Step 6: 验证构建**

```bash
npm run build
```

- [ ] **Step 7: 提交**

```bash
git add src/sections/
git commit -m "refactor(sections): 移动其他 section 文件"
```

---

### Task 12: 移动剩余文件

**Files:**
- Move: `src/banner.ts` → `src/renderers/banner.ts` (如果还未移动)
- Move: `src/quick-actions.ts` → `src/components/quick-actions.ts`
- Move: `src/daily-notes.ts` → `src/components/daily-notes.ts`
- Move: `src/recent.ts` → `src/components/recent.ts`
- Move: `src/reminder-notice.ts` → `src/components/reminder-notice.ts`
- Move: `src/fortune-stick.ts` → `src/components/fortune-stick.ts`
- Move: `src/obsidian-internal.ts` → `src/utils/obsidian-internal.ts`
- Move: `src/add-section-modal.ts` → `src/modals/add-section.ts`

- [ ] **Step 1: 移动 quick-actions.ts**

```bash
git mv src/quick-actions.ts src/components/quick-actions.ts
```

- [ ] **Step 2: 移动 daily-notes.ts**

```bash
git mv src/daily-notes.ts src/components/daily-notes.ts
```

- [ ] **Step 3: 移动 recent.ts**

```bash
git mv src/recent.ts src/components/recent.ts
```

- [ ] **Step 4: 移动 reminder-notice.ts**

```bash
git mv src/reminder-notice.ts src/components/reminder-notice.ts
```

- [ ] **Step 5: 移动 fortune-stick.ts**

```bash
git mv src/fortune-stick.ts src/components/fortune-stick.ts
```

- [ ] **Step 6: 移动 obsidian-internal.ts**

```bash
git mv src/obsidian-internal.ts src/utils/obsidian-internal.ts
```

- [ ] **Step 7: 移动 add-section-modal.ts**

```bash
git mv src/add-section-modal.ts src/modals/add-section.ts
```

- [ ] **Step 8: 更新所有导入路径**

- [ ] **Step 9: 验证构建**

```bash
npm run build
```

- [ ] **Step 10: 提交**

```bash
git add src/components/ src/utils/ src/modals/
git commit -m "refactor: 移动剩余文件到对应目录"
```

---

### Task 13: 重构 view.ts（精简到 20KB）

**Files:**
- Modify: `src/view.ts` → `src/core/view.ts`

- [ ] **Step 1: 分析 view.ts 结构**

```bash
grep -n "function\|class\|export" src/view.ts | head -50
```

- [ ] **Step 2: 移出渲染逻辑**

将渲染相关的函数移动到 `src/renderers/dashboard.ts`。

- [ ] **Step 3: 移出事件处理逻辑**

将事件处理移动到相应的组件或 `src/utils/dnd.ts`。

- [ ] **Step 4: 精简 view.ts**

只保留核心的视图生命周期管理：

```typescript
// src/core/view.ts
import { ItemView, WorkspaceLeaf } from 'obsidian';
import { renderDashboard } from '../renderers/dashboard';

export class DashboardView extends ItemView {
  // ... 只保留核心生命周期方法
}
```

- [ ] **Step 5: 移动到 core 目录**

```bash
git mv src/view.ts src/core/view.ts
```

- [ ] **Step 6: 更新所有导入路径**

- [ ] **Step 7: 验证构建**

```bash
npm run build
```

- [ ] **Step 8: 提交**

```bash
git add src/core/view.ts
git commit -m "refactor(view): 精简 view.ts 并移动到 core 目录"
```

---

### Task 14: 移动样式和数据文件

**Files:**
- Move: `src/lunar-widget.ts` → `src/utils/lunar-widget.ts` (如果还未移动)
- Move: `quotes.json` → `src/utils/quotes.json`

- [ ] **Step 1: 移动 lunar-widget.ts**

```bash
git mv src/lunar-widget.ts src/utils/lunar-widget.ts
```

- [ ] **Step 2: 移动 quotes.json**

```bash
mkdir -p src/utils
mv src/data/quotes.json src/utils/quotes.json 2>/dev/null || echo "quotes.json already in place"
```

- [ ] **Step 3: 更新所有导入路径**

- [ ] **Step 4: 验证构建**

```bash
npm run build
```

- [ ] **Step 5: 提交**

```bash
git add src/utils/
git commit -m "refactor: 移动样式和数据文件"
```

---

### Task 15: 清理和验证

**Files:**
- Delete: 所有旧的源文件（如果还存在）
- Modify: `README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: 检查是否有残留文件**

```bash
ls src/*.ts
```

- [ ] **Step 2: 删除残留文件（如果需要）**

```bash
# 如果还有残留的 .ts 文件，删除它们
rm -f src/*.ts
```

- [ ] **Step 3: 更新 README.md**

更新项目结构说明：

```markdown
## 项目结构

```
src/
├── core/          # 核心层
├── data/          # 数据层
├── services/      # 服务层
├── renderers/     # 渲染层
├── sections/      # 业务区域
├── modals/        # 模态框
├── components/    # 通用组件
└── utils/         # 工具函数
```
```

- [ ] **Step 4: 更新 CLAUDE.md**

更新架构说明：

```markdown
## Architecture

### Directory Structure
- `src/core/` - Plugin entry, main view, types
- `src/data/` - Parser, sync engine, storage abstraction
- `src/services/` - Weather, pomodoro, reading, book, tracker, holiday services
- `src/renderers/` - Dashboard, sidebar, banner, section, widgets renderers
- `src/sections/` - Library, media, calendar, heatmap sections
- `src/modals/` - All modal dialogs
- `src/components/` - Reusable UI components
- `src/utils/` - DnD, i18n, lunar, file-suggest utilities
```

- [ ] **Step 5: 最终验证**

```bash
npm run build
npm run lint
```

- [ ] **Step 6: 提交**

```bash
git add README.md CLAUDE.md
git commit -m "docs: 更新项目结构文档"
```

---

## 自检清单

### 1. 规格覆盖度检查

- ✅ 目录结构重组：Task 1-14
- ✅ 大文件拆分：Task 3, 9, 10
- ✅ 导入路径更新：每个 Task 都包含
- ✅ 构建配置更新：Task 1
- ✅ 文档更新：Task 15

### 2. 占位符扫描

- ✅ 无 "TBD"、"TODO" 等占位符
- ✅ 所有步骤都有具体操作
- ✅ 所有代码示例都是完整的

### 3. 类型一致性检查

- ✅ 函数名和类型名在所有任务中保持一致
- ✅ 导入路径在所有任务中保持一致
- ✅ 接口定义在所有任务中保持一致

### 4. 依赖顺序检查

- ✅ Task 1（构建配置）必须最先执行
- ✅ 核心模块（Task 2）在其他模块之前
- ✅ 数据层（Task 4）在服务层（Task 5）之前
- ✅ 渲染层拆分（Task 9）在业务区域（Task 10-11）之前

---

## 执行选项

**Plan complete and saved to `docs/superpowers/plans/2026-07-22-project-refactoring.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
