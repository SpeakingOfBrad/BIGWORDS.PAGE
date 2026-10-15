import type { Animation } from '../state/params';

/** Which sides the text must fit: marquees only fit across their direction of travel. */
export type FitMode = 'both' | 'height' | 'width';

export function fitMode(anim: Animation | undefined): FitMode {
  return anim === 'scroll' ? 'height' : anim === 'crawl' ? 'width' : 'both';
}

/** Whether lines break to fit the width. Scroll moves text sideways, so its lines never break. */
export function wraps(wrap: boolean, mode: FitMode): boolean {
  return wrap && mode !== 'height';
}

export interface AutoSizeOptions {
  mode: FitMode;
  /** The text area, in px. */
  W: number;
  H: number;
  minPx: number;
  maxPx: number;
  anim: Animation;
}

/**
 * The largest font size, in half pixels, at which `fits` holds, found by
 * bisection, then shrunk for animations that grow or move the text and held
 * between `minPx` and `maxPx`.
 */
export function autoSize(fits: (px: number) => boolean, { mode, W, H, minPx, maxPx, anim }: AutoSizeOptions): number {
  let lo = 1;
  let hi = Math.max(8, Math.min(maxPx, mode === 'width' ? W : H * 1.2));
  if (fits(hi)) {
    lo = hi;
  } else {
    for (let i = 0; i < 18 && hi - lo > 0.5; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) lo = mid;
      else hi = mid;
    }
  }
  let px = Math.floor(lo * 2) / 2;
  // Leave room for animations that grow or move the text.
  if (anim === 'pulse') px *= 0.94;
  if (anim === 'shake' || anim === 'bounce') px *= 0.96;
  if (px > maxPx) px = maxPx;
  if (px < minPx) px = minPx;
  return px;
}

export interface Rect {
  width: number;
  height: number;
  left: number;
  top: number;
}

/** The display box inside a W×H stage: all of it, or the largest centered `ratio` box. */
export function boxRect(W: number, H: number, ratio: [number, number] | null): Rect {
  let bw = W;
  let bh = H;
  if (ratio) {
    const r = ratio[0] / ratio[1];
    if (W / H > r) bw = H * r;
    else bh = W / r;
  }
  bw = Math.max(0, Math.round(bw));
  bh = Math.max(0, Math.round(bh));
  return { width: bw, height: bh, left: Math.round((W - bw) / 2), top: Math.round((H - bh) / 2) };
}

/** Padding, as percentages of the box's height (top, bottom) and width (left, right), in px. */
export function contentInsets(pad: [number, number, number, number], bw: number, bh: number): [number, number, number, number] {
  const [pt, pr, pb, pl] = pad;
  return [(pt / 100) * bh, (pr / 100) * bw, (pb / 100) * bh, (pl / 100) * bw];
}

/** The QR code's side and its margin from the box's edges, in px. */
export function qrMetrics(bw: number, bh: number, qrsize: number): { size: number; margin: number } {
  const short = Math.min(bw, bh);
  return { size: Math.max(48, Math.round((short * qrsize) / 100)), margin: Math.round(short * 0.03) };
}

/**
 * A marquee's path and duration: it enters from one edge of the area and
 * leaves past the other, at a speed that doesn't depend on the text's length.
 */
export function marquee(mode: 'height' | 'width', area: number, text: number, factor: number): { from: number; to: number; dur: number } {
  const perScreen = mode === 'height' ? 6 : 8;
  return { from: area, to: -text, dur: ((area + text) / Math.max(area, 1)) * perScreen * factor };
}
