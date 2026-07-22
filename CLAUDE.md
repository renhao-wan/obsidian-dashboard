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

### Directory Structure
- `src/core/` - Plugin entry, main view, types
- `src/data/` - Parser, sync engine, storage abstraction
- `src/services/` - Weather, pomodoro, reading, book, tracker, holiday services
- `src/renderers/` - Dashboard, sidebar, banner, section, widgets renderers
- `src/sections/` - Library, media, calendar, heatmap sections
- `src/modals/` - All modal dialogs
- `src/components/` - Reusable UI components
- `src/utils/` - DnD, i18n, lunar, file-suggest utilities

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
