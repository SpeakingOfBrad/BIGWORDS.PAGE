// Renders the social card (public/og.png) and the install screenshots
// (public/screenshots/, listed in public/manifest.webmanifest) with the real
// app, against a running build (npm run build && npm run preview), and the app
// icons (public/apple-touch-icon.png, public/icon-*.png) from the favicon.
// Commit the results.
// Usage: node scripts/og-image.mjs [baseUrl]
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';

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

// Systems round or mask the corners themselves, so the icons are full squares.
const square = readFileSync('public/favicon.svg', 'utf8').replace(/ rx="\d+"/, '');
// A maskable icon can be cropped to a circle 80% of its width, so the
// letterform shrinks to fit inside it.
const maskable = square.replace(/(<rect width="64" height="64"[^>]*\/>)([\s\S]*)<\/svg>/, '$1<g transform="translate(32 32) scale(0.72) translate(-32 -32)">$2</g></svg>');
const icons = [
  ['public/apple-touch-icon.png', 180, square],
  ['public/icon-192.png', 192, square],
  ['public/icon-512.png', 512, square],
  ['public/icon-maskable-512.png', 512, maskable],
];
for (const [path, size, svg] of icons) {
  const icon = await browser.newPage({ viewport: { width: size, height: size } });
  await icon.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await icon.screenshot({ path });
  await icon.close();
}

// Screenshots for the install dialog in Chrome and Edge: "wide" for desktop,
// "narrow" for phones. Each group shares one aspect ratio. The manifest lists
// them with these sizes, so keep the two in step. They're taken at SITE_URL
// (example.com without it), so the editor's URL field shows the site's own
// address rather than the local server.
const ORIGIN = (process.env.SITE_URL || 'https://example.com').replace(/\/+$/, '');
const ARRIVALS = '**WELCOME%20HOME,%0AGRANDMA!**&bg=f9d5e5&fg=4a2c40&font=6';
const GATE = '%23%20Gate%2012%0ABoarding%20now&bg=0b3d91&fg=ffffff&font=2';
const MENU = 'Scan%20for%20the%20menu&qr=https://example.com/menu&qrpos=below&qrsize=50&font=2&bg=1d3557&fg=f1faee';
const QUIZ = 'Quiz%20timer:%0A%7Bcountdown%7D&bg=000000&fg=ffffff&font=3&timer=30s';
const shots = [
  ['wide', { width: 1280, height: 800 }, 2, [['editor', `/editor#${ARRIVALS}`], ['gate', `/#${GATE}`], ['menu', `/#${MENU}`]]],
  ['narrow', { width: 390, height: 844 }, 2, [['editor', `/editor#${ARRIVALS}`], ['quiz', `/#${QUIZ}`], ['menu', `/#${MENU}`]]],
];
mkdirSync('public/screenshots', { recursive: true });
for (const [form, viewport, deviceScaleFactor, pages] of shots) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor, colorScheme: 'dark', serviceWorkers: 'block' });
  await ctx.route(`${ORIGIN}/**`, async (route) => route.fulfill({ response: await route.fetch({ url: route.request().url().replace(ORIGIN, BASE) }) }));
  const page = await ctx.newPage();
  for (const [name, path] of pages) {
    await page.goto(ORIGIN + path);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `public/screenshots/${form}-${name}.png` });
  }
  await ctx.close();
}

await browser.close();
console.log(`Wrote public/og.png, public/screenshots/ and ${icons.map(([path]) => path).join(', ')}`);
