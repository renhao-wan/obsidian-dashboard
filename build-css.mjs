#!/usr/bin/env node
/**
 * Build script to concatenate modular CSS files into a single styles.css
 * for Obsidian plugin compatibility.
 *
 * Usage: node build-css.mjs [--watch]
 */

import { readFileSync, writeFileSync, watchFile, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STYLES_DIR = join(__dirname, 'src', 'styles');
const OUTPUT_FILE = join(__dirname, 'styles.css');

// Import order - must match index.css
const CSS_FILES = [
  // Theme keyframes
  'themes/_keyframes.css',

  // Theme variable definitions
  'themes/aurora.css',
  'themes/earth.css',
  'themes/nordic.css',
  'themes/island.css',
  'themes/tundra.css',
  'themes/haze.css',
  'themes/blossom.css',
  'themes/shared-transparent.css',
  'themes/jade.css',
  'themes/matcha.css',
  'themes/lilac.css',
  'themes/carbon.css',
  'themes/onyx.css',
  'themes/mono.css',

  // Component styles
  'components/base.css',
  'components/banner.css',
  'components/sidebar.css',
  'components/cards.css',
  'components/modals.css',
  'components/theme-enhancements.css',
  'components/library.css',
  'components/media.css',
  'components/calendar.css',
  'components/fortune.css',
];

function buildCSS() {
  console.log('Building styles.css...');

  const parts = [];
  let totalSize = 0;

  for (const file of CSS_FILES) {
    const filePath = join(STYLES_DIR, file);
    try {
      const content = readFileSync(filePath, 'utf-8');
      parts.push(`/* === ${file} === */\n${content}`);
      totalSize += content.length;
    } catch (err) {
      console.error(`Error reading ${file}:`, err.message);
      process.exit(1);
    }
  }

  const output = parts.join('\n\n');
  writeFileSync(OUTPUT_FILE, output, 'utf-8');

  const stats = statSync(OUTPUT_FILE);
  const sizeKB = (stats.size / 1024).toFixed(1);

  console.log(`✓ Built ${OUTPUT_FILE}`);
  console.log(`  - ${CSS_FILES.length} files merged`);
  console.log(`  - ${sizeKB} KB total`);
}

// Build once
buildCSS();

// Watch mode
if (process.argv.includes('--watch')) {
  console.log('\nWatching for changes...');

  const watchSet = new Set();
  for (const file of CSS_FILES) {
    const filePath = join(STYLES_DIR, file);
    watchFile(filePath, { interval: 1000 }, () => {
      if (!watchSet.has(filePath)) {
        watchSet.add(filePath);
        console.log(`\nChanged: ${file}`);
        buildCSS();
        // Reset after rebuild
        setTimeout(() => watchSet.delete(filePath), 100);
      }
    });
  }

  // Keep process alive
  process.on('SIGINT', () => {
    console.log('\nStopped watching.');
    process.exit(0);
  });
}
