// Detects clipped glyph ink against a running preview (npm run preview):
// renders each case normally and with clipping disabled; any pixel difference
// means ink was cut off at the edge of the text area.
// Usage: node scripts/clipcheck.mjs ["WIDTH|HEIGHT|fragment" ...]
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
// CHROMIUM_PATH points at a system Chromium; otherwise Playwright uses its own.
const executablePath = process.env.CHROMIUM_PATH && existsSync(process.env.CHROMIUM_PATH) ? process.env.CHROMIUM_PATH : undefined;
const b = await chromium.launch({ executablePath });
const DEFAULT_CASES = [
  '660|240|Hello,%20**world!**&font=6',
  '390|844|Hello,%20**world!**&font=6',
  '800|450|Wavy%20f&font=6',
  '800|450|**Huff!**%20*puff*&font=6',
  '500|800|*Fluffy%20gifts*%0A%23%23%20for%20jolly%20folk&font=6',
  '800|450|%23%20Wolf%20pack&font=6',
  '800|450|*Italic%20f*&font=2',
  '390|844|*The%20quick%20brown%20fox%20jumps*&font=3',
  '800|450|*f*&font=0',
  '800|450|f&font=6', // measured before Caveat loads; must re-measure after
  '443|300|%E2%80%98Hello%E2%80%99;%0A**world!**&font=6',
];
const cases = process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_CASES;
let clipped = 0;
for (const c of cases) {
  const [w, h, frag] = c.split('|');
  const shot = async (css) => {
    const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2 });
    await p.goto('http://localhost:4173/#' + frag);
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(500);
    // Typewriter: compare the fully typed state, not a moment mid-animation.
    await p.waitForFunction(() => !document.querySelector('.bw-ch') || !document.querySelector('.bw-hidden'), null, { timeout: 10000 });
    if (css) await p.addStyleTag({ content: css });
    await p.waitForTimeout(100);
    const png = (await p.screenshot()).toString('base64');
    const pad = await p.evaluate(() => document.querySelector('.bw-block').style.padding);
    await p.close();
    return { png, pad };
  };
  const a = await shot(process.env.CLIP_EXTRA_CSS ?? '');
  const v = await shot((process.env.CLIP_EXTRA_CSS ?? '') + '.bw-box,.bw-area,.bw-slide{overflow:visible!important}');
  const p = await b.newPage();
  const n = await p.evaluate(async ([a, c]) => {
    const load = async (d) => { const i = new Image(); i.src = 'data:image/png;base64,' + d; await i.decode(); const cv = document.createElement('canvas'); cv.width = i.width; cv.height = i.height; const x = cv.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, i.width, i.height).data; };
    const A = await load(a), C = await load(c);
    let n = 0; for (let k = 0; k < A.length; k += 4) if (Math.abs(A[k] - C[k]) > 30) n++;
    return n;
  }, [a.png, v.png]);
  await p.close();
  if (n) clipped++;
  console.log(`${n ? 'CLIPPED' : 'ok     '} ${String(n).padStart(6)} px  ${w}x${h}  ${frag}  pad=[${a.pad}]`);
}
await b.close();
process.exit(clipped ? 1 : 0);
