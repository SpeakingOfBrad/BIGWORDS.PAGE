/**
 * On narrow screens the preview pane takes a share of the screen height. Mobile
 * browsers change the viewport height (and even svh) as their address bar
 * collapses, and the keyboard and pinch zoom change it too, so fix the height
 * in pixels and recompute it only on rotation. Rotation is detected from the
 * layout width (documentElement.clientWidth), which zooming and the keyboard
 * don't change, unlike window.innerWidth on iOS. While a field is focused or
 * the page is zoomed the window height isn't trustworthy, so the update waits.
 * Returns a cleanup function.
 */
export function lockPreviewHeight(): () => void {
  const root = document.documentElement;
  const vv = window.visualViewport;
  let lastWidth = -1;
  let retry = 0;
  const unreliable = () => {
    const active = document.activeElement;
    const typing = !!active && active.matches('input, textarea, select, [contenteditable]');
    return typing || (vv?.scale ?? 1) > 1.01;
  };
  const update = () => {
    const width = root.clientWidth;
    if (width === lastWidth) return;
    if (lastWidth !== -1 && unreliable()) return; // tried again on blur or zoom-out
    lastWidth = width;
    root.style.setProperty('--editor-pane-h', `${Math.round(window.innerHeight * 0.46)}px`);
  };
  // Give the keyboard time to close before measuring again.
  const onBlur = () => {
    clearTimeout(retry);
    retry = window.setTimeout(update, 400);
  };
  update();
  window.addEventListener('resize', update);
  vv?.addEventListener('resize', update);
  document.addEventListener('focusout', onBlur);
  return () => {
    clearTimeout(retry);
    window.removeEventListener('resize', update);
    vv?.removeEventListener('resize', update);
    document.removeEventListener('focusout', onBlur);
    root.style.removeProperty('--editor-pane-h');
  };
}

/**
 * On narrow screens the preview is pinned to the top. With the keyboard open
 * there isn't room for the full-size preview and the field being typed in, and
 * iOS parked the message box under the preview, hidden. While a field is
 * focused: shrink the preview to about 40% of the visible area (hiding the URL
 * row), then scroll the field to just below it if it's covered by the preview
 * or the keyboard. Returns a cleanup function.
 */
export function keepFocusedFieldVisible(): () => void {
  const root = document.documentElement;
  const narrow = window.matchMedia('(max-width: 860px)');
  const vv = window.visualViewport;
  const GAP = 12;
  let timers: number[] = [];
  let typingHeight = Infinity;
  const isField = (el: Element | null): el is HTMLElement =>
    !!el && el.matches('input, textarea, select') && !!el.closest('.editor-controls');
  const PANE_PADDING = 10;
  const compact = () => {
    const frame = document.querySelector<HTMLElement>('.preview-frame');
    if (!frame) return;
    // Remember the full-size frame so the compact one is an exact scaled-down
    // copy of it (same proportions, same line breaks, no refit).
    if (!root.classList.contains('editor-typing')) {
      const r = frame.getBoundingClientRect();
      root.style.setProperty('--editor-frame-w', `${r.width}px`);
      root.style.setProperty('--editor-frame-h', `${r.height}px`);
    }
    const frameH = parseFloat(root.style.getPropertyValue('--editor-frame-h')) || frame.getBoundingClientRect().height;
    const visible = vv?.height ?? window.innerHeight;
    // Only ever shrink while typing, so the keyboard animating in doesn't
    // make the preview bounce.
    typingHeight = Math.min(typingHeight, Math.max(140, Math.round(visible * 0.4)));
    const scale = Math.min(1, (typingHeight - 2 * PANE_PADDING) / frameH);
    root.style.setProperty('--editor-pane-typing-h', `${typingHeight}px`);
    root.style.setProperty('--editor-frame-scale', String(scale));
    root.classList.add('editor-typing');
  };
  const reveal = () => {
    const field = document.activeElement;
    if (!narrow.matches || !isField(field)) return;
    compact();
    const pane = document.querySelector('.editor-preview');
    if (!pane) return;
    // Visible band: below the pinned preview and above the keyboard.
    const visTop = Math.max(pane.getBoundingClientRect().bottom, vv?.offsetTop ?? 0) + GAP;
    const visBottom = (vv ? vv.offsetTop + vv.height : window.innerHeight) - GAP;
    const r = field.getBoundingClientRect();
    const fits = r.bottom - r.top <= visBottom - visTop;
    const covered = r.top < visTop || (fits ? r.bottom > visBottom : r.top > visBottom - 40);
    if (covered) window.scrollBy(0, r.top - visTop);
  };
  // The keyboard animates in, so check a few times while it settles.
  const onFocus = () => {
    timers.forEach(clearTimeout);
    timers = [50, 350, 700].map((ms) => window.setTimeout(reveal, ms));
  };
  // Restore the full preview once focus has really left the fields (moving
  // between fields fires focusout then focusin).
  const onBlur = (e: FocusEvent) => {
    const left = e.target as HTMLElement;
    window.setTimeout(() => {
      if (isField(document.activeElement) || !root.classList.contains('editor-typing')) return;
      typingHeight = Infinity;
      root.classList.remove('editor-typing');
      // The full-size preview grows back over the field that was just edited;
      // keep that field in view below it.
      requestAnimationFrame(() => {
        const pane = document.querySelector('.editor-preview');
        if (!pane || !left.isConnected) return;
        const below = pane.getBoundingClientRect().bottom + GAP;
        const top = left.getBoundingClientRect().top;
        if (top < below) window.scrollBy(0, top - below);
      });
    }, 100);
  };
  document.addEventListener('focusin', onFocus);
  document.addEventListener('focusout', onBlur);
  vv?.addEventListener('resize', reveal);
  return () => {
    timers.forEach(clearTimeout);
    document.removeEventListener('focusin', onFocus);
    document.removeEventListener('focusout', onBlur);
    vv?.removeEventListener('resize', reveal);
    root.classList.remove('editor-typing');
    for (const v of ['--editor-pane-typing-h', '--editor-frame-w', '--editor-frame-h', '--editor-frame-scale']) root.style.removeProperty(v);
  };
}
