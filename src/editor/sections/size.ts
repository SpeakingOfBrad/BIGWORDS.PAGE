import { h } from '../../chrome';
import { formatSize, parseSize, type SizeUnit } from '../../state/size';
import { group, label, options, row, uid, type EditorContext } from '../context';

/** Auto-fit or a fixed size, and the limits on auto-fit. */
export function sizeSection(ctx: EditorContext): HTMLElement {
  const { get, set, syncAll, onSync } = ctx;
  const sizeGroup = group(ctx, 'Size');
  const autoSize = h('input', { type: 'checkbox' });
  const limitRows: HTMLElement[] = [];
  const sizeRow = (key: 'size' | 'size-min' | 'size-max', name: string) => {
    const num = h('input', { type: 'number', min: '0', step: 'any', id: uid(key), placeholder: key === 'size' ? 'auto' : 'none' });
    const unit = options(h('select', { 'aria-label': `${name} unit` }), ['px', 'vh', 'vw']);
    // Empty or 0 means unset. For the fixed size, that is auto-fit.
    const write = () => {
      const n = parseFloat(num.value);
      set(key, n > 0 ? formatSize({ value: n, unit: unit.value as SizeUnit }) : '');
      if (key === 'size') showAuto();
    };
    // While typing, the field keeps what was typed, even an unset 0. Enter or
    // leaving the field shows the value in use: empty, and for the fixed
    // size disabled, once it is unset.
    let typing = false;
    num.addEventListener('input', () => {
      typing = true;
      write();
    });
    unit.addEventListener('change', write);
    num.addEventListener('change', () => {
      typing = false;
      syncAll();
    });
    onSync(() => {
      const raw = get(key);
      const parsed = raw.toLowerCase() === 'auto' ? null : parseSize(raw);
      if (!typing) num.value = parsed ? String(parsed.value) : '';
      unit.value = parsed?.unit ?? unit.value;
      if (key === 'size') num.disabled = unit.disabled = !parsed && !typing;
    });
    const r = row(label(name, num.id), num, unit);
    if (key !== 'size') limitRows.push(r);
    return r;
  };
  // The minimum and maximum only bound auto-fit; a fixed size is used as is.
  const showAuto = () => {
    const auto = ctx.settings().size === null;
    autoSize.checked = auto;
    limitRows.forEach((r) => r.querySelectorAll('input, select').forEach((c) => ((c as HTMLInputElement).disabled = !auto)));
  };
  autoSize.addEventListener('change', () => {
    set('size', autoSize.checked ? '' : '10vh');
    syncAll();
  });
  onSync(showAuto);
  sizeGroup.append(
    row(h('label', { class: 'check' }, autoSize, 'Auto-fit to the screen')),
    sizeRow('size', 'Fixed size'),
    sizeRow('size-min', 'Minimum'),
    sizeRow('size-max', 'Maximum'),
    h('p', { class: 'hint' }, 'Minimum and maximum apply to auto-fit. Text never shrinks below the minimum, even if it runs off the screen. vh and vw are percent of screen height and width.'),
  );
  return sizeGroup;
}
