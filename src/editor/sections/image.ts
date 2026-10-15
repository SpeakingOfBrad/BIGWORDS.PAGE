import { h } from '../../chrome';
import { IMG_POSITIONS } from '../../state/params';
import { group, label, options, row, uid, type EditorContext } from '../context';

const IMG_LABELS: Record<string, string> = { bg: 'Background (cover)', full: 'Full (contain)', above: 'Above text', below: 'Below text' };

/**
 * An image from a URL, where it goes, and how often the page reloads it.
 * `imgWarning` is the preview's notice that the image failed to load.
 */
export function imageSection(ctx: EditorContext, imgWarning: HTMLElement): HTMLElement {
  const { get, set, onSync } = ctx;
  const imgGroup = group(ctx, 'Image', true, () => !!get('img'));
  const imgInput = h('input', { type: 'url', class: 'grow', id: uid('img'), placeholder: 'https://…/image.jpg', spellcheck: 'false' });
  const imgpos = options(h('select', { id: uid('imgpos') }), IMG_POSITIONS, IMG_LABELS);
  const refresh = h('input', { type: 'number', min: '1', max: '86400', step: '1', id: uid('refresh'), placeholder: 'off' });
  imgInput.addEventListener('input', () => {
    imgWarning.hidden = true;
    set('img', imgInput.value.trim());
  });
  imgpos.addEventListener('change', () => set('imgpos', imgpos.value));
  refresh.addEventListener('input', () => set('refresh', /^\d+$/.test(refresh.value) && +refresh.value > 0 ? refresh.value : ''));
  onSync(() => {
    if (document.activeElement !== imgInput) imgInput.value = get('img');
    imgpos.value = ctx.settings().imgpos;
    if (document.activeElement !== refresh) refresh.value = get('refresh');
    if (!get('img')) imgWarning.hidden = true;
  });
  imgGroup.append(
    row(label('URL', imgInput.id), imgInput),
    row(label('Position', imgpos.id), imgpos),
    row(label('Reload every', refresh.id), refresh, 'seconds'),
    imgWarning,
    h('p', { class: 'hint' }, 'Some image hosts refuse to serve images to other sites. Reloading only matters if the image changes; the preview does not reload.'),
  );
  return imgGroup;
}
