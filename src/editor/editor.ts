import '../styles/editor.css';
import { h, siteHeader, toast } from '../chrome';
import { Display } from '../render/display';
import { ensureFont, fontStack, FONT_NAMES } from '../render/fonts';
import { createQrSvg } from '../render/qr';
import { splitRawSlides } from '../render/text';
import { parseFragment, serializeFragment, type State } from '../state/fragment';
import {
  ANIMATIONS,
  CD_FORMATS,
  IMG_POSITIONS,
  PARAM_ORDER,
  QR_POSITIONS,
  QR_SIZE_MAX,
  QR_SIZE_MIN,
  SPEEDS,
  countdownSource,
  formatPad,
  formatTimer,
  parsePad,
  parseRatio,
  parseTimer,
  pruneDefaults,
  resolveSettings,
} from '../state/params';
import { QR_KINDS, WIFI_SECURITY, buildQr, parseQr, type QrFields, type QrKind } from '../state/qr-payload';
import { parseSize, formatSize, type SizeUnit } from '../state/size';

const STARTER: State = { message: 'Hello, **world**!', params: {} };
const URL_WARN = 1800;
const URL_LIMIT = 2000;
/** Above this many characters a QR code gets dense enough to be hard to scan from a screen. */
const QR_DENSE = 600;

const ANIM_LABELS: Record<string, string> = {
  none: 'None',
  pulse: 'Pulse',
  flash: 'Flash',
  shake: 'Shake',
  bounce: 'Bounce',
  scroll: 'Scroll (marquee)',
  crawl: 'Crawl (vertical)',
  typewriter: 'Typewriter',
  fadein: 'Fade in',
  rainbow: 'Rainbow',
};
const QR_LABELS: Record<string, string> = { tl: 'Top left', tr: 'Top right', bl: 'Bottom left', br: 'Bottom right', below: 'Below text' };
const QR_KIND_LABELS: Record<string, string> = { url: 'Link', wifi: 'Wi-Fi network', tel: 'Phone call', sms: 'Text/SMS', email: 'Email', geo: 'Location', text: 'Plain text' };
const QR_HINTS: Record<QrKind, string> = {
  url: 'Opens the link on the phone that scans it.',
  wifi: 'Phones that scan it offer to join the network. The password is in the link, so anyone with the link or a view of the screen can read it.',
  tel: 'Offers to call the number.',
  sms: 'Opens a new text message (SMS) to the number, with the message filled in for the sender to edit.',
  email: 'Opens a new email to the address, with the subject and message filled in.',
  geo: 'Opens the location in a maps app on Android. iPhone cameras may show it as text; for those, use a link to a map instead.',
  text: 'Shows the text on the phone that scans it.',
};
const IMG_LABELS: Record<string, string> = { bg: 'Background (cover)', full: 'Full (contain)', above: 'Above text', below: 'Below text' };

function options(select: HTMLSelectElement, values: readonly string[], labels: Record<string, string> = {}): HTMLSelectElement {
  for (const v of values) select.append(h('option', { value: v }, labels[v] ?? v));
  return select;
}

let idCounter = 0;
const uid = (p: string) => `${p}-${++idCounter}`;

/** A QR code icon: three finder squares and a few modules. */
function qrIcon(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  for (const [k, v] of Object.entries({ viewBox: '0 0 16 16', width: '18', height: '18', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'aria-hidden': 'true' })) svg.setAttribute(k, v);
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M2 2h4.5v4.5H2zM9.5 2H14v4.5H9.5zM2 9.5h4.5V14H2zM9.5 9.5h2v2h-2zM12.5 12.5H14V14h-1.5zM9.5 13h1M13 9.5h1');
  svg.append(path);
  return svg;
}

/** The "opens in a new tab" icon: a box with an arrow leaving its corner. */
function newTabIcon(): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  for (const [k, v] of Object.entries({ viewBox: '0 0 16 16', width: '14', height: '14', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(k, v);
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M9 2.5h4.5V7M13.5 2.5 7.5 8.5M12 9.5v3a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3');
  svg.append(path);
  return svg;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** A date as a datetime-local input value, in the editing device's time zone. */
function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** A datetime-local input value (local time) as a UTC `until` value. */
function localInputToUtc(v: string): string {
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toISOString().replace(/\.\d+Z$/, 'Z');
}

/**
 * `until` and `timer` are mutually exclusive and the first in the URL wins.
 * The editor writes params in a fixed order, so drop the one that lost before
 * it could end up first.
 */
function loadState(hash: string): State {
  if (hash.length <= 1) return structuredClone(STARTER);
  const state = parseFragment(hash);
  const source = countdownSource(state.params);
  if (source === 'until') delete state.params.timer;
  if (source === 'timer') delete state.params.until;
  return state;
}

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

async function copyText(text: string, fallbackInput?: HTMLInputElement): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (!fallbackInput) return false;
    fallbackInput.focus();
    fallbackInput.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    }
  }
}

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
function lockPreviewHeight(): () => void {
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
function keepFocusedFieldVisible(): () => void {
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

export function mountEditor(app: HTMLElement): { destroy(): void } {
  document.body.className = 'page-site page-editor';

  let state: State = loadState(location.hash);
  const syncers: (() => void)[] = [];
  const onSync = (fn: () => void) => syncers.push(fn);
  const syncAll = () => syncers.forEach((fn) => fn());

  const get = (k: string) => state.params[k] ?? '';
  const set = (k: string, v: string) => {
    if (v.trim() === '') delete state.params[k];
    else state.params[k] = v;
    commit();
  };

  // ------------------------------------------------------------ preview pane
  const previewStage = h('div');
  const imgWarning = h('p', { class: 'advisory', hidden: true });
  const display = new Display(previewStage, {
    editor: true,
    onImageError: (url) => {
      if (resolveSettings(state).img !== url) return;
      imgWarning.textContent = 'The image could not be loaded. The host may refuse to serve it to other sites, or the URL may be wrong. Viewers will see the display without it.';
      imgWarning.hidden = false;
    },
    onImageLoad: () => {
      imgWarning.hidden = true;
    },
  });
  // Editable, for pasting or fixing a link: an installed app has no address
  // bar. Enter or leaving the field loads it into the editor.
  const urlField = h('input', {
    class: 'url-field',
    type: 'text',
    inputmode: 'url',
    enterkeyhint: 'go',
    autocapitalize: 'off',
    autocorrect: 'off',
    spellcheck: 'false',
    'aria-label': 'Viewer URL',
  });
  const urlCount = h('span', { class: 'url-count' });
  // Open viewer shows the display in this tab, so an installed app stays in
  // its own window, and Back returns to the editor. The icon next to it opens
  // the display in a new tab.
  const openLink = h('a', {}, 'Open viewer');
  const openTabLink = h('a', { target: '_blank', rel: 'noopener', 'aria-label': 'Open viewer in a new tab', title: 'Open viewer in a new tab' }, newTabIcon());
  const openViewer = h('span', { class: 'btn btn-split' }, openLink, openTabLink);
  const qrBtn = h('button', { class: 'btn btn-icon', type: 'button', 'aria-haspopup': 'dialog', 'aria-label': 'Show QR code', title: 'Show QR code' }, qrIcon());
  const copyBtn = h('button', { class: 'btn btn-primary', type: 'button' }, 'Copy URL');
  const urlAdvice = h('p', { class: 'advisory', hidden: true });

  const fragment = () => serializeFragment({ message: state.message, params: pruneDefaults(state.params) }, PARAM_ORDER);
  const viewerUrl = () => `${location.origin}/#${fragment()}`;

  copyBtn.addEventListener('click', async () => {
    const ok = await copyText(viewerUrl(), urlField);
    toast(ok ? 'Viewer URL copied' : 'Copy failed: select the URL and copy it');
  });

  // Shows the viewer URL as a QR code, so a phone or tablet can open the
  // display by scanning it instead of typing the link.
  const qrCode = h('div', { class: 'qr-code' });
  const qrNote = h('p', { class: 'hint' });
  const qrClose = h('button', { class: 'btn', type: 'button' }, 'Close');
  const qrTitleId = uid('qrtitle');
  const qrDialog = h(
    'dialog',
    { class: 'qr-dialog', 'aria-labelledby': qrTitleId },
    h('h2', { id: qrTitleId }, 'Scan to open this display'),
    qrCode,
    qrNote,
    h('div', { class: 'qr-actions' }, qrClose),
  );
  qrClose.addEventListener('click', () => qrDialog.close());
  // A click on the backdrop lands on the dialog element itself.
  qrDialog.addEventListener('click', (e) => {
    if (e.target === qrDialog) qrDialog.close();
  });
  qrBtn.addEventListener('click', () => {
    const url = viewerUrl();
    const svg = createQrSvg(url);
    qrCode.replaceChildren(svg ?? '');
    qrCode.hidden = !svg;
    const n = url.length;
    qrNote.textContent = !svg
      ? 'This link is too long for a QR code. Shorten the message or remove the image to make one.'
      : n > QR_DENSE
        ? 'This link is long, so the code is dense. Hold the camera close, or shorten the message for a code that scans more easily.'
        : 'Point a phone or tablet camera at the code to open the display on it.';
    qrDialog.showModal();
  });

  // ------------------------------------------------------------ controls
  const controls = h('div', { class: 'editor-controls' });
  const group = (title: string, collapsible = false, isSet?: () => boolean) => {
    if (!collapsible) {
      const sec = h('section', { class: 'group' }, h('h3', {}, title));
      controls.append(sec);
      return sec;
    }
    const summaryLabel = h('span', {}, title);
    const det = h('details', { class: 'group' }, h('summary', {}, summaryLabel));
    if (isSet) {
      onSync(() => {
        const active = isSet();
        summaryLabel.classList.toggle('dotset', active);
        if (active) det.open = true;
      });
    }
    controls.append(det);
    return det;
  };
  const row = (...kids: (Node | string)[]) => h('div', { class: 'row' }, ...kids);
  const label = (text: string, forId: string) => h('label', { class: 'lbl', for: forId }, text);

  // --- Message
  const msgGroup = group('Message');
  const msgId = uid('msg');
  const textarea = h('textarea', { id: msgId, rows: '4', spellcheck: 'true', 'aria-label': 'Message' });
  textarea.addEventListener('input', () => {
    state.message = textarea.value;
    commit();
    renderSlides();
  });
  onSync(() => {
    if (textarea.value !== state.message) textarea.value = state.message;
  });

  const slideList = h('ol', { class: 'slides', 'aria-label': 'Slides' });
  const addSlide = h('button', { class: 'btn btn-sm', type: 'button' }, '+ Add slide');
  const insertCd = h('button', { class: 'btn btn-sm', type: 'button', title: 'Insert {countdown} at the cursor' }, '+ {countdown}');
  const intervalInput = h('input', { type: 'number', min: '1', max: '86400', step: '1', id: uid('interval') });
  const intervalRow = row(label('Seconds per slide', intervalInput.id), intervalInput);

  const setSlides = (slides: string[], focusIndex?: number) => {
    state.message = slides.join('||');
    commit();
    syncAll();
    renderSlides();
    if (focusIndex !== undefined) selectSlide(focusIndex);
  };
  const selectSlide = (i: number) => {
    const slides = splitRawSlides(state.message);
    let start = 0;
    for (let k = 0; k < i; k++) start += slides[k].length + 2;
    textarea.focus();
    textarea.setSelectionRange(start, start + (slides[i]?.length ?? 0));
  };
  function renderSlides() {
    const slides = splitRawSlides(state.message);
    intervalRow.hidden = slides.length < 2;
    slideList.hidden = slides.length < 2;
    slideList.replaceChildren(
      ...slides.map((src, i) => {
        const up = h('button', { class: 'icon-btn', type: 'button', title: 'Move up', 'aria-label': `Move slide ${i + 1} up`, disabled: i === 0 }, '↑');
        const down = h('button', { class: 'icon-btn', type: 'button', title: 'Move down', 'aria-label': `Move slide ${i + 1} down`, disabled: i === slides.length - 1 }, '↓');
        const del = h('button', { class: 'icon-btn', type: 'button', title: 'Delete', 'aria-label': `Delete slide ${i + 1}` }, '✕');
        const txt = h('button', { class: 'txt', type: 'button', title: 'Select in message' }, src.replace(/\n/g, ' ⏎ ') || '(empty)');
        up.addEventListener('click', () => {
          [slides[i - 1], slides[i]] = [slides[i], slides[i - 1]];
          setSlides(slides);
        });
        down.addEventListener('click', () => {
          [slides[i + 1], slides[i]] = [slides[i], slides[i + 1]];
          setSlides(slides);
        });
        del.addEventListener('click', () => {
          slides.splice(i, 1);
          setSlides(slides);
        });
        txt.addEventListener('click', () => selectSlide(i));
        return h('li', {}, h('span', { class: 'n' }, String(i + 1)), txt, up, down, del);
      }),
    );
  }
  addSlide.addEventListener('click', () => {
    const slides = splitRawSlides(state.message);
    slides.push('New slide');
    setSlides(slides, slides.length - 1);
  });
  insertCd.addEventListener('click', () => {
    const { selectionStart: a, selectionEnd: b, value } = textarea;
    textarea.value = value.slice(0, a) + '{countdown}' + value.slice(b);
    textarea.setSelectionRange(a + 11, a + 11);
    textarea.dispatchEvent(new Event('input'));
    textarea.focus();
  });
  intervalInput.addEventListener('input', () => set('interval', /^\d+$/.test(intervalInput.value) && +intervalInput.value > 0 ? intervalInput.value : ''));
  onSync(() => {
    intervalInput.value = String(resolveSettings(state).interval);
  });

  const cheats: [string, string][] = [
    ['**bold**  __bold__', 'Bold'],
    ['*italic*  _italic_', 'Italic'],
    ['~~struck~~', 'Strikethrough'],
    ['`code`', 'Code, shown exactly as typed'],
    ['# Title', 'Heading, 2× size (line start)'],
    ['## Subtitle', 'Heading, 1.5× size (line start)'],
    ['Enter', 'New line (%0A in the URL)'],
    ['||', 'Next slide'],
    ['{countdown}', 'Live countdown (set a target below)'],
    ['\\*  \\_  \\~  \\`  \\#  \\||  \\{  \\\\', 'Backslash shows the next character literally'],
  ];
  msgGroup.append(
    textarea,
    // Lives here rather than under the preview so it can't change the preview's size.
    urlAdvice,
    row(addSlide, insertCd),
    slideList,
    intervalRow,
    h(
      'details',
      { class: 'mini-details' },
      h('summary', {}, 'Formatting cheat sheet'),
      h('table', { class: 'cheats' }, h('tbody', {}, ...cheats.map(([a, b]) => h('tr', {}, h('td', {}, a), h('td', {}, b))))),
    ),
  );

  // --- Font
  const fontGroup = group('Font');
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
    const f = resolveSettings(state).font;
    fontBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(i === f)));
  });

  // --- Colors
  const colorGroup = group('Colors');
  const colorRow = (key: 'bg' | 'fg', name: string) => {
    const auto = h('input', { type: 'checkbox' });
    const picker = h('input', { type: 'color', 'aria-label': `${name} color picker` });
    const hex = h('input', { type: 'text', class: 'grow', maxlength: '7', placeholder: 'e.g. ffd60a', 'aria-label': `${name} hex`, spellcheck: 'false', autocomplete: 'off' });
    const sync = () => {
      const v = resolveSettings(state)[key];
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
    if (fg) state.params.bg = fg;
    else delete state.params.bg;
    if (bg) state.params.fg = bg;
    else delete state.params.fg;
    commit();
    syncAll();
  });
  colorGroup.append(colorRow('bg', 'Background'), colorRow('fg', 'Text'), row(swap), h('p', { class: 'hint' }, 'Auto follows the viewer’s light or dark setting.'));

  // --- Size
  const sizeGroup = group('Size');
  const autoSize = h('input', { type: 'checkbox' });
  const sizeRow = (key: 'size' | 'size-min' | 'size-max', name: string, def: number) => {
    const num = h('input', { type: 'number', min: '0', step: 'any', id: uid(key), placeholder: key === 'size' ? String(def) : 'none' });
    const unit = options(h('select', { 'aria-label': `${name} unit` }), ['px', 'vh', 'vw']);
    const write = () => {
      const n = parseFloat(num.value);
      if (!(n > 0)) {
        set(key, key === 'size' ? `${def}${unit.value === 'px' ? '' : unit.value}` : '');
        return;
      }
      set(key, formatSize({ value: n, unit: unit.value as SizeUnit }));
    };
    num.addEventListener('input', write);
    unit.addEventListener('change', write);
    onSync(() => {
      const raw = get(key);
      const parsed = raw.toLowerCase() === 'auto' ? null : parseSize(raw);
      if (document.activeElement !== num) num.value = parsed ? String(parsed.value) : '';
      unit.value = parsed?.unit ?? unit.value;
      if (key === 'size') num.disabled = unit.disabled = !parsed;
    });
    return row(label(name, num.id), num, unit);
  };
  autoSize.addEventListener('change', () => {
    set('size', autoSize.checked ? '' : '10vh');
    syncAll();
  });
  onSync(() => {
    autoSize.checked = resolveSettings(state).size === null;
  });
  sizeGroup.append(
    row(h('label', { class: 'check' }, autoSize, 'Auto-fit to the screen')),
    sizeRow('size', 'Fixed size', 10),
    sizeRow('size-min', 'Minimum', 0),
    sizeRow('size-max', 'Maximum', 0),
    h('p', { class: 'hint' }, 'Below the minimum, text stops shrinking and scrolls instead. vh and vw are percent of screen height and width.'),
  );

  // --- Padding
  const padGroup = group('Padding');
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
    const p = resolveSettings(state).pad;
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

  // --- Animation
  const animGroup = group('Animation');
  const animSel = options(h('select', { id: uid('anim') }), ANIMATIONS, ANIM_LABELS);
  const speedSel = options(h('select', { id: uid('speed') }), SPEEDS, { slow: 'Slow', normal: 'Normal', fast: 'Fast' });
  const animAdvice = h('p', { class: 'advisory', hidden: true });
  animSel.addEventListener('change', () => set('anim', animSel.value));
  speedSel.addEventListener('change', () => set('speed', speedSel.value));
  const updateAdvice = () => {
    const s = resolveSettings(state);
    let msg = '';
    if ((s.anim === 'scroll' || s.anim === 'crawl') && !s.sizeMax) {
      msg = `${s.anim === 'scroll' ? 'Scroll fits the text to the screen height' : 'Crawl fits the text to the screen width'}, so short messages get very large. Setting a maximum size (for example 30vh) is recommended.`;
    } else if (s.anim === 'flash' && s.speed === 'fast') {
      msg = 'Photosensitivity warning: fast flashing can trigger seizures in people with photosensitive epilepsy. Consider a slower speed.';
    } else if (s.anim === 'rainbow' && s.fg) {
      msg = 'Rainbow overrides the text color while it runs.';
    }
    animAdvice.textContent = msg;
    animAdvice.hidden = !msg;
  };
  onSync(() => {
    const s = resolveSettings(state);
    animSel.value = s.anim;
    speedSel.value = s.speed;
  });
  animGroup.append(row(label('Type', animSel.id), animSel), row(label('Speed', speedSel.id), speedSel), animAdvice);

  // --- Display target
  const ratioGroup = group('Display target', true, () => !!get('ratio'));
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
    const w = Math.round(+pxW.value);
    const hh = Math.round(+pxH.value);
    if (!(w > 0 && hh > 0)) return;
    const g = gcd(w, hh);
    set('ratio', `${w / g}:${hh / g}`);
    syncAll();
  });
  ratioInput.addEventListener('input', () => {
    const r = parseRatio(ratioInput.value);
    if (r) set('ratio', `${r[0]}:${r[1]}`);
    else if (!ratioInput.value.trim()) set('ratio', '');
    presetBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(get('ratio') === presets[i])));
  });
  onSync(() => {
    const r = resolveSettings(state).ratio;
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

  // --- Countdown and timer
  // Two different things that share {countdown}, the format and what happens
  // at zero: a countdown ends at a fixed moment, a timer runs for a length of
  // time from when the display opens. Only one can be in the URL, so the
  // editor shows one at a time. Switching keeps the other's value here, out of
  // the URL, so switching back restores it.
  const cdGroup = group('Countdown or timer', true, () => !!get('until') || !!get('timer'));
  type CdKind = 'until' | 'timer';
  let cdKind: CdKind = get('timer') ? 'timer' : 'until';
  const stashed: Record<CdKind, string> = { until: '', timer: '' };
  const kindBtn = (title: string, desc: string) =>
    h('button', { class: 'kind-btn', type: 'button', 'aria-pressed': 'false' }, h('span', { class: 'title' }, title), h('span', { class: 'desc' }, desc));
  const kindBtns: Record<CdKind, HTMLButtonElement> = {
    until: kindBtn('Countdown', 'Ends at a date and time, the same moment on every screen.'),
    timer: kindBtn('Timer', 'Runs for a length of time, starting when the display opens.'),
  };
  const kindGrid = h('div', { class: 'kind-grid', role: 'group', 'aria-label': 'Countdown or timer' }, kindBtns.until, kindBtns.timer);

  const until = h('input', { type: 'datetime-local', step: '1', id: uid('until') });
  const untilClear = h('button', { class: 'btn btn-sm', type: 'button' }, 'Clear');
  const untilHint = h('p', { class: 'hint' });
  const untilPanel = h('div', { class: 'kind-panel' }, row(label('Ends at', until.id), until, untilClear), untilHint);

  const timerUnits = [
    ['Days', 86400],
    ['Hours', 3600],
    ['Minutes', 60],
    ['Seconds', 1],
  ] as const;
  const timerInputs = timerUnits.map(() => h('input', { type: 'number', min: '0', step: '1', placeholder: '0', id: uid('timer') }));
  const timerBox = h('div', { class: 'pad-sides' }, ...timerInputs.map((inp, i) => h('label', {}, timerUnits[i][0], inp)));
  const timerClear = h('button', { class: 'btn btn-sm', type: 'button' }, 'Clear');
  const timerHint = h('p', { class: 'hint' });
  const timerPanel = h('div', { class: 'kind-panel' }, row(label('Runs for', timerInputs[0].id), timerClear), timerBox, timerHint);

  const cdfmt = options(h('select', { id: uid('cdfmt') }), CD_FORMATS, { label: 'Labels (2d 14h 06m 32s)', colon: 'Colons (02:14:06:32)' });
  const zeroSel = options(h('select', { id: uid('zero') }), ['freeze', 'hide', 'message'], { freeze: 'Freeze at zero', hide: 'Hide', message: 'Show a message' });
  const zeroMsg = h('textarea', { class: 'zero-msg', rows: '2', spellcheck: 'true', placeholder: 'Message shown at zero', 'aria-label': 'Message shown at zero' });
  const cdHint = h('p', { class: 'hint' });
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local time';

  (Object.keys(kindBtns) as CdKind[]).forEach((kind) => {
    kindBtns[kind].addEventListener('click', () => {
      if (kind === cdKind) return;
      const other = cdKind;
      stashed[other] = get(other);
      cdKind = kind;
      delete state.params[other];
      set(kind, stashed[kind]);
      syncAll();
    });
  });
  // The picker shows the editing device's time zone; the URL gets UTC, so the
  // countdown ends at the same moment on every viewing device.
  until.addEventListener('input', () => {
    set('until', localInputToUtc(until.value));
    syncCountdown();
  });
  untilClear.addEventListener('click', () => {
    set('until', '');
    syncAll();
  });
  // Any amounts add up, so 90 minutes or 28 hours work; leaving a field
  // rewrites them in whole units (1h 30m, 1d 4h).
  timerInputs.forEach((inp) => {
    inp.addEventListener('input', () => {
      const total = timerInputs.reduce((sum, el, i) => sum + (/^\d+$/.test(el.value) ? +el.value * timerUnits[i][1] : 0), 0);
      set('timer', total > 0 ? formatTimer(total) : '');
      syncCountdown();
    });
    inp.addEventListener('change', syncAll);
  });
  timerClear.addEventListener('click', () => {
    set('timer', '');
    syncAll();
  });
  cdfmt.addEventListener('change', () => set('cdfmt', cdfmt.value));
  const writeZero = () => {
    if (zeroSel.value === 'message') set('zero', zeroMsg.value.trim() ? zeroMsg.value : '');
    else set('zero', zeroSel.value);
    zeroMsg.hidden = zeroSel.value !== 'message';
  };
  zeroSel.addEventListener('change', writeZero);
  zeroMsg.addEventListener('input', writeZero);
  const syncCountdown = () => {
    // A link opened or typed in the address bar decides which one is showing.
    if (get('until')) cdKind = 'until';
    else if (get('timer')) cdKind = 'timer';
    kindBtns.until.setAttribute('aria-pressed', String(cdKind === 'until'));
    kindBtns.timer.setAttribute('aria-pressed', String(cdKind === 'timer'));
    untilPanel.hidden = cdKind !== 'until';
    timerPanel.hidden = cdKind !== 'timer';

    const s = resolveSettings(state);
    if (document.activeElement !== until) until.value = s.until ? toLocalInput(s.until) : '';
    if (!timerInputs.includes(document.activeElement as HTMLInputElement)) {
      let rest = parseTimer(get('timer')) ?? 0;
      timerInputs.forEach((inp, i) => {
        const n = Math.floor(rest / timerUnits[i][1]);
        rest -= n * timerUnits[i][1];
        inp.value = n ? String(n) : '';
      });
    }
    cdfmt.value = s.cdfmt;
    if (document.activeElement !== zeroMsg && document.activeElement !== zeroSel) {
      zeroSel.value = s.zero.kind;
      zeroMsg.value = s.zero.kind === 'message' ? s.zero.message : '';
    }
    zeroMsg.hidden = zeroSel.value !== 'message';

    const floating = !!s.until && !/(Z|[+-]\d{2}:?\d{2})$/i.test(get('until').trim());
    untilHint.textContent = floating
      ? 'This link has no time zone, so each viewing device counts down to this time in its own zone. Pick a time to pin it to one moment everywhere.'
      : `Pick the time in your time zone (${timeZone}). It goes in the URL as UTC, so the countdown ends at the same moment everywhere.`;
    timerHint.textContent =
      'Every screen runs its own timer from when it opens the link. Reloading the page or opening the link again starts it over.' +
      (s.refresh ? ' Reload every (under Image) reloads the page, so it restarts the timer each time.' : '');
    const hasToken = state.message.includes('{countdown}');
    cdHint.textContent =
      (s.until || s.timer) && !hasToken && state.message.trim()
        ? `Add {countdown} to the message to show the time ${s.timer ? 'left on the timer' : 'remaining'}.`
        : 'Put {countdown} in the message where the time should show.';
  };
  onSync(syncCountdown);
  cdGroup.append(
    kindGrid,
    untilPanel,
    timerPanel,
    row(label('Format', cdfmt.id), cdfmt),
    row(label('At zero', zeroSel.id), zeroSel),
    zeroMsg,
    cdHint,
  );

  // --- QR code
  // The `qr` parameter holds the raw text to encode. The form builds it from
  // fields for each kind, and reads it back when the URL changes elsewhere.
  const qrGroup = group('QR code', true, () => !!get('qr'));
  const qrKind = options(h('select', { id: uid('qrkind') }), QR_KINDS, QR_KIND_LABELS);
  const field = (attrs: Record<string, string>) => h('input', { class: 'grow', spellcheck: 'false', id: uid('qrf'), ...attrs });
  const qrUrl = field({ type: 'url', placeholder: 'https://…' });
  const qrSsid = field({ type: 'text', autocomplete: 'off' });
  const qrPass = field({ type: 'text', autocomplete: 'off' });
  const qrSec = options(h('select', { id: uid('qrsec') }), WIFI_SECURITY, { WPA: 'WPA/WPA2/WPA3', WEP: 'WEP', nopass: 'None (open)' });
  const qrHidden = h('input', { type: 'checkbox' });
  const qrPhone = field({ type: 'tel', placeholder: '+1 555 123 4567' });
  const qrBody = field({ type: 'text', spellcheck: 'true' });
  const qrEmail = field({ type: 'email', placeholder: 'name@example.com' });
  const qrSubject = field({ type: 'text', spellcheck: 'true' });
  const qrLat = field({ type: 'text', inputmode: 'decimal', placeholder: '40.6892' });
  const qrLng = field({ type: 'text', inputmode: 'decimal', placeholder: '-74.0445' });
  const qrText = field({ type: 'text', spellcheck: 'true' });
  const qrSize = h('input', { type: 'number', min: String(QR_SIZE_MIN), max: String(QR_SIZE_MAX), step: '5', id: uid('qrsize') });
  const qrpos = options(h('select', { id: uid('qrpos') }), QR_POSITIONS, QR_LABELS);
  const qrHint = h('p', { class: 'hint' });
  /** A field label marked optional. Unmarked fields are required. */
  const optLabel = (text: string, forId: string) => h('label', { class: 'lbl', for: forId }, text, h('span', { class: 'opt' }, 'optional'));
  for (const el of [qrUrl, qrSsid, qrPass, qrPhone, qrEmail, qrLat, qrLng, qrText]) el.required = true;
  const bodyRow = row(optLabel('Message', qrBody.id), qrBody);
  const phoneRow = row(label('Phone', qrPhone.id), qrPhone);
  const passRow = row(label('Password', qrPass.id), qrPass);
  const qrRows: Record<QrKind, HTMLElement[]> = {
    url: [row(label('URL', qrUrl.id), qrUrl)],
    wifi: [
      row(label('Network', qrSsid.id), qrSsid),
      passRow,
      row(label('Security', qrSec.id), qrSec, h('label', { class: 'check' }, qrHidden, 'Hidden network', h('span', { class: 'opt' }, 'optional'))),
    ],
    tel: [phoneRow],
    sms: [phoneRow, bodyRow],
    email: [row(label('To', qrEmail.id), qrEmail), row(optLabel('Subject', qrSubject.id), qrSubject), bodyRow],
    geo: [row(label('Latitude', qrLat.id), qrLat), row(label('Longitude', qrLng.id), qrLng)],
    text: [row(label('Text', qrText.id), qrText)],
  };
  // Rows shared between kinds (phone, message) move to where each kind lists them.
  const qrFieldRows = h('div');
  const qrFieldEls = [qrUrl, qrSsid, qrPass, qrSec, qrHidden, qrPhone, qrBody, qrEmail, qrSubject, qrLat, qrLng, qrText];
  const readQrFields = (): QrFields => ({
    url: qrUrl.value,
    ssid: qrSsid.value,
    password: qrPass.value,
    security: qrSec.value as QrFields['security'],
    hidden: qrHidden.checked,
    phone: qrPhone.value,
    body: qrBody.value,
    email: qrEmail.value,
    subject: qrSubject.value,
    lat: qrLat.value,
    lng: qrLng.value,
    text: qrText.value,
  });
  const writeQrFields = (f: QrFields) => {
    qrUrl.value = f.url;
    qrSsid.value = f.ssid;
    qrPass.value = f.password;
    qrSec.value = f.security;
    qrHidden.checked = f.hidden;
    qrPhone.value = f.phone;
    qrBody.value = f.body;
    qrEmail.value = f.email;
    qrSubject.value = f.subject;
    qrLat.value = f.lat;
    qrLng.value = f.lng;
    qrText.value = f.text;
  };
  const showQrKind = () => {
    const kind = qrKind.value as QrKind;
    if (qrFieldRows.dataset.kind !== kind) {
      qrFieldRows.dataset.kind = kind;
      qrFieldRows.replaceChildren(...qrRows[kind]);
    }
    passRow.hidden = kind !== 'wifi' || qrSec.value === 'nopass';
    qrHint.textContent = QR_HINTS[kind];
  };
  // The payload this form last wrote. While the URL still holds it, the
  // fields are left alone, so a half-filled form isn't wiped when a required
  // field is empty and the code is cleared. Any other value came from the
  // address bar or a loaded link, and is read back into the form.
  let qrWritten: string | null = null;
  const writeQr = () => {
    qrWritten = buildQr(qrKind.value as QrKind, readQrFields());
    set('qr', qrWritten);
  };
  qrKind.addEventListener('change', () => {
    showQrKind();
    writeQr();
  });
  for (const el of qrFieldEls) el.addEventListener(el instanceof HTMLSelectElement || el.type === 'checkbox' ? 'change' : 'input', () => {
    showQrKind();
    writeQr();
  });
  qrSize.addEventListener('input', () => set('qrsize', /^\d+$/.test(qrSize.value) && +qrSize.value > 0 ? qrSize.value : ''));
  qrpos.addEventListener('change', () => set('qrpos', qrpos.value));
  onSync(() => {
    const payload = get('qr');
    if (payload !== qrWritten) {
      const parsed = parseQr(payload);
      if (payload) qrKind.value = parsed.kind;
      writeQrFields(parsed.fields);
      qrWritten = payload;
    }
    showQrKind();
    const s = resolveSettings(state);
    if (document.activeElement !== qrSize) qrSize.value = String(s.qrsize);
    qrpos.value = s.qrpos;
  });
  qrGroup.append(
    row(label('Type', qrKind.id), qrKind),
    qrFieldRows,
    row(label('Size', qrSize.id), qrSize, '% of the screen'),
    row(label('Position', qrpos.id), qrpos),
    qrHint,
    h('p', { class: 'hint' }, 'Fields marked optional can be left blank; the code appears once the others are filled in. Generated in the browser, black on white with a quiet zone so it scans on any colors.'),
  );

  // --- Image
  const imgGroup = group('Image', true, () => !!get('img'));
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
    imgpos.value = resolveSettings(state).imgpos;
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

  // --- Screen
  const screenGroup = group('Screen', true, () => !resolveSettings(state).wake);
  const wake = h('input', { type: 'checkbox' });
  wake.addEventListener('change', () => set('wake', wake.checked ? '' : 'off'));
  onSync(() => {
    wake.checked = resolveSettings(state).wake;
  });
  screenGroup.append(row(h('label', { class: 'check' }, wake, 'Keep the screen awake while showing')));

  // ------------------------------------------------------------ commit / sync
  // Typing and dragging the color picker fire input events faster than the
  // preview can refit, so the preview updates at most once per frame. The
  // address bar is written at most every 150 ms: Safari throws once a page
  // calls replaceState about 100 times in a few seconds.
  let renderFrame = 0;
  let urlTimer = 0;
  const renderPreview = () => {
    renderFrame = 0;
    display.update(resolveSettings(state));
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
  openLink.addEventListener('click', () => {
    if (!urlTimer) return;
    clearTimeout(urlTimer);
    writeUrl();
  });
  function commit() {
    const frag = fragment();
    urlTimer ||= window.setTimeout(writeUrl, 150);
    renderFrame ||= requestAnimationFrame(renderPreview);
    const viewer = viewerUrl();
    urlField.value = viewer;
    openLink.href = `/#${frag}`;
    openTabLink.href = openLink.href;
    const n = viewer.length;
    urlCount.textContent = `${n.toLocaleString()} chars`;
    urlCount.className = 'url-count' + (n > URL_LIMIT ? ' over' : n >= URL_WARN ? ' warn' : '');
    urlAdvice.hidden = n < URL_WARN;
    urlAdvice.textContent =
      n > URL_LIMIT
        ? `This link is ${n.toLocaleString()} characters. Some messaging apps, email clients and proxies cut links off after about 2,000.`
        : `This link is getting long (${n.toLocaleString()} characters). Links over about 2,000 may be cut off by some apps.`;
    updateAdvice();
  }

  const load = (hash: string) => {
    state = loadState(hash);
    syncAll();
    renderSlides();
    commit();
  };
  const onHashChange = () => load(location.hash);
  // A pasted link, or just its fragment. Without a # it's a link to the home
  // page, which opens the starter message like the editor does.
  urlField.addEventListener('change', () => {
    const value = urlField.value.trim();
    const i = value.indexOf('#');
    if (i >= 0) load(value.slice(i));
    else if (/^[a-z]+:\/\//i.test(value)) load('');
    else load(`#${value}`);
  });
  urlField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') urlField.blur();
    else if (e.key === 'Escape') {
      urlField.value = viewerUrl();
      urlField.blur();
    }
  });
  window.addEventListener('hashchange', onHashChange);
  const unlockPreviewHeight = lockPreviewHeight();
  const stopKeepingFieldsVisible = keepFocusedFieldVisible();

  app.replaceChildren(
    siteHeader('editor'),
    h(
      'main',
      { class: 'editor' },
      h('section', { class: 'editor-preview', 'aria-label': 'Preview' }, h('div', { class: 'preview-frame' }, previewStage), h('div', { class: 'preview-bar' }, urlField, qrBtn, urlCount, openViewer, copyBtn)),
      controls,
    ),
    qrDialog,
  );

  syncAll();
  renderSlides();
  commit();

  return {
    destroy() {
      window.removeEventListener('hashchange', onHashChange);
      // A pending write would put the editor's URL over the page being opened.
      clearTimeout(urlTimer);
      cancelAnimationFrame(renderFrame);
      unlockPreviewHeight();
      stopKeepingFieldsVisible();
      display.destroy();
    },
  };
}
