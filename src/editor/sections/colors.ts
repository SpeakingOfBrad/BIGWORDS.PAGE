import { h } from '../../chrome';
import { group, row, type EditorContext } from '../context';

/** Background and text colors, each set or following the system scheme. */
export function colorSection(ctx: EditorContext): HTMLElement {
  const { get, set, commit, syncAll, onSync } = ctx;
  const colorGroup = group(ctx, 'Colors');
  const colorRow = (key: 'bg' | 'fg', name: string) => {
    const auto = h('input', { type: 'checkbox' });
    const picker = h('input', { type: 'color', 'aria-label': `${name} color picker` });
    const hex = h('input', { type: 'text', class: 'grow', maxlength: '7', placeholder: 'e.g. ffd60a', 'aria-label': `${name} hex`, spellcheck: 'false', autocomplete: 'off' });
    const sync = () => {
      const v = ctx.settings()[key];
      auto.checked = v === null;
      picker.disabled = hex.disabled = auto.checked;
      const fallback = key === 'bg' ? '000000' : 'ffffff';
      picker.value = '#' + (v ?? fallback);
      if (document.activeElement !== hex) hex.value = v ?? '';
    };
    auto.addEventListener('change', () => {
      if (auto.checked) set(key, '');
      else set(key, picker.value.slice(1));
      sync();
    });
    picker.addEventListener('input', () => {
      hex.value = picker.value.slice(1);
      set(key, hex.value);
    });
    hex.addEventListener('input', () => {
      const v = hex.value.trim().replace(/^#/, '');
      if (/^[0-9a-f]{6}$/i.test(v)) {
        picker.value = '#' + v.toLowerCase();
        set(key, v.toLowerCase());
      }
    });
    hex.addEventListener('blur', sync);
    onSync(sync);
    return row(h('span', { class: 'lbl' }, name), h('label', { class: 'check' }, auto, 'Auto'), picker, hex);
  };
  const swap = h('button', { class: 'btn btn-sm', type: 'button' }, 'Swap colors');
  swap.addEventListener('click', () => {
    const { bg, fg } = { bg: get('bg'), fg: get('fg') };
    if (fg) ctx.state.params.bg = fg;
    else delete ctx.state.params.bg;
    if (bg) ctx.state.params.fg = bg;
    else delete ctx.state.params.fg;
    commit();
    syncAll();
  });
  colorGroup.append(colorRow('bg', 'Background'), colorRow('fg', 'Text'), row(swap), h('p', { class: 'hint' }, 'Auto follows the viewer’s light or dark setting.'));
  return colorGroup;
}
