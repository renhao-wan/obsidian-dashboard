# Obsidian Dashboard

> Stop switching between Obsidian notes. One page. Everything you need. Memo your thoughts, crush your todos, track your projects — and make it look incredible doing it. [【中文版】](README_ZH.md)

## Features

### 🗒️ Memo
Capture thoughts instantly with a built-in memo pad. Each memo card has a writable textarea — jot down ideas, meeting notes, or daily reflections without leaving your dashboard. Supports `[[wikilinks]]` that render as clickable links.

### ✅ Todo
Manage tasks with interactive checklists. Add, reorder, drag-and-drop, and check off tasks. A progress bar shows completion percentage at a glance. Todo items also support `[[wikilinks]]` for cross-referencing notes.

### 📁 Projects
Organize your vault documents into project cards. Each card links to related notes, displays a cover image (supports both local vault images and web URLs), and supports inline document search to add new files quickly. Manage multiple file types including Markdown notes, PDFs, images, audio, and video.

### 📝 Notes
A compact, list-style section for organizing reference documents and quick-access files. Displays up to 5 cards per row without cover images for maximum density.

### 📅 Calendar
A native month-grid calendar of every dated task across your vault (no dataview or external plugin needed). Each day cell lists its tasks; click a day for its agenda. Open a full-screen calendar with month navigation and inline toggling. Multi-day events with `[start::]` / `[end::]` span across days.

### ⚡ Quick Actions
Pin your most-used shortcuts to the sidebar. Supports two action types: **File** links to open any document, and **Command** shortcuts to trigger any Obsidian command. Includes built-in presets for New Journal and New Note.

### 🌤️ Sidebar Widgets
The left sidebar features decorative widgets for at-a-glance information:

- **Week Calendar** — A compact 7-day strip highlighting today's date
- **Weather Widget** — Real-time weather with current temperature, feels-like, humidity, wind speed, and a 5-day forecast with daily high/low temperatures. Powered by Open-Meteo (no API key needed). City search with geocoding autocomplete for precise location
- **Heatmap Widget** — Track daily frontmatter data (mood, sleep, etc.) as a GitHub-style contribution heatmap. Configurable summary: streak days (⚡), completion rate (✅), or both
- **Pomodoro Timer** — A focus timer with activity selector and session tracking. Start, pause, and stop timed sessions with a donut chart showing today's breakdown by activity
- **Reading Tracker** — Track your reading sessions with a built-in timer. Add books from Douban search or manual input, time your reading sessions, and record progress with page numbers. Each book card shows cover image, author, and reading progress bar
- **Countdown** — A customizable countdown to any target date, displayed as days or hours remaining

### 🎨 Banner
A customizable banner with an inspirational quote and optional background image. Supports both local vault images and web URLs. Double-click to edit.

### 🔄 Drag & Drop
Drag cards between sections to reorganize your workspace. Drag task items within Todo cards to reorder. Drag document links between project/note cards.

### 🧩 Custom Sections
Create sections with 4 built-in types — **Memo**, **Todo**, **Projects**, and **Notes** — each with its own layout and behavior. Mix and match to fit your workflow.

### 🕐 Recent Documents
The sidebar shows recently edited files with relative timestamps, so you can jump back into your latest work.

## Themes

14 handcrafted themes, each with distinct visual identity:

| Theme | Style |
|-------|-------|
| **Earth** | Warm organic tones, parchment textures |
| **Nordic** | Clean minimal with blue accents |
| **Aurora** | Frosted glass with animated aurora gradient |
| **Island** | Animal Crossing pastels, forest green and ocean blue |
| **Tundra** | Cold gray + avocado green aurora, sage glass cards |
| **Blossom** | Rose glass glow, transparent sections |
| **Haze** | Smoky white-to-blue mist, extreme glass transparency |
| **Ember** | Warm campfire smoke gradient, amber glow |
| **Jade** | Green bamboo mist, crisp jade-cut edges |
| **Matcha** | Morandi green, solid warm tones |
| **Lilac** | Morandi purple, soft and muted |
| **Eclipse** | Industrial monochrome, sharp lines |
| **Onyx** | Pure black with lemon accent, identical in light & dark |
| **Mono** | Pure black/white minimal, no glass or gradients |

All themes support both Obsidian light and dark modes.

## Settings

- **Dashboard file** — customize the file path for your dashboard data
- **Style** — choose from 14 visual themes
- **Language** — English or Chinese interface
- **Recent documents count** — control how many recent files appear
- **Sidebar widgets** — Weather, Heatmap, Pomodoro, Reading, Countdown. Enable/disable and configure each widget independently
- **Reading settings** — Toggle reading tracker, enable/disable session completion sound

## Installation

### From Obsidian Community Plugins
1. Open Settings > Community Plugins
2. Browse and search for "Obsidian Dashboard"
3. Click Install, then Enable

### Manual Installation
1. Download the latest release from [GitHub Releases](https://github.com/renhao-wan/obsidian-dashboard/releases)
2. Extract into your vault's `.obsidian/plugins/obsidian-dashboard/` folder
3. Open Settings > Community Plugins and enable "Obsidian Dashboard"

## Usage

1. Open the dashboard via the ribbon icon (home icon) or command palette: `Obsidian Dashboard: Open dashboard`
2. A `dashboard.md` file is automatically created in your vault root
3. All changes are saved directly to the file — it's your data, in plain text

> **Note:** Deleting, renaming, or reordering sections must be done by editing the `dashboard.md` file directly. Any changes made to the note will take effect in the dashboard view immediately.

## Project Structure

```
src/
├── core/          # 核心层
├── data/          # 数据层
├── services/      # 服务层
├── renderers/     # 渲染层
├── sections/      # 业务区域
├── modals/        # 模态框
├── components/    # 通用组件
├── styles/        # 模块化 CSS 源码（主题变量 + 组件样式）
└── utils/         # 工具函数
```

> **Note:** 根目录的 `styles.css` 是构建产物，由 `build-css.mjs` 脚本从 `src/styles/` 目录自动生成，无需手动编辑。

## Compatibility

- Obsidian v0.15.0+
- Desktop and mobile
- All themes work in both light and dark Obsidian modes

## License

MIT
