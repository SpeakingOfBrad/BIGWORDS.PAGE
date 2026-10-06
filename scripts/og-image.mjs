// Renders the social card (public/og.png) and the touch icon
// (public/apple-touch-icon.png) with the real viewer, against a running build
// (npm run build && npm run preview). Commit the results.
// Usage: node scripts/og-image.mjs [baseUrl]
import { chromium } from 'playwright';
import { existsSync, readFileSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:4173';
// CHROMIUM_PATH points at a system Chromium; otherwise Playwright uses its own.
const executablePath = process.env.CHROMIUM_PATH && existsSync(process.env.CHROMIUM_PATH) ? process.env.CHROMIUM_PATH : undefined;
const CARD = '%23%20BIGWORDS.PAGE%0ABig%20words%20for%20any%20screen&bg=111111&fg=ffd60a&font=4&pad=8';

const browser = await chromium.launch({ executablePath });

const card = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await card.goto(`${BASE}/#${CARD}`);
await card.evaluate(() => document.fonts.ready);
await card.waitForTimeout(500);
await card.screenshot({ path: 'public/og.png' });

// iOS rounds the corners itself, so the icon is a full square.
const icon = await browser.newPage({ viewport: { width: 180, height: 180 } });
await icon.setContent(`<style>html,body{margin:0}svg{display:block;width:180px;height:180px}</style>${readFileSync('public/favicon.svg', 'utf8').replace(/ rx="\d+"/, '')}`);
await icon.screenshot({ path: 'public/apple-touch-icon.png' });

await browser.close();
console.log('Wrote public/og.png and public/apple-touch-icon.png');
