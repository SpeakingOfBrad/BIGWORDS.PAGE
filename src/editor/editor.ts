import '../styles/editor.css';
import { h, siteHeader } from '../chrome';
import { serializeFragment } from '../state/fragment';
import { PARAM_ORDER, pruneDefaults, resolveSettings } from '../state/params';
import type { EditorContext } from './context';
import { linkLength, loadState, pastedHash } from './model';
import { preview } from './preview';
import { animationSection } from './sections/animation';
import { colorSection } from './sections/colors';
import { countdownSection } from './sections/countdown';
import { fontSection } from './sections/font';
import { imageSection } from './sections/image';
import { messageSection } from './sections/message';
import { paddingSection } from './sections/padding';
import { qrSection } from './sections/qr';
import { ratioSection } from './sections/ratio';
import { screenSection } from './sections/screen';
import { sizeSection } from './sections/size';
import { keepFocusedFieldVisible, lockPreviewHeight } from './viewport';

export function mountEditor(app: HTMLElement): { destroy(): void } {
  document.body.className = 'page-site page-editor';

  const syncers: (() => void)[] = [];
  const committers: (() => void)[] = [];
  const ctx: EditorContext = {
    state: loadState(location.hash),
    get: (k) => ctx.state.params[k] ?? '',
    set: (k, v) => {
      if (v.trim() === '') delete ctx.state.params[k];
      else ctx.state.params[k] = v;
      commit();
    },
    settings: () => resolveSettings(ctx.state),
    commit: () => commit(),
    syncAll: () => syncers.forEach((fn) => fn()),
    onSync: (fn) => syncers.push(fn),
    onCommit: (fn) => committers.push(fn),
  };

  const fragment = () => serializeFragment({ message: ctx.state.message, params: pruneDefaults(ctx.state.params) }, PARAM_ORDER);
  const viewerUrl = () => `${location.origin}/#${fragment()}`;

  const pane = preview(ctx, viewerUrl);
  const message = messageSection(ctx, pane.urlAdvice);
  const controls = h(
    'div',
    { class: 'editor-controls' },
    message.element,
    fontSection(ctx),
    colorSection(ctx),
    sizeSection(ctx),
    paddingSection(ctx),
    animationSection(ctx),
    ratioSection(ctx),
    countdownSection(ctx),
    qrSection(ctx),
    imageSection(ctx, pane.imgWarning),
    screenSection(ctx),
  );

  // ------------------------------------------------------------ commit / sync
  // Typing and dragging the color picker fire input events faster than the
  // preview can refit, so the preview updates at most once per frame. The
  // address bar is written at most every 150 ms: Safari throws once a page
  // calls replaceState about 100 times in a few seconds.
  let renderFrame = 0;
  let urlTimer = 0;
  const renderPreview = () => {
    renderFrame = 0;
    pane.display.update(ctx.settings());
  };
  const writeUrl = () => {
    urlTimer = 0;
    try {
      history.replaceState(history.state, '', `/editor#${fragment()}`);
    } catch {
      // Rate-limited; the next edit writes the URL again.
    }
  };
  // Leaving for the viewer: write the editor's URL now, so Back returns to
  // the latest edits.
  pane.openLink.addEventListener('click', () => {
    if (!urlTimer) return;
    clearTimeout(urlTimer);
    writeUrl();
  });
  function commit() {
    const frag = fragment();
    urlTimer ||= window.setTimeout(writeUrl, 150);
    renderFrame ||= requestAnimationFrame(renderPreview);
    const viewer = viewerUrl();
    pane.urlField.value = viewer;
    pane.openLink.href = `/#${frag}`;
    pane.openTabLink.href = pane.openLink.href;
    const n = viewer.length;
    const { level, advice } = linkLength(n);
    pane.urlCount.textContent = `${n.toLocaleString()} chars`;
    pane.urlCount.className = 'url-count' + (level === 'ok' ? '' : ` ${level}`);
    pane.urlAdvice.hidden = level === 'ok';
    pane.urlAdvice.textContent = advice;
    committers.forEach((fn) => fn());
  }

  const load = (hash: string) => {
    ctx.state = loadState(hash);
    ctx.syncAll();
    message.renderSlides();
    commit();
  };
  const onHashChange = () => load(location.hash);
  // A pasted link, or just its fragment.
  pane.urlField.addEventListener('change', () => load(pastedHash(pane.urlField.value)));
  pane.urlField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') pane.urlField.blur();
    else if (e.key === 'Escape') {
      pane.urlField.value = viewerUrl();
      pane.urlField.blur();
    }
  });
  window.addEventListener('hashchange', onHashChange);
  const unlockPreviewHeight = lockPreviewHeight();
  const stopKeepingFieldsVisible = keepFocusedFieldVisible();

  app.replaceChildren(siteHeader('editor'), h('main', { class: 'editor' }, pane.element, controls), pane.qrDialog);

  ctx.syncAll();
  message.renderSlides();
  commit();

  return {
    destroy() {
      window.removeEventListener('hashchange', onHashChange);
      // A pending write would put the editor's URL over the page being opened.
      clearTimeout(urlTimer);
      cancelAnimationFrame(renderFrame);
      unlockPreviewHeight();
      stopKeepingFieldsVisible();
      pane.display.destroy();
    },
  };
}
