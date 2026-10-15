import { h } from '../../chrome';
import { group, row, type EditorContext } from '../context';

/** Whether the display keeps the screen awake. */
export function screenSection(ctx: EditorContext): HTMLElement {
  const { set, onSync } = ctx;
  const screenGroup = group(ctx, 'Screen', true, () => !ctx.settings().wake);
  const wake = h('input', { type: 'checkbox' });
  wake.addEventListener('change', () => set('wake', wake.checked ? '' : 'off'));
  onSync(() => {
    wake.checked = ctx.settings().wake;
  });
  screenGroup.append(row(h('label', { class: 'check' }, wake, 'Keep the screen awake while showing')));
  return screenGroup;
}
