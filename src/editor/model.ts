// The editor's logic that doesn't touch the page: loading links, converting
// between form fields and parameters, and the advice it shows.
import { splitRawSlides } from '../render/text';
import { parseFragment, type State } from '../state/fragment';
import { FAST_INTERVAL, countdownSource, type Settings } from '../state/params';

export const STARTER: State = { message: 'Hello, **world**!', params: {} };
export const URL_WARN = 1800;
export const URL_LIMIT = 2000;
/** Above this many characters a QR code gets dense enough to be hard to scan from a screen. */
export const QR_DENSE = 600;

/**
 * `until` and `timer` are mutually exclusive and the first in the URL wins.
 * The editor writes params in a fixed order, so drop the one that lost before
 * it could end up first.
 */
export function loadState(hash: string): State {
  if (hash.length <= 1) return structuredClone(STARTER);
  const state = parseFragment(hash);
  const source = countdownSource(state.params);
  if (source === 'until') delete state.params.timer;
  if (source === 'timer') delete state.params.until;
  return state;
}

/**
 * What a link pasted into the URL field loads: its fragment, or the starter
 * message for a link without one (the home page). Text that isn't a link is
 * taken as a fragment.
 */
export function pastedHash(value: string): string {
  const v = value.trim();
  const i = v.indexOf('#');
  if (i >= 0) return v.slice(i);
  if (/^[a-z]+:\/\//i.test(v)) return '';
  return `#${v}`;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** A date as a datetime-local input value, in the editing device's time zone. */
export function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** A datetime-local input value (local time) as a UTC `until` value. */
export function localInputToUtc(v: string): string {
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toISOString().replace(/\.\d+Z$/, 'Z');
}

/** An `until` value without a time zone, which each device reads in its own. */
export function isFloatingUntil(raw: string): boolean {
  return !/(Z|[+-]\d{2}:?\d{2})$/i.test(raw.trim());
}

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

/** A pixel size as a ratio in lowest terms (1920 × 1080 → 16:9), or null for sizes that aren't positive. */
export function ratioFromPixels(w: number, h: number): string | null {
  w = Math.round(w);
  h = Math.round(h);
  if (!(w > 0 && h > 0)) return null;
  const g = gcd(w, h);
  return `${w / g}:${h / g}`;
}

export const TIMER_UNITS = [
  ['Days', 86400],
  ['Hours', 3600],
  ['Minutes', 60],
  ['Seconds', 1],
] as const;

/** A timer's length in seconds as whole days, hours, minutes and seconds. */
export function timerParts(seconds: number): number[] {
  let rest = seconds;
  return TIMER_UNITS.map(([, unit]) => {
    const n = Math.floor(rest / unit);
    rest -= n * unit;
    return n;
  });
}

/** The total of the timer's fields in seconds. Any amounts add up (90 minutes, 28 hours); fields that aren't whole numbers count as 0. */
export function timerTotal(values: string[]): number {
  return values.reduce((sum, v, i) => sum + (/^\d+$/.test(v) ? +v * TIMER_UNITS[i][1] : 0), 0);
}

/** Where slide `i` is in the message, as a selection range. */
export function slideRange(message: string, i: number): [number, number] {
  const slides = splitRawSlides(message);
  let start = 0;
  for (let k = 0; k < i; k++) start += slides[k].length + 2;
  return [start, start + (slides[i]?.length ?? 0)];
}

export type LinkLevel = 'ok' | 'warn' | 'over';

/** How long a viewer link is, against what messaging apps and email clients reliably keep. */
export function linkLength(n: number): { level: LinkLevel; advice: string } {
  const level: LinkLevel = n > URL_LIMIT ? 'over' : n >= URL_WARN ? 'warn' : 'ok';
  const advice =
    level === 'ok'
      ? ''
      : level === 'over'
        ? `This link is ${n.toLocaleString()} characters. Some messaging apps, email clients and proxies cut links off after about 2,000.`
        : `This link is getting long (${n.toLocaleString()} characters). Links over about 2,000 may be cut off by some apps.`;
  return { level, advice };
}

/** The note under the viewer link's QR code. */
export function qrLinkNote(encoded: boolean, length: number): string {
  if (!encoded) return 'This link is too long for a QR code. Shorten the message or remove the image to make one.';
  if (length > QR_DENSE) return 'This link is long, so the code is dense. Hold the camera close, or shorten the message for a code that scans more easily.';
  return 'Point a phone or tablet camera at the code to open the display on it.';
}

/** A warning about the animation settings, or ''. */
export function animationAdvice(s: Settings): string {
  if ((s.anim === 'scroll' || s.anim === 'crawl') && !s.sizeMax) {
    return `${s.anim === 'scroll' ? 'Scroll fits the text to the screen height' : 'Crawl fits the text to the screen width'}, so short messages get very large. Setting a maximum size (for example 30vh) is recommended.`;
  }
  if (s.anim === 'flash' && s.speed === 'fast') {
    return 'Photosensitivity warning: fast flashing can trigger seizures in people with photosensitive epilepsy. Consider a slower speed.';
  }
  if (s.anim === 'rainbow' && s.fg) return 'Rainbow overrides the text color while it runs.';
  return '';
}

/** A warning about slides changing quickly, or ''. */
export function slideAdvice(s: Settings, slideCount: number): string {
  return slideCount > 1 && s.interval <= FAST_INTERVAL
    ? 'Photosensitivity warning: slides changing this quickly can trigger seizures in people with photosensitive epilepsy, especially with large, high-contrast text. Consider a longer time per slide.'
    : '';
}

/** The hint under the countdown settings: where {countdown} goes, or that it's missing. */
export function countdownHint(s: Settings, message: string): string {
  return (s.until || s.timer) && !message.includes('{countdown}') && message.trim()
    ? `Add {countdown} to the message to show the time ${s.timer ? 'left on the timer' : 'remaining'}.`
    : 'Put {countdown} in the message where the time should show.';
}

export function untilHint(floating: boolean, timeZone: string): string {
  return floating
    ? 'This link has no time zone, so each viewing device counts down to this time in its own zone. Pick a time to pin it to one moment everywhere.'
    : `Pick the time in your time zone (${timeZone}). It goes in the URL as UTC, so the countdown ends at the same moment everywhere.`;
}

export const TIMER_HINT = 'Every screen runs its own timer from when it opens the link. Reloading the page or opening the link again starts it over.';
