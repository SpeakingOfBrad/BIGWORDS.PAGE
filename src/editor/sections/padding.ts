import { h } from '../../chrome';
import { formatPad, parsePad } from '../../state/params';
import { group, label, row, uid, type EditorContext } from '../context';

/** Padding, the same on every side or per side. */
export function paddingSection(ctx: EditorContext): HTMLElement {
  const { get, set, syncAll, onSync } = ctx;
  const padGroup = group(ctx, 'Padding');
  const padAll = h('input', { type: 'number', min: '0', max: '49', step: '0.5', id: uid('pad') });
  const perSide = h('input', { type: 'checkbox' });
  const sideNames = ['Top', 'Right', 'Bottom', 'Left'];
  const sideInputs = sideNames.map(() => h('input', { type: 'number', min: '0', max: '49', step: '0.5' }));
  const sidesBox = h('div', { class: 'pad-sides' }, ...sideInputs.map((inp, i) => h('label', {}, sideNames[i], inp)));
  const writePad = (vals: number[]) => {
    if (vals.some((v) => !(v >= 0 && v < 50))) return;
    set('pad', formatPad(vals));
  };
  padAll.addEventListener('input', () => {
    const v = parseFloat(padAll.value);
    writePad([v, v, v, v]);
  });
  sideInputs.forEach((inp) => inp.addEventListener('input', () => writePad(sideInputs.map((s) => parseFloat(s.value)))));
  perSide.addEventListener('change', () => {
    sidesBox.hidden = !perSide.checked;
    padAll.disabled = perSide.checked;
    if (!perSide.checked) {
      const v = parsePad(get('pad'))?.[0] ?? 5;
      writePad([v, v, v, v]);
      syncAll();
    }
  });
  onSync(() => {
    const p = ctx.settings().pad;
    const uniform = p.every((v) => v === p[0]);
    if (!uniform) perSide.checked = true;
    sidesBox.hidden = !perSide.checked;
    padAll.disabled = perSide.checked;
    if (document.activeElement !== padAll) padAll.value = String(p[0]);
    sideInputs.forEach((inp, i) => {
      if (document.activeElement !== inp) inp.value = String(p[i]);
    });
  });
  padGroup.append(row(label('All sides %', padAll.id), padAll, h('label', { class: 'check' }, perSide, 'Per side')), sidesBox, h('p', { class: 'hint' }, 'Top and bottom are percent of the display height; left and right are percent of its width.'));
  return padGroup;
}
