import { h } from '../../chrome';
import { ensureFont, fontStack, FONT_NAMES } from '../../render/fonts';
import { group, type EditorContext } from '../context';

/** The font picker, with a sample of each font. */
export function fontSection(ctx: EditorContext): HTMLElement {
  const { set, syncAll, onSync } = ctx;
  const fontGroup = group(ctx, 'Font');
  const fontGrid = h('div', { class: 'font-grid', role: 'group', 'aria-label': 'Font' });
  const fontBtns = FONT_NAMES.map((name, i) => {
    // The editor shows real samples, so it loads each bundled font here.
    if (i > 0) void ensureFont(i);
    const btn = h('button', { class: 'font-btn', type: 'button', 'aria-pressed': 'false' }, h('span', { class: 'sample', style: `font-family:${fontStack(i).replace(/"/g, "'")}` }, 'Big Aa'), h('span', { class: 'name' }, `${i} · ${name}`));
    btn.addEventListener('click', () => {
      set('font', String(i));
      syncAll();
    });
    return btn;
  });
  fontGrid.append(...fontBtns);
  fontGroup.append(fontGrid);
  onSync(() => {
    const f = ctx.settings().font;
    fontBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === f)));
  });
  return fontGroup;
}
