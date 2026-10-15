import type { Settings } from '../state/params';
import { sizeToPx } from '../state/size';
import { BASE_DURATION, SPEED_FACTOR, typewriter } from './animation';
import { renderBlock } from './block';
import { displayColors, prefersLight, rainbowLightness } from './colors';
import { formatCountdown, everySecond } from './countdown';
import type { DebugOverlay, FitInfo } from './debug';
import { el } from './dom';
import { autoSize, boxRect, contentInsets, fitMode, marquee, qrMetrics } from './fit';
import { ensureFont, fontReady, fontStack } from './fonts';
import { inkOverhang } from './ink';
import { activeSlides } from './slides';
import type { Slide } from './text';
import { planTransition, prefersReducedMotion } from './transitions';

export interface DisplayOptions {
  /** Editor preview: draws the ratio frame. */
  editor?: boolean;
  /** Fullscreen viewer: shows the debug overlay the `dbg` parameter asks for. */
  debug?: boolean;
  /** Fullscreen viewer: fetches the image again every `refresh` seconds. */
  reloadImage?: boolean;
  onImageError?: (url: string) => void;
  onImageLoad?: (url: string) => void;
}

const CODE_FONT = 5; // JetBrains Mono, loaded only when a message has `code`
const FONT_WAIT_MS = 1500; // longest the text stays hidden waiting for its font

/**
 * The image URL with a throwaway query parameter, so neither the browser nor
 * a cache in between can answer a reload with the copy it already has.
 */
function cacheBusted(url: string): string {
  const hash = url.indexOf('#');
  const base = hash === -1 ? url : url.slice(0, hash);
  return `${base}${base.includes('?') ? '&' : '?'}_=${Date.now()}${hash === -1 ? '' : url.slice(hash)}`;
}

interface SlideView {
  slide: Slide;
  el: HTMLElement; // full-area layer
  block: HTMLElement; // the text block
  stopAnim?: () => void;
}

/**
 * Renders a Settings object into a container. Used by the fullscreen viewer,
 * the editor preview and the home page demo, so all three always match.
 */
export class Display {
  private root: HTMLElement;
  private opts: DisplayOptions;
  private s: Settings | null = null;

  private box = el('div', 'bw-box');
  private bgImg: HTMLImageElement | null = null;
  private content = el('div', 'bw-content');
  private area = el('div', 'bw-area');
  private flowImg: HTMLImageElement | null = null;
  private qrWrap: HTMLElement | null = null;
  private imgTimer = 0;

  private views: SlideView[] = [];
  private current = 0;
  private slideTimer = 0;
  private stopTick: (() => void) | null = null;
  private expired = false;
  private cdText = '';
  /** When the countdown ends, in ms since the epoch, from `until` or `timer`. */
  private deadline: number | null = null;
  /** The running timer: its length and when it started. It restarts only when the length changes. */
  private timer: { seconds: number; start: number } | null = null;
  private resizeObs: ResizeObserver;
  private areaObs: ResizeObserver;
  private media: MediaQueryList | null = null;
  private onScheme = () => this.applyColors();
  // Faces the fit didn't wait for (italic, latin-ext, a lazily loaded bold)
  // can land later and change the text's metrics.
  private onFonts = () => this.scheduleFit();
  private destroyed = false;
  private debug: DebugOverlay | null = null;
  private fitFrame = 0;
  private revealTimer = 0;

  constructor(root: HTMLElement, opts: DisplayOptions = {}) {
    this.root = root;
    this.opts = opts;
    root.classList.add('bw-stage');
    if (opts.editor) root.classList.add('bw-editor');
    this.content.append(this.area);
    this.box.append(this.content);
    root.append(this.box);
    this.resizeObs = new ResizeObserver(() => this.layout());
    this.resizeObs.observe(root);
    this.areaObs = new ResizeObserver(() => this.scheduleFit());
    this.areaObs.observe(this.area);
    if (typeof matchMedia === 'function') {
      this.media = matchMedia('(prefers-color-scheme: light)');
      this.media.addEventListener('change', this.onScheme);
    }
    document.fonts?.addEventListener('loadingdone', this.onFonts);
  }

  destroy(): void {
    this.destroyed = true;
    this.clearTimers();
    clearTimeout(this.revealTimer);
    clearTimeout(this.imgTimer);
    this.views.forEach((v) => v.stopAnim?.());
    this.resizeObs.disconnect();
    this.areaObs.disconnect();
    this.media?.removeEventListener('change', this.onScheme);
    document.fonts?.removeEventListener('loadingdone', this.onFonts);
    cancelAnimationFrame(this.fitFrame);
    this.debug?.destroy();
    this.root.replaceChildren();
    this.root.classList.remove('bw-stage', 'bw-editor');
    this.root.removeAttribute('style');
  }

  update(settings: Settings): void {
    this.s = settings;
    this.clearTimers();
    this.applyColors();

    const family = fontStack(settings.font);
    this.box.style.fontFamily = family;
    this.box.style.setProperty('--bw-code-font', fontStack(CODE_FONT));

    this.box.dataset.speed = settings.speed;
    this.box.style.setProperty('--bw-factor', String(SPEED_FACTOR[settings.speed]));
    const base = BASE_DURATION[settings.anim];
    if (base) this.box.style.setProperty('--bw-dur', `${base * SPEED_FACTOR[settings.speed]}s`);

    this.box.classList.toggle('bw-ratio', !!settings.ratio);
    this.buildImage();
    this.scheduleImageReload();
    this.buildQr();
    this.deadline = this.countdownDeadline(settings);
    this.expired = this.deadline !== null && Date.now() >= this.deadline;
    this.cdText = this.deadline !== null ? formatCountdown(this.deadline - Date.now(), settings.cdfmt) : '';
    this.buildSlides();
    this.syncDebug();
    this.layout();

    if (this.deadline !== null) {
      this.stopTick = everySecond(() => this.tick());
    }
  }

  /**
   * A timer starts on the next whole second after it is first shown, so it
   * ticks in step with the clock and shows its full length for that first
   * moment. It works from that start time rather than counting ticks, so it
   * stays right when a background tab's timers are throttled.
   */
  private countdownDeadline(settings: Settings): number | null {
    if (settings.timer === null) {
      this.timer = null;
      return settings.until ? settings.until.getTime() : null;
    }
    if (this.timer?.seconds !== settings.timer) {
      this.timer = { seconds: settings.timer, start: Math.ceil(Date.now() / 1000) * 1000 };
    }
    return this.timer.start + this.timer.seconds * 1000;
  }

  // ---------------------------------------------------------------- colors

  private applyColors(): void {
    if (!this.s) return;
    const { bg, fg } = displayColors(this.s.bg, this.s.fg, prefersLight());
    this.root.style.backgroundColor = bg;
    this.box.style.backgroundColor = bg;
    this.box.style.setProperty('--bw-bg', bg);
    this.box.style.color = fg;
    // Rainbow keeps contrast against the background.
    this.box.style.setProperty('--bw-rb-l', rainbowLightness(bg));
  }

  // ---------------------------------------------------------------- debug

  /** The overlay's code is only downloaded when `dbg` turns it on. */
  private syncDebug(): void {
    const level = () => (this.opts.debug && this.s ? this.s.dbg : 0);
    if (!level()) {
      this.debug?.destroy();
      this.debug = null;
    } else if (this.debug) {
      this.debug.setLevel(level());
    } else {
      void import('./debug').then(({ DebugOverlay }) => {
        if (this.destroyed || this.debug || !level()) return;
        this.debug = new DebugOverlay(this.root);
        this.debug.setLevel(level());
        this.fitAll();
      });
    }
  }

  // ---------------------------------------------------------------- image & QR

  private makeImg(url: string, src = url): HTMLImageElement {
    const img = el('img');
    // The URL from the link: `src` has a cache-busting query on reloads.
    img.dataset.url = url;
    img.alt = '';
    img.decoding = 'async';
    // No crossOrigin: the pixels are never read, and requiring CORS made
    // images from most hosts fail.
    img.referrerPolicy = 'no-referrer';
    img.addEventListener('error', () => {
      img.hidden = true;
      this.opts.onImageError?.(url);
    });
    img.addEventListener('load', () => {
      img.hidden = false;
      this.opts.onImageLoad?.(url);
      this.scheduleFit();
    });
    img.src = src;
    return img;
  }

  private buildImage(): void {
    const s = this.s!;
    const wantBg = s.img && (s.imgpos === 'bg' || s.imgpos === 'full') ? s.img : null;
    const wantFlow = s.img && (s.imgpos === 'above' || s.imgpos === 'below') ? s.img : null;

    // Reuse an existing element for the same URL so editor edits don't flicker.
    const reuse = [this.bgImg, this.flowImg].find((i) => i && i.dataset.url === s.img) ?? null;
    const take = (url: string | null): HTMLImageElement | null => {
      if (!url) return null;
      if (reuse && reuse.dataset.url === url) return reuse;
      return this.makeImg(url);
    };
    const bg = take(wantBg);
    const flow = take(wantFlow);
    for (const old of [this.bgImg, this.flowImg]) if (old && old !== bg && old !== flow) old.remove();
    this.bgImg = bg;
    this.flowImg = flow;

    if (bg) {
      bg.className = `bw-img-layer bw-img-${s.imgpos}`;
      this.box.prepend(bg);
    }
    if (flow) {
      flow.className = 'bw-img-flow';
      if (s.imgpos === 'above') this.content.insertBefore(flow, this.area);
      else this.area.after(flow);
    }
  }

  /**
   * With `refresh`, the image is fetched again every N seconds, off screen,
   * and swapped in only once it has loaded: no flicker, and a failed fetch
   * leaves the last image up. The next fetch is timed from when this one
   * settles, so a slow host never has requests piling up.
   */
  private scheduleImageReload(): void {
    clearTimeout(this.imgTimer);
    const s = this.s!;
    const img = this.bgImg ?? this.flowImg;
    if (!this.opts.reloadImage || !s.refresh || !img) return;
    const url = img.dataset.url!;
    // A data: URL never changes.
    if (!/^https?:/i.test(url)) return;
    this.imgTimer = window.setTimeout(() => {
      const next = this.makeImg(url, cacheBusted(url));
      const settle = (ok: boolean) => {
        if (this.destroyed || (this.bgImg ?? this.flowImg) !== img) return;
        if (ok) {
          next.className = img.className;
          img.replaceWith(next);
          if (this.bgImg === img) this.bgImg = next;
          else this.flowImg = next;
        }
        this.scheduleImageReload();
      };
      next.addEventListener('load', () => settle(true), { once: true });
      next.addEventListener('error', () => settle(false), { once: true });
    }, s.refresh * 1000);
  }

  private buildQr(): void {
    const s = this.s!;
    this.qrWrap?.remove();
    this.qrWrap = null;
    if (!s.qr) return;
    const wrap = el('div', `bw-qr bw-qr-${s.qrpos}`);
    if (s.qrpos === 'below') {
      // After the text area (and after a "below" image).
      this.content.append(wrap);
    } else {
      this.box.append(wrap);
    }
    this.qrWrap = wrap;
    // The QR encoder is only downloaded when a display uses it.
    const text = s.qr;
    void Promise.all([import('./qr'), import('../state/qr-payload')]).then(([{ createQrSvg }, { qrCodeText }]) => {
      if (this.qrWrap !== wrap) return;
      const svg = createQrSvg(qrCodeText(text));
      if (svg) wrap.append(svg);
      else wrap.remove();
    });
  }

  // ---------------------------------------------------------------- slides

  private buildSlides(): void {
    const s = this.s!;
    this.views.forEach((v) => v.stopAnim?.());
    this.area.replaceChildren();
    const countdown = this.deadline !== null ? { expired: this.expired, zero: s.zero } : null;
    this.views = activeSlides(s.message, countdown).map((slide) => {
      const layer = el('div', `bw-slide bw-mode-${fitMode(s.anim)}`);
      const block = renderBlock(slide, this.deadline !== null ? this.cdText : null);
      if (s.anim !== 'none') block.classList.add(`bw-anim-${s.anim}`);
      layer.append(block);
      layer.hidden = true;
      this.area.append(layer);
      return { slide, el: layer, block };
    });
    this.current = 0;
    if (this.views.length) this.show(0);
    if (this.views.length > 1) {
      this.slideTimer = window.setInterval(() => this.advance(), s.interval * 1000);
    }
    // Load the faces the text uses before fitting. The bold face is only
    // requested when something is bold (headings are bold).
    const fonts = new Set<number>();
    if (s.font !== 0) fonts.add(s.font);
    if (this.area.querySelector('.bw-code')) fonts.add(CODE_FONT);
    const bold = !!this.area.querySelector('.bw-b, .bw-h1, .bw-h2');
    // Keep the text hidden until its faces arrive, so it doesn't paint in a
    // fallback font and then visibly swap. A slow network gets a short cap.
    const pending = [...fonts].filter((id) => !fontReady(id, { bold }));
    this.area.style.visibility = pending.length ? 'hidden' : '';
    clearTimeout(this.revealTimer);
    if (!pending.length) return;
    const reveal = () => {
      if (this.destroyed || this.s !== s) return;
      clearTimeout(this.revealTimer);
      this.area.style.visibility = '';
      this.scheduleFit();
    };
    this.revealTimer = window.setTimeout(reveal, FONT_WAIT_MS);
    void Promise.all(pending.map((id) => ensureFont(id, { bold }))).then(reveal);
  }

  private show(i: number): void {
    const v = this.views[i];
    v.el.hidden = false;
    v.el.style.transform = '';
    this.fit(v);
    this.startAnim(v);
  }

  private advance(): void {
    if (this.views.length < 2 || document.hidden) return;
    const from = this.views[this.current];
    this.current = (this.current + 1) % this.views.length;
    const to = this.views[this.current];
    to.el.hidden = false;
    this.fit(to);
    this.startAnim(to);
    const s = this.s!;
    const plan = planTransition(s.trans, s.interval, prefersReducedMotion());
    if (!plan || typeof to.el.animate !== 'function') {
      from.el.hidden = true;
      from.stopAnim?.();
      return;
    }
    const opts: KeyframeAnimationOptions = { duration: plan.duration, easing: 'ease-in-out' };
    to.el.animate(plan.incoming, opts);
    const out = from.el.animate(plan.outgoing, opts);
    out.onfinish = () => {
      if (this.views[this.current] !== from) {
        from.el.hidden = true;
        from.stopAnim?.();
      }
    };
  }

  private visibleViews(): SlideView[] {
    return this.views.filter((v) => !v.el.hidden);
  }

  // ---------------------------------------------------------------- countdown

  private tick(): void {
    const s = this.s;
    if (!s || this.deadline === null) return;
    const remaining = this.deadline - Date.now();
    const text = formatCountdown(remaining, s.cdfmt);
    const nowExpired = remaining <= 0;
    if (nowExpired && !this.expired) {
      this.expired = true;
      this.cdText = text;
      if (s.zero.kind !== 'freeze') {
        clearInterval(this.slideTimer);
        this.buildSlides();
        this.scheduleFit();
        return;
      }
    }
    const lengthChanged = text.length !== this.cdText.length;
    this.cdText = text;
    this.area.querySelectorAll<HTMLElement>('.bw-cd').forEach((span) => {
      span.textContent = text;
    });
    if (lengthChanged) this.scheduleFit();
    if (nowExpired && this.stopTick && s.zero.kind !== 'freeze') {
      this.stopTick();
      this.stopTick = null;
    }
  }

  private clearTimers(): void {
    clearInterval(this.slideTimer);
    this.slideTimer = 0;
    this.stopTick?.();
    this.stopTick = null;
  }

  // ---------------------------------------------------------------- layout & fit

  private layout(): void {
    const s = this.s;
    if (!s) return;
    const box = boxRect(this.root.clientWidth, this.root.clientHeight, s.ratio);
    Object.assign(this.box.style, {
      width: `${box.width}px`,
      height: `${box.height}px`,
      left: `${box.left}px`,
      top: `${box.top}px`,
    });
    const [top, right, bottom, left] = contentInsets(s.pad, box.width, box.height);
    Object.assign(this.content.style, { top: `${top}px`, right: `${right}px`, bottom: `${bottom}px`, left: `${left}px` });
    if (this.qrWrap) {
      const qr = qrMetrics(box.width, box.height, s.qrsize);
      this.qrWrap.style.setProperty('--bw-qr', `${qr.size}px`);
      this.qrWrap.style.setProperty('--bw-qr-m', `${qr.margin}px`);
    }
    this.fitAll();
  }

  private scheduleFit(): void {
    cancelAnimationFrame(this.fitFrame);
    this.fitFrame = requestAnimationFrame(() => this.fitAll());
  }

  private fitAll(): void {
    for (const v of this.visibleViews()) this.fit(v);
  }

  private fit(v: SlideView): void {
    const s = this.s!;
    const W = this.area.clientWidth;
    const H = this.area.clientHeight;
    const block = v.block;
    if (W <= 0 || H <= 0) return;
    const vw = this.root.clientWidth;
    const vh = this.root.clientHeight;
    const minPx = s.sizeMin ? sizeToPx(s.sizeMin, vw, vh) : 0;
    const maxPx = s.sizeMax ? sizeToPx(s.sizeMax, vw, vh) : Infinity;
    const mode = fitMode(s.anim);
    block.style.padding = inkOverhang(block)
      .map((n) => `${n.toFixed(3)}em`)
      .join(' ');

    const trace: FitInfo['trace'] = [];
    const tracing = this.debug?.tracing;
    let px: number;
    // A fixed size is used as given; the limits only bound auto-fit.
    if (s.size) {
      px = sizeToPx(s.size, vw, vh);
    } else {
      const fits = (size: number) => {
        block.style.fontSize = `${size}px`;
        const okW = mode === 'height' || block.scrollWidth <= W + 0.5;
        const okH = mode === 'width' || block.scrollHeight <= H + 0.5;
        if (tracing) trace.push({ size, w: block.scrollWidth, h: block.scrollHeight, ok: okW && okH });
        return okW && okH;
      };
      px = autoSize(fits, { mode, W, H, minPx, maxPx, anim: s.anim });
    }
    block.style.fontSize = `${Math.max(1, px)}px`;
    if (mode !== 'both') {
      const m = mode === 'height' ? marquee(mode, W, block.scrollWidth, SPEED_FACTOR[s.speed]) : marquee(mode, H, block.scrollHeight, SPEED_FACTOR[s.speed]);
      block.style.setProperty('--bw-from', `${m.from}px`);
      block.style.setProperty('--bw-to', `${m.to}px`);
      block.style.setProperty('--bw-dur', `${m.dur}s`);
    }
    // The panel describes the slide on screen, not one leaving it.
    if (v === this.views[this.current]) this.debug?.fitted({ slide: this.views.indexOf(v), slides: this.views.length, block, W, H, px, fixed: !!s.size, minPx, maxPx, trace });
  }

  // ---------------------------------------------------------------- animations

  private startAnim(v: SlideView): void {
    v.stopAnim?.();
    v.stopAnim = undefined;
    const anim = this.s!.anim;
    if (anim === 'typewriter') {
      v.stopAnim = typewriter(v.block, SPEED_FACTOR[this.s!.speed]);
    } else if (anim !== 'none') {
      // Restart CSS animations when a slide is shown.
      const cls = `bw-anim-${anim}`;
      v.block.classList.remove(cls);
      void v.block.offsetWidth;
      v.block.classList.add(cls);
    }
  }
}
