// End-to-end smoke test against a running build (npm run build && npm run preview).
// Usage: node scripts/smoke.mjs [baseUrl] [screenshotDir]
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:4173';
const SHOTS = process.argv[3];
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
// CHROMIUM_PATH points at a system Chromium; otherwise Playwright uses its own.
const executablePath = process.env.CHROMIUM_PATH && existsSync(process.env.CHROMIUM_PATH) ? process.env.CHROMIUM_PATH : undefined;

const browser = await chromium.launch({ executablePath });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, colorScheme: 'dark' });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
// Chrome logs the deliberate 404 of the not-found checks as an error.
const expected404 = (m) => /status of 404/.test(m.text()) && /\/nope(#|$)/.test(m.location().url);
page.on('console', (m) => m.type() === 'error' && !expected404(m) && errors.push(m.text()));

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!ok) failed++;
};
const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png` });
const settle = (ms = 400) => page.waitForTimeout(ms);

/** Returns the text block's font size and whether it overflows the text area. */
const blockInfo = () =>
  page.evaluate(() => {
    const slide = [...document.querySelectorAll('.bw-slide')].find((s) => !s.hidden);
    const block = slide?.querySelector('.bw-block');
    const area = document.querySelector('.bw-area');
    if (!block || !area) return null;
    const a = area.getBoundingClientRect();
    const b = block.getBoundingClientRect();
    return {
      fontSize: parseFloat(block.style.fontSize),
      inside: b.left >= a.left - 1 && b.right <= a.right + 1 && b.top >= a.top - 1 && b.bottom <= a.bottom + 1,
      text: block.textContent,
      fill: Math.max(b.width / a.width, b.height / a.height),
    };
  });

// Home
await page.goto(BASE + '/');
await settle();
check('home renders', (await page.locator('.hero h1').count()) === 1);
check('home title', (await page.title()) === 'BIGWORDS.PAGE: Turn any screen into a sign', await page.title());
await shot('home');

// Viewer: plain text fits
await page.goto(BASE + '/#Hello%20World');
await settle();
let info = await blockInfo();
check('viewer renders message', info?.text === 'Hello World', info?.text);
check('viewer title never shows the message', (await page.title()) === 'BIGWORDS.PAGE', await page.title());
check('auto-fit fills and stays inside', !!info && info.inside && info.fill > 0.9, JSON.stringify(info));
await shot('viewer-hello');

// Navigating to an empty fragment returns home
await page.evaluate(() => (location.hash = ''));
await settle();
check('empty fragment → home', (await page.locator('.hero').count()) === 1);

// Solid red with no message
await page.goto(BASE + '/#&bg=ff0000');
await settle();
const bg = await page.evaluate(() => getComputedStyle(document.querySelector('.bw-box')).backgroundColor);
check('#&bg=ff0000 is red', bg === 'rgb(255, 0, 0)', bg);

// Markdown + headings
await page.goto(BASE + '/#%23%20Title%0A**bold**%20and%20*it*%20\\*lit\\*');
await settle();
check('heading line', (await page.locator('.bw-h1').textContent()) === 'Title');
check('bold & italic', (await page.locator('.bw-b').first().textContent()) === 'bold' && (await page.locator('.bw-i').first().textContent()) === 'it');
info = await blockInfo();
check('escaped stars literal', info?.text.includes('*lit*'), info?.text);

// Multi-line fit at different sizes and ratios
for (const [w, hgt] of [[375, 667], [1920, 1080], [800, 800]]) {
  await page.setViewportSize({ width: w, height: hgt });
  await page.goto(BASE + '/#A%20much%20longer%20message%20that%20must%20wrap%20onto%20several%20lines%0Aand%20keep%20breaks&ratio=4:3&font=1');
  await settle(700);
  info = await blockInfo();
  check(`fit ${w}x${hgt} ratio 4:3`, !!info && info.inside && info.fill > 0.85, JSON.stringify(info));
  const box = await page.evaluate(() => {
    const r = document.querySelector('.bw-box').getBoundingClientRect();
    return r.width / r.height;
  });
  check(`ratio box ${w}x${hgt}`, Math.abs(box - 4 / 3) < 0.02, String(box));
}
await shot('viewer-ratio');
await page.setViewportSize({ width: 1280, height: 720 });

// size-max and size-min
await page.goto(BASE + '/#Hi&size-max=50');
await settle();
info = await blockInfo();
check('size-max caps', info?.fontSize === 50, String(info?.fontSize));
await page.goto(BASE + '/#' + 'word%20'.repeat(400) + '&size-min=40');
await settle();
const scrollable = await page.evaluate(() =>
  [...document.querySelectorAll('.bw-stage *')].some((e) => /auto|scroll/.test(getComputedStyle(e).overflow)),
);
info = await blockInfo();
check('size-min holds the size without scrolling', !scrollable && info?.fontSize === 40, String(info?.fontSize));

// Slides rotate
await page.goto(BASE + '/#One||Two||Three&interval=1');
await settle(300);
const first = (await blockInfo())?.text;
await page.waitForTimeout(1500);
const second = (await blockInfo())?.text;
check('slides rotate', first === 'One' && second !== 'One', `${first} → ${second}`);
await page.goto(BASE + '/#One||Two||Three&interval=0.3&trans=none');
await settle(100);
const seen = await page.evaluate(
  () =>
    new Promise((done) => {
      const texts = new Set();
      let most = 0;
      const t0 = performance.now();
      const step = () => {
        const shown = [...document.querySelectorAll('.bw-slide')].filter((s) => !s.hidden);
        most = Math.max(most, shown.length);
        shown.forEach((s) => texts.add(s.textContent));
        if (performance.now() - t0 < 1000) requestAnimationFrame(step);
        else done({ texts: texts.size, most });
      };
      step();
    }),
);
check('trans=none cuts between decimal-interval slides', seen.texts === 3 && seen.most === 1, JSON.stringify(seen));
check('escaped || not split', await (async () => {
  await page.goto(BASE + '/#a\\||b');
  await settle();
  return (await page.locator('.bw-slide').count()) === 1 && (await blockInfo())?.text === 'a||b';
})());

// Countdown
const future = new Date(Date.now() + (2 * 86400 + 3600 * 3 + 125) * 1000);
const pad = (n) => String(n).padStart(2, '0');
const iso = `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}T${pad(future.getHours())}:${pad(future.getMinutes())}:${pad(future.getSeconds())}`;
await page.goto(BASE + `/#Starts%20in%0A{countdown}&until=${iso}`);
await settle();
const cd = await page.locator('.bw-cd').textContent();
check('countdown label format', /^2d 03h 0[12]m \d\ds$/.test(cd), cd);
await page.goto(BASE + `/#{countdown}&until=${iso}&cdfmt=colon`);
await settle();
check('countdown colon format', /^02:03:0[12]:\d\d$/.test(await page.locator('.bw-cd').textContent()));
await page.goto(BASE + '/#{countdown}');
await settle();
check('{countdown} literal without until', (await blockInfo())?.text === '{countdown}');
await page.goto(BASE + '/#A||B%20{countdown}||C&until=2000-01-01T00:00:00&zero=hide');
await settle();
check('zero=hide drops countdown slides', (await page.locator('.bw-slide').count()) === 2);
await page.goto(BASE + '/#Wait%20{countdown}&until=2000-01-01T00:00:00&zero=Go!');
await settle();
check('zero=message replaces', (await blockInfo())?.text === 'Go!');
await page.goto(BASE + '/#Wait%20{countdown}&until=2000-01-01T00:00:00&zero=**Back%20to%0Awork!**');
await settle();
const zeroLines = await page.evaluate(() => [...document.querySelectorAll('.bw-slide:not([hidden]) .bw-line')].map((l) => l.querySelector('.bw-b')?.textContent));
check('zero message keeps line breaks and formatting', JSON.stringify(zeroLines) === '["Back to","work!"]', JSON.stringify(zeroLines));
await page.goto(BASE + '/#{countdown}&timer=4h');
await settle();
const tm = await page.locator('.bw-cd').textContent();
check('timer counts down from its length', /^(4h 00m 00s|3h 59m 5\ds)$/.test(tm), tm);
await page.goto(BASE + '/#{countdown}&timer=1h&until=2000-01-01T00:00:00&zero=Go!');
await settle();
check('first of timer and until wins', /^(1h 00m 00s|59m 5\ds)$/.test(await page.locator('.bw-cd').textContent()));
await page.goto(BASE + '/#Wait%20{countdown}&timer=2s&zero=Done!');
await page.waitForTimeout(3500);
check('timer reaches zero', (await blockInfo())?.text === 'Done!', (await blockInfo())?.text);

// QR
await page.goto(BASE + '/#Scan&qr=https://example.com/a?b=1%26c=2&qrpos=below');
await page.waitForSelector('.bw-qr svg', { timeout: 3000 }).catch(() => null);
check('QR renders', (await page.locator('.bw-qr svg path').count()) === 1);
await shot('viewer-qr');
const qrWidth = () => page.locator('.bw-qr').evaluate((e) => e.getBoundingClientRect().width);
const defaultQr = await qrWidth();
await page.goto(BASE + '/#Join&qr=WIFI:T:WPA;S:Guest;P:sunshine;;&qrsize=50');
await page.waitForSelector('.bw-qr svg', { timeout: 3000 }).catch(() => null);
check('qrsize=50 draws a code twice the default size', Math.abs((await qrWidth()) - 2 * defaultQr) <= 2, `${defaultQr} → ${await qrWidth()}`);

// Animations
for (const anim of ['pulse', 'scroll', 'crawl', 'typewriter', 'rainbow']) {
  await page.goto(BASE + `/#Animated%20text&anim=${anim}&size-max=30vh`);
  await settle(600);
  const ok = await page.evaluate((a) => {
    const block = document.querySelector('.bw-block');
    if (a === 'typewriter') return document.querySelectorAll('.bw-ch').length > 0;
    return block.getAnimations().length > 0;
  }, anim);
  check(`anim ${anim} running`, ok);
}

// Fonts lazy-load only when used
// Each check uses a fresh document, since registered fonts persist across fragment changes.
const fontRequests = [];
page.on('request', (r) => r.url().includes('/fonts/') && fontRequests.push(r.url()));
await page.goto('about:blank');
await page.goto(BASE + '/#Plain');
await settle();
check('no font downloads for font=0', fontRequests.length === 0, fontRequests.join(', '));
await page.goto('about:blank');
await page.goto(BASE + '/#Bebas&font=4');
await settle(800);
check('font=4 loads from own origin', fontRequests.some((u) => u.startsWith(BASE) && u.includes('bebas-neue')));

// Editor
await page.goto(BASE + '/editor');
await settle();
check('editor starter message', (await page.getByRole('textbox', { name: 'Message', exact: true }).inputValue()) === 'Hello, **world**!');
check('editor title', (await page.title()) === 'Editor · BIGWORDS.PAGE', await page.title());
await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Edited & done');
await settle();
check('editor updates URL', page.url() === BASE + '/editor#Edited%20%26%20done', page.url());
// Open viewer stays in the tab and Back returns to the edits; the icon next
// to it opens a new tab.
check('new-tab icon opens a new tab', (await page.getByRole('link', { name: 'Open viewer in a new tab' }).getAttribute('target')) === '_blank');
await page.getByRole('link', { name: 'Open viewer', exact: true }).click();
await settle();
check('Open viewer shows the display in the same tab', page.url() === BASE + '/#Edited%20%26%20done' && (await page.locator('.bw-block').textContent()) === 'Edited & done', page.url());
await page.goBack();
await settle();
check('Back returns to the editor', (await page.getByRole('textbox', { name: 'Message', exact: true }).inputValue()) === 'Edited & done', page.url());
// The URL field takes a pasted link (an installed app has no address bar).
const urlBox = page.getByRole('textbox', { name: 'Viewer URL' });
await urlBox.fill('https://example.com/#Pasted%20link&bg=ff0000');
await urlBox.press('Enter');
await settle();
check(
  'pasting a link into the URL field loads it',
  (await page.getByRole('textbox', { name: 'Message', exact: true }).inputValue()) === 'Pasted link' && page.url() === BASE + '/editor#Pasted%20link&bg=ff0000',
  page.url(),
);
await urlBox.fill('Edited%20%26%20done');
await urlBox.press('Enter');
await settle();
check('a bare fragment works too', (await urlBox.inputValue()) === BASE + '/#Edited%20%26%20done', await urlBox.inputValue());
// The animation picker writes anim=; set it back to none so the checks below
// see the URL without it.
const animPicker = page.locator('.editor-controls select[id^="anim-"]');
await animPicker.selectOption('pulse');
await page.locator('text=Copy URL').click();
await settle();
const clip = await page.evaluate(() => navigator.clipboard.readText());
check('copy URL copies viewer URL', clip === BASE + '/#Edited%20%26%20done&anim=pulse', clip);
await animPicker.selectOption('none');
await settle();
await page.locator('button[aria-label="Show QR code"]').click();
check('QR button opens a dialog with a code', await page.locator('dialog.qr-dialog[open] .qr-code svg').isVisible());
await page.keyboard.press('Escape');
check('QR dialog closes', !(await page.locator('dialog.qr-dialog').evaluate((d) => d.open)));
const qrForm = page.locator('details', { has: page.locator('summary', { hasText: 'QR code' }) });
await qrForm.locator('summary').click();
await qrForm.getByLabel('Type', { exact: true }).selectOption('wifi');
await qrForm.getByLabel('Network', { exact: true }).fill('Cafe;5G');
await qrForm.getByLabel('Password', { exact: true }).fill('pw');
await settle();
check('QR form builds a Wi-Fi code', page.url().includes('qr=WIFI:T:WPA;S:Cafe%5C;5G;P:pw%3B%3B'), page.url());
await qrForm.getByLabel('Type', { exact: true }).selectOption('email');
check('QR form marks optional fields', (await qrForm.locator('label', { hasText: 'Subject' }).innerText()).includes('optional') && !(await qrForm.locator('label', { hasText: 'To' }).first().innerText()).includes('optional'));
await page.evaluate(() => (location.hash = '#Call&qr=tel:+15551234567'));
await settle();
check('address bar QR edit fills the form', (await qrForm.getByLabel('Type', { exact: true }).inputValue()) === 'tel' && (await qrForm.getByLabel('Phone', { exact: true }).inputValue()) === '+15551234567');
await page.evaluate(() => (location.hash = '#From%20address%20bar&bg=123456'));
await settle();
check('address bar edit syncs controls', (await page.getByRole('textbox', { name: 'Message', exact: true }).inputValue()) === 'From address bar');
const cdForm = page.locator('details', { has: page.locator('summary', { hasText: 'Countdown or timer' }) });
await cdForm.locator('summary').click();
check('countdown is the default kind', (await cdForm.getByLabel('Ends at', { exact: true }).isVisible()) && !(await cdForm.getByLabel('Minutes', { exact: true }).isVisible()));
await cdForm.getByLabel('Ends at', { exact: true }).fill('2030-01-01T12:00');
await settle();
check('countdown field writes until', page.url().includes('until=2030-01-01T'), page.url());
await cdForm.getByRole('button', { name: /^Timer/ }).click();
await cdForm.getByLabel('Minutes', { exact: true }).fill('90');
await settle();
check('switching to timer swaps until for timer', page.url().includes('timer=1h30m') && !page.url().includes('until='), page.url());
check('timer hides the countdown field', !(await cdForm.getByLabel('Ends at', { exact: true }).isVisible()));
await cdForm.getByLabel('Minutes', { exact: true }).blur();
check('timer fields normalize on leave', (await cdForm.getByLabel('Hours', { exact: true }).inputValue()) === '1' && (await cdForm.getByLabel('Minutes', { exact: true }).inputValue()) === '30');
await cdForm.getByRole('button', { name: /^Countdown/ }).click();
await settle();
check('switching back restores until', page.url().includes('until=2030-01-01T') && !page.url().includes('timer='), page.url());
await page.evaluate(() => (location.hash = '#{countdown}&timer=5m&until=2000-01-01T00:00:00Z'));
await settle();
check('editor drops the until that lost', !page.url().includes('until=') && page.url().includes('timer=5m'), page.url());
await page.locator('.font-btn').nth(4).click();
await settle();
check('font picker writes font=4', page.url().includes('font=4'), page.url());
await page.getByRole('textbox', { name: 'Message', exact: true }).fill('One||Two||Three');
await settle();
check('slide manager lists slides', (await page.locator('.slides li').count()) === 3);
await page.locator('.slides li').nth(2).getByRole('button', { name: /up/ }).click();
await settle();
check('slide reorder', (await page.getByRole('textbox', { name: 'Message', exact: true }).inputValue()) === 'One||Three||Two');
await shot('editor');
await page.setViewportSize({ width: 390, height: 844 });
await settle();
await shot('editor-mobile');
const hscroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
check('editor mobile has no horizontal scroll', !hscroll);
await page.setViewportSize({ width: 1280, height: 720 });

// Docs
await page.goto(BASE + '/docs');
await settle();
check('docs render', (await page.locator('.docs h2').count()) > 8);
check('docs title', (await page.title()) === 'Docs: URL reference · BIGWORDS.PAGE', await page.title());
await shot('docs');

// SEO: per-page metadata, robots.txt, sitemap.xml. Pass the SITE_URL the
// build used; without it, the absolute-URL tags and the sitemap are left out.
const SITE = process.env.SITE_URL ? new URL(process.env.SITE_URL).origin : '';
for (const [path, canonical] of [['/', '/'], ['/editor', '/editor'], ['/docs', '/docs'], ['/#Hello', '/']]) {
  await page.goto(BASE + path);
  const meta = await page.evaluate(() => ({
    canonical: document.querySelector('link[rel=canonical]')?.getAttribute('href'),
    image: document.querySelector('meta[property="og:image"]')?.getAttribute('content'),
    description: document.querySelector('meta[name=description]')?.getAttribute('content'),
    titles: document.querySelectorAll('title').length,
  }));
  const urls = SITE ? meta.canonical === SITE + canonical && meta.image === `${SITE}/og.png` : meta.canonical === undefined && meta.image === undefined;
  check(`metadata ${path}`, urls && !!meta.description && meta.titles === 1, JSON.stringify(meta));
}
const jsonLd = await page.request.get(BASE + '/').then((r) => r.text()).then((html) => html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)?.[1]);
check(SITE ? 'home JSON-LD parses' : 'no JSON-LD without SITE_URL', SITE ? (() => { try { return JSON.parse(jsonLd)['@graph'].length === 2; } catch { return false; } })() : jsonLd === undefined);
for (const path of ['/robots.txt', '/og.png', '/apple-touch-icon.png']) {
  check(`${path} served`, (await page.request.get(BASE + path)).ok());
}
check(SITE ? '/sitemap.xml served' : 'no sitemap without SITE_URL', (await page.request.get(BASE + '/sitemap.xml')).ok() === !!SITE);

// Unknown paths are real 404s with a noindex page; a mistyped display path
// still offers the display.
let resp = await page.goto(BASE + '/nope');
check('unknown path is 404', resp.status() === 404, String(resp.status()));
check('404 page renders', (await page.locator('main h1').textContent()) === 'Page not found' && (await page.title()) === 'Page not found · BIGWORDS.PAGE', await page.title());
check('404 page noindex', (await page.locator('meta[name=robots]').getAttribute('content')) === 'noindex');
resp = await page.goto(BASE + '/nope#Hello%20World');
await settle();
check('404 offers the display', (await page.locator('a', { hasText: 'Open this display' }).getAttribute('href')) === '/#Hello%20World');
for (const path of ['/', '/editor', '/docs']) {
  check(`${path} is 200`, (await page.request.get(BASE + path)).status() === 200);
}

// The docs read without JavaScript, styled.
const noJs = await browser.newContext({ javaScriptEnabled: false });
const noJsPage = await noJs.newPage();
await noJsPage.goto(BASE + '/docs');
check('docs prerendered without JS', (await noJsPage.locator('.docs h1').count()) === 1 && (await noJsPage.locator('.docs h2').count()) > 8);
check('prerendered docs styled', (await noJsPage.evaluate(() => getComputedStyle(document.querySelector('.docs')).maxWidth)) === '860px');
await noJsPage.goto(BASE + '/nope');
check('404 page prerendered and styled', (await noJsPage.locator('.docs h1').textContent()) === 'Page not found' && (await noJsPage.evaluate(() => getComputedStyle(document.querySelector('.docs')).maxWidth)) === '860px');
await noJsPage.goto(BASE + '/');
check('home prerendered without JS', (await noJsPage.locator('.hero h1').count()) === 1 && (await noJsPage.locator('.example').count()) === 12 && (await noJsPage.locator('.example:visible').count()) === 8);
check('prerendered home styled', (await noJsPage.evaluate(() => getComputedStyle(document.querySelector('.home')).maxWidth)) === '1080px');
await noJs.close();

// A display link must never show the prerendered home page, even before the
// app's script has loaded. Blocking the script freezes the page in that state.
// Pages get the Caddyfile's CSP, which must allow the inline guard.
const csp = readFileSync(new URL('../Caddyfile', import.meta.url), 'utf8').match(/Content-Security-Policy "([^"]+)"/)[1];
const slow = await browser.newContext();
await slow.route(/\/(src|assets)\/.*\.(js|ts)(\?.*)?$/, (route) => route.abort());
await slow.route(/\/(#.*)?$/, async (route) => {
  const response = await route.fetch();
  await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp } });
});
const slowPage = await slow.newPage();
const cspErrors = [];
slowPage.on('console', (m) => /Content Security Policy/i.test(m.text()) && cspErrors.push(m.text()));
await slowPage.goto(BASE + '/#Hello');
check('display link hides the home page before JS', !(await slowPage.locator('.hero').isVisible()));
await slowPage.goto(BASE + '/');
check('home page shows before JS', await slowPage.locator('.hero').isVisible());
check('CSP allows the display guard', cspErrors.length === 0, cspErrors.join(' | '));
await slow.close();

// Install and offline: the manifest, then every page from the service
// worker's cache with the network off.
const manifest = await (await fetch(BASE + '/manifest.webmanifest')).json();
check('manifest opens the editor fullscreen', manifest.start_url === '/editor' && manifest.display === 'fullscreen', `${manifest.start_url} ${manifest.display}`);
// The images the manifest lists exist at the sizes it gives (PNG width and
// height are bytes 16-23), and the screenshots meet Chrome's rules for the
// richer install dialog.
for (const img of [...manifest.icons, ...manifest.screenshots]) {
  const res = await fetch(BASE + img.src);
  const png = Buffer.from(await res.arrayBuffer());
  const size = res.ok && img.type === 'image/png' ? `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}` : String(res.status);
  check(`manifest image ${img.src}`, img.sizes === 'any' || size === img.sizes, size);
}
for (const form of ['wide', 'narrow']) {
  const sizes = manifest.screenshots.filter((s) => s.form_factor === form).map((s) => s.sizes.split('x').map(Number));
  const ok = sizes.length > 0 && sizes.every(([w, h]) => Math.min(w, h) >= 320 && Math.max(w, h) <= 3840 && Math.max(w, h) / Math.min(w, h) <= 2.3 && w * sizes[0][1] === h * sizes[0][0]);
  check(`${form} screenshots meet Chrome's rules`, ok, JSON.stringify(sizes));
}
// Chrome's own verdict on the manifest and the install requirements.
const cdp = await ctx.newCDPSession(page);
await page.goto(BASE + '/');
const { errors: manifestErrors } = await cdp.send('Page.getAppManifest');
check('manifest has no errors', manifestErrors.length === 0, JSON.stringify(manifestErrors));
// Playwright's contexts are incognito windows, where Chrome never installs.
const installabilityErrors = (await cdp.send('Page.getInstallabilityErrors')).installabilityErrors.filter((e) => e.errorId !== 'in-incognito');
check('site is installable', installabilityErrors.length === 0, JSON.stringify(installabilityErrors));
await cdp.detach();
const off = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const offPage = await off.newPage();
offPage.on('pageerror', (e) => errors.push(String(e)));
// Requests that fail while offline, for the details of a failed check.
const offFailed = [];
offPage.on('requestfailed', (r) => offFailed.push(new URL(r.url()).pathname));
const missing = () => (offFailed.length ? `failed: ${[...new Set(offFailed)].join(', ')}` : '');
// The docs page is the first visit, so the fonts the home page's examples use
// haven't loaded: offline, they must come from the worker's cache.
await offPage.goto(BASE + '/docs');
check('service worker installs', await offPage.evaluate(() => navigator.serviceWorker.ready.then((r) => !!r.active)));
await off.setOffline(true);
// Each page is a full load (from about:blank), not a change of the # alone,
// so every file it needs comes from the cache.
const offline = async (path) => {
  await offPage.goto('about:blank');
  await offPage.goto(BASE + path);
  await offPage.evaluate(() => document.fonts.ready);
  await offPage.waitForTimeout(400);
};
await offline('/#Offline&font=6');
check('offline display renders', (await offPage.locator('.bw-block').textContent()) === 'Offline', missing());
check(
  'offline display loads its font',
  await offPage.evaluate(() => [...document.fonts].some((f) => f.family.includes('caveat') && f.status === 'loaded')),
  missing(),
);
await offline('/editor');
check('offline editor renders', (await offPage.getByRole('textbox', { name: 'Message', exact: true }).count()) === 1, missing());
await offline('/docs');
check('offline docs render', (await offPage.locator('.docs h2').count()) > 8, missing());
await offline('/nope');
check('offline unknown path shows not found', (await offPage.locator('.docs h1').textContent()) === 'Page not found', missing());
await off.close();

// A file loaded on demand that's gone (renamed by a later deploy) reloads
// the page once to get the current version, and never loops.
const stale = await browser.newContext({ serviceWorkers: 'block' });
await stale.route(/\/assets\/qr-[^/]*\.js$/, (route) => route.abort());
const stalePage = await stale.newPage();
let loads = 0;
stalePage.on('load', () => loads++);
await stalePage.goto(BASE + '/#Scan&qr=https://example.com');
await stalePage.waitForTimeout(2000);
check('missing on-demand file reloads the page once', loads === 2, `${loads} loads`);
await stale.close();

check('no console errors', errors.length === 0, errors.join(' | '));
await browser.close();
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
