# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Obsidian Dashboard is an Obsidian plugin that provides a glassmorphism-styled personal command center with memos, todos, projects, quick actions, and sidebar widgets. All data is stored as plain Markdown in the vault.

## Commands

```bash
npm run dev          # Development build with watch mode (esbuild)
npm run build        # Production build (TypeScript check + esbuild minify)
npm run lint         # ESLint check
npm install          # Install dependencies
```

## Architecture

### Entry & Lifecycle
- `src/main.ts` — Plugin entry point (`DashboardPlugin extends Plugin`). Registers commands, ribbon icon, settings tab, and view type.
- `src/view.ts` — `DashboardView extends ItemView`. The main dashboard view that orchestrates rendering, sidebar widgets, banner, quick actions, and user interactions.

### Data Layer
- `src/types.ts` — All TypeScript interfaces (`DashboardSettings`, `DashboardData`, `DashboardCard`, `TaskItem`, `DocNode`, etc.). Single source of truth for data shapes.
- `src/parser.ts` — Parses `dashboard.md` Markdown into `DashboardData` (YAML frontmatter + sections). Also handles serialization back to Markdown.
- `src/sync.ts` — `SyncEngine` watches the dashboard file, debounces writes (300ms), manages backup rotation (`.dashboard-backup/`, max 5), and coordinates data flow between file and view.

### Rendering
- `src/renderer.ts` — Core rendering functions: `renderDashboard()`, `renderSidebarWidgets()`, `renderSection()`. Manages Chart.js instances and countdown timers.
- `src/banner.ts` — Banner with quotes and background images (rotates every 30min/1hr).
- `src/dnd.ts` — Drag-and-drop system for cards, tasks, documents, and section reordering.

### Section Types
Each section type has its own module with a `render*Section()` function:
- `src/library-section.ts` — Database/library section with grid/list/table/kanban views
- `src/media-section.ts` — Images/videos gallery with lightbox
- `src/calendar-section.ts` — Month/week calendar of dated tasks
- `src/heatmap-section.ts` — GitHub-style contribution heatmap
- `src/weread-section.ts` — WeChat Read (Weread) integration
- `src/ticktick-section.ts` — TickTick/Dida365 task integration

### Services
- `src/weather-service.ts` — Open-Meteo weather API (no key needed)
- `src/pomodoro-service.ts` — Pomodoro timer with activity tracking
- `src/reading-service.ts` — Reading session timer and tracking
- `src/book-service.ts` — Douban book search and cover download
- `src/tracker-service.ts` — Daily frontmatter data tracking
- `src/holiday-service.ts` — Chinese holiday data
- `src/weread-service.ts` — Weread API client
- `src/ticktick-service.ts` — TickTick/Dida365 API client

### Internationalization
- `src/i18n.ts` — Translation system using `t('key')` function. Supports `en` and `zh`. All user-facing strings must go through i18n.

### Settings
- `src/settings.ts` — `DashboardSettingTab` renders the plugin settings UI.

## Key Patterns

- **Markdown as database**: The `dashboard.md` file is the single source of truth. Parser reads it, SyncEngine watches and writes it back.
- **Section rendering**: Each section type exports a `render*Section(container, config, data, callbacks)` function.
- **Cleanup**: Every renderer returns cleanup functions stored in `cleanupFns[]`. The view calls them all on unload.
- **Platform checks**: Use `Platform.isDesktop` / `Platform.isMobile` for feature gating.
- **Theme styles**: 14 themes defined in `styles.css` with CSS custom properties. Theme keys: earth, nordic, aurora, island, tundra, blossom, matcha, lilac, haze, jade, carbon, onyx, mono.

## Dependencies

- `obsidian` — Obsidian API (external, not bundled)
- `chart.js` — Charts for Pomodoro stats
- `yaml` — YAML parsing for frontmatter
- `lunar-typescript` — Chinese lunar calendar

## File Conventions

- Source files use kebab-case: `weather-service.ts`, `library-section.ts`
- All new UI strings must be added to both `en` and `zh` translation maps in `src/i18n.ts`
- Section types are registered in `src/add-section-modal.ts`
