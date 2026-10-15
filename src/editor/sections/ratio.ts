import { h } from '../../chrome';
import { parseRatio } from '../../state/params';
import { group, label, row, uid, type EditorContext } from '../context';
import { ratioFromPixels } from '../model';

/** The display target: a ratio to show the display in, from presets, typed or from a pixel size. */
export function ratioSection(ctx: EditorContext): HTMLElement {
  const { get, set, syncAll, onSync } = ctx;
  const ratioGroup = group(ctx, 'Display target', true, () => !!get('ratio'));
  const ratioInput = h('input', { type: 'text', id: uid('ratio'), placeholder: 'Fill screen (e.g. 16:9)', class: 'grow', spellcheck: 'false' });
  const presets = ['', '16:9', '4:3', '1:1', '9:16', '21:9'];
  const presetBtns = presets.map((p) => {
    const b = h('button', { class: 'chip', type: 'button', 'aria-pressed': 'false' }, p || 'Fill');
    b.addEventListener('click', () => {
      set('ratio', p);
      syncAll();
    });
    return b;
  });
  const pxW = h('input', { type: 'number', min: '1', placeholder: '1920', 'aria-label': 'Width in pixels' });
  const pxH = h('input', { type: 'number', min: '1', placeholder: '1080', 'aria-label': 'Height in pixels' });
  const pxApply = h('button', { class: 'btn btn-sm', type: 'button' }, 'Use');
  pxApply.addEventListener('click', () => {
    const ratio = ratioFromPixels(+pxW.value, +pxH.value);
    if (!ratio) return;
    set('ratio', ratio);
    syncAll();
  });
  ratioInput.addEventListener('input', () => {
    const r = parseRatio(ratioInput.value);
    if (r) set('ratio', `${r[0]}:${r[1]}`);
    else if (!ratioInput.value.trim()) set('ratio', '');
    presetBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(get('ratio') === presets[i])));
  });
  onSync(() => {
    const r = ctx.settings().ratio;
    const v = r ? `${r[0]}:${r[1]}` : '';
    if (document.activeElement !== ratioInput) ratioInput.value = v;
    presetBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(v === presets[i])));
  });
  ratioGroup.append(
    h('div', { class: 'chips' }, ...presetBtns),
    row(label('Ratio', ratioInput.id), ratioInput),
    row(h('span', { class: 'lbl' }, 'Pixels'), pxW, '×', pxH, pxApply),
    h('p', { class: 'hint' }, 'Pixel sizes are reduced to a ratio (1920 × 1080 → 16:9); only the ratio goes in the URL. The dashed frame in the preview shows the region.'),
  );
  return ratioGroup;
}
