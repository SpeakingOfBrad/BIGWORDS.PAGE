/**
 * Debug overlay for the viewer, turned on by the `dbg` parameter. Loaded only
 * when it's on, so displays without it never download this file.
 *
 *   1  outlines the display's boxes, with a key
 *   2  adds a panel with the sizes and measurements behind the fit
 *   3  adds every size the fit tried
 */

/** What a fit decided, for the panel. */
export interface FitInfo {
  slide: number;
  slides: number;
  block: HTMLElement;
  /** The text area the fit had: its width and height. */
  W: number;
  H: number;
  px: number;
  /** A size set with `size`, rather than fitted. */
  fixed: boolean;
  minPx: number;
  maxPx: number;
  /** Each size tried, in order, at level 3. */
  trace: { size: number; w: number; h: number; ok: boolean }[];
}

const OUTLINES: [cls: string, color: string, label: string][] = [
  ['bw-box', '#ff3df2', 'display'],
  ['bw-content', '#2ee6ff', 'padding'],
  ['bw-area', '#ffe600', 'text area'],
  ['bw-block', '#4dff4d', 'text'],
  ['bw-qr', '#ff9a1f', 'QR code'],
  ['bw-img-flow', '#ff4d4d', 'image'],
];

// The display, padding and text area are drawn as borders on a layer above
// their contents, so a background image can't cover them. The padding's is
// dashed: the text area often has the same edges, and shows between the
// dashes.
const FRAMED = ['bw-box', 'bw-content', 'bw-area'];

const CSS = `
${OUTLINES.map(([cls, color]) =>
  FRAMED.includes(cls)
    ? `.bw-dbg .${cls}::after{content:"";position:absolute;inset:0;z-index:5;pointer-events:none;border:2px ${cls === 'bw-content' ? 'dashed' : 'solid'} ${color}}`
    : `.bw-dbg .${cls}{outline:2px solid ${color};outline-offset:-2px}`,
).join('\n')}
.bw-dbg .bw-line{outline:1px dashed #4dff4d;outline-offset:-1px}
.bw-dbg-ui{position:absolute;z-index:10;left:0;top:0;right:0;padding:3px 6px;pointer-events:none;font:10px/1.3 ui-monospace,Menlo,Consolas,monospace;color:#fff;background:rgba(0,0,0,.78)}
.bw-dbg-key{display:flex;flex-wrap:wrap;gap:2px 10px}
.bw-dbg-key span::before{content:"";display:inline-block;width:7px;height:7px;margin-right:4px;vertical-align:-1px;border:2px solid var(--c)}
.bw-dbg-panel{margin:3px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;color:#7dff7d;font:inherit}
`;

const px = (n: number) => String(Math.round(n * 10) / 10);
const size = (w: number, h: number) => `${px(w)}×${px(h)}`;

function displayMode(): string {
  for (const mode of ['fullscreen', 'standalone', 'minimal-ui']) {
    if (matchMedia(`(display-mode: ${mode})`).matches) return `app (${mode})`;
  }
  return 'browser';
}

export class DebugOverlay {
  private root: HTMLElement;
  private level = 0;
  private ui: HTMLElement;
  private panel: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
    if (!document.getElementById('bw-dbg-style')) {
      const style = document.createElement('style');
      style.id = 'bw-dbg-style';
      style.textContent = CSS;
      document.head.append(style);
    }
    const key = document.createElement('div');
    key.className = 'bw-dbg-key';
    for (const [, color, label] of OUTLINES) {
      const item = document.createElement('span');
      item.style.setProperty('--c', color);
      item.textContent = label;
      key.append(item);
    }
    this.panel = document.createElement('pre');
    this.panel.className = 'bw-dbg-panel';
    this.ui = document.createElement('div');
    this.ui.className = 'bw-dbg-ui';
    this.ui.append(key);
  }

  setLevel(level: number): void {
    this.level = level;
    this.root.classList.add('bw-dbg');
    this.root.append(this.ui);
    if (level >= 2) this.ui.append(this.panel);
    else this.panel.remove();
  }

  /** Whether the fit should record each size it tries. */
  get tracing(): boolean {
    return this.level >= 3;
  }

  fitted(info: FitInfo): void {
    if (this.level < 2) return;
    const b = info.block;
    const family = getComputedStyle(b).fontFamily;
    const loaded = (weight: number) => (document.fonts ? (document.fonts.check(`${weight} 1em ${family}`) ? 'yes' : 'no') : '?');
    const vv = window.visualViewport;
    const box = this.root.querySelector<HTMLElement>('.bw-box');
    const lines = [...b.querySelectorAll<HTMLElement>(':scope > .bw-line')].map((ln) => size(ln.offsetWidth, ln.offsetHeight));
    const limits = [info.minPx ? `min ${px(info.minPx)}` : '', Number.isFinite(info.maxPx) ? `max ${px(info.maxPx)}` : ''].filter(Boolean).join(' ');
    const rows = [
      `${displayMode()} · screen ${size(screen.width, screen.height)} @${devicePixelRatio}x · window ${size(innerWidth, innerHeight)}` +
        (vv ? ` · visible ${size(vv.width, vv.height)}` : '') +
        ` · stage ${size(this.root.clientWidth, this.root.clientHeight)}` +
        (box ? ` · display ${size(box.offsetWidth, box.offsetHeight)}` : ''),
      `slide ${info.slide + 1}/${info.slides} · text area ${size(info.W, info.H)} · font ${px(info.px)}px ${info.fixed ? '(fixed)' : '(fitted)'}` +
        (limits ? ` · ${limits}` : '') +
        ` · text ${size(b.scrollWidth, b.scrollHeight)} · ink padding ${b.style.padding || '0'}`,
      `lines ${lines.join(' ')}`,
      `fonts ${family.split(',')[0]} · regular loaded ${loaded(400)} · bold loaded ${loaded(700)}`,
    ];
    if (this.level >= 3) {
      rows.push(
        info.trace.length
          ? `tried ${info.trace.map((t) => `${px(t.size)}:${size(t.w, t.h)}${t.ok ? '✓' : '✗'}`).join(' ')}`
          : 'tried nothing: the size is fixed',
      );
    }
    this.panel.textContent = rows.join('\n');
  }

  destroy(): void {
    this.root.classList.remove('bw-dbg');
    this.ui.remove();
  }
}
