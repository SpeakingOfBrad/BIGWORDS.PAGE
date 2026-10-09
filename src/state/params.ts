import { parseSize, type SizeValue } from './size';
import type { State } from './fragment';

export const ANIMATIONS = ['none', 'pulse', 'flash', 'shake', 'bounce', 'scroll', 'crawl', 'typewriter', 'fadein', 'rainbow'] as const;
export const SPEEDS = ['slow', 'normal', 'fast'] as const;
export const QR_POSITIONS = ['tl', 'tr', 'bl', 'br', 'below'] as const;
export const IMG_POSITIONS = ['bg', 'full', 'above', 'below'] as const;
export const CD_FORMATS = ['label', 'colon'] as const;
export const TRANSITIONS = ['slide', 'none', 'fade', 'up', 'zoom'] as const;

export type Animation = (typeof ANIMATIONS)[number];
export type Speed = (typeof SPEEDS)[number];
export type QrPos = (typeof QR_POSITIONS)[number];
export type ImgPos = (typeof IMG_POSITIONS)[number];
export type CdFormat = (typeof CD_FORMATS)[number];
export type Transition = (typeof TRANSITIONS)[number];
export type ZeroBehavior = { kind: 'freeze' } | { kind: 'hide' } | { kind: 'message'; message: string };

/** Fully validated display settings. Invalid input always falls back to the default. */
export interface Settings {
  message: string;
  bg: string | null; // hex without '#', null = auto
  fg: string | null;
  font: number;
  size: SizeValue | null; // null = auto
  sizeMin: SizeValue | null;
  sizeMax: SizeValue | null;
  pad: [number, number, number, number]; // top, right, bottom, left (percent)
  anim: Animation;
  speed: Speed;
  ratio: [number, number] | null;
  qr: string | null;
  qrpos: QrPos;
  qrsize: number; // percent of the display's shorter side
  img: string | null;
  imgpos: ImgPos;
  refresh: number | null;
  until: Date | null;
  timer: number | null; // seconds, counted from page load
  cdfmt: CdFormat;
  zero: ZeroBehavior;
  interval: number; // seconds, to hundredths
  trans: Transition;
  wake: boolean;
}

/** Canonical parameter order and the default value of each, as written in a URL. */
export const PARAM_DEFAULTS: Readonly<Record<string, string>> = {
  bg: 'auto',
  fg: 'auto',
  font: '0',
  size: 'auto',
  'size-min': '',
  'size-max': '',
  pad: '5',
  anim: 'none',
  speed: 'normal',
  ratio: '',
  qr: '',
  qrpos: 'br',
  qrsize: '25',
  img: '',
  imgpos: 'bg',
  refresh: '',
  until: '',
  timer: '',
  cdfmt: 'label',
  zero: 'freeze',
  interval: '5',
  trans: 'slide',
  wake: 'on',
};
export const PARAM_ORDER = Object.keys(PARAM_DEFAULTS);

const HEX_RE = /^[0-9a-f]{6}$/i;
const INT_RE = /^\d+$/;

function oneOf<T extends string>(list: readonly T[], v: string | undefined, def: T): T {
  const lv = v?.trim().toLowerCase();
  return (list as readonly string[]).includes(lv ?? '') ? (lv as T) : def;
}

function hex(v: string | undefined): string | null {
  const s = v?.trim().replace(/^#/, '') ?? '';
  return HEX_RE.test(s) ? s.toLowerCase() : null;
}

function posInt(v: string | undefined): number | null {
  const s = v?.trim() ?? '';
  if (!INT_RE.test(s)) return null;
  const n = parseInt(s, 10);
  return n > 0 && Number.isSafeInteger(n) ? n : null;
}

/** Longest `refresh` or `interval`, in seconds. Browsers fire timers set past ~24.8 days at once. */
export const MAX_SECONDS = 86400;

function seconds(v: string | undefined): number | null {
  const n = posInt(v);
  return n === null ? null : Math.min(n, MAX_SECONDS);
}

/** Shortest `interval`, in seconds. */
export const MIN_INTERVAL = 0.2;
/** At or below this `interval`, slides change twice a second or more: the editor warns. */
export const FAST_INTERVAL = 0.5;

/** Seconds per slide: a positive decimal, rounded to hundredths and kept within MIN_INTERVAL and MAX_SECONDS. */
export function parseInterval(v: string | undefined): number | null {
  const s = v?.trim() ?? '';
  if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = parseFloat(s);
  if (!(n > 0)) return null;
  return Math.min(MAX_SECONDS, Math.max(MIN_INTERVAL, Math.round(n * 100) / 100));
}

export function parsePad(v: string | undefined): [number, number, number, number] | null {
  if (v === undefined) return null;
  const parts = v.split(',').map((p) => p.trim());
  if (![1, 2, 4].includes(parts.length)) return null;
  const nums = parts.map((p) => (/^\d+(\.\d+)?$/.test(p) ? parseFloat(p) : NaN));
  if (nums.some((n) => !Number.isFinite(n) || n < 0 || n >= 50)) return null;
  if (nums.length === 1) return [nums[0], nums[0], nums[0], nums[0]];
  if (nums.length === 2) return [nums[0], nums[1], nums[0], nums[1]];
  return nums as [number, number, number, number];
}

/** Shortest CSS-shorthand form of a padding tuple. */
export function formatPad(p: readonly number[]): string {
  const [t, r, b, l] = p.map((n) => String(Math.round(n * 100) / 100));
  if (t === r && r === b && b === l) return t;
  if (t === b && r === l) return `${t},${r}`;
  return `${t},${r},${b},${l}`;
}

export function parseRatio(v: string | undefined): [number, number] | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*[:x×/]\s*(\d+(?:\.\d+)?)\s*$/i.exec(v ?? '');
  if (!m) return null;
  const w = parseFloat(m[1]);
  const h = parseFloat(m[2]);
  return w > 0 && h > 0 ? [w, h] : null;
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3})\d*)?)?)?(Z|[+-]\d{2}:?\d{2})?$/i;

/** ISO 8601 datetime. Without a zone designator it is interpreted in local time. */
export function parseUntil(v: string | undefined): Date | null {
  const m = ISO_RE.exec(v?.trim() ?? '');
  if (!m) return null;
  const [, y, mo, d, h = '0', mi = '0', s = '0', ms = '0', zone] = m;
  const parts = [+y, +mo - 1, +d, +h, +mi, +s, +ms.padEnd(3, '0')] as const;
  if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31 || +h > 23 || +mi > 59 || +s > 59) return null;
  let date: Date;
  if (zone) {
    let offset = 0;
    if (zone.toUpperCase() !== 'Z') {
      const z = zone.replace(':', '');
      offset = (z[0] === '-' ? -1 : 1) * (parseInt(z.slice(1, 3), 10) * 60 + parseInt(z.slice(3, 5), 10));
    }
    date = new Date(Date.UTC(...parts) - offset * 60_000);
  } else {
    date = new Date(...parts);
  }
  // Reject impossible dates such as Feb 30.
  const check = zone ? new Date(Date.UTC(...parts)) : date;
  const day = zone ? check.getUTCDate() : check.getDate();
  if (Number.isNaN(date.getTime()) || day !== +d) return null;
  return date;
}

/** Longest `timer`, in seconds (99 days). */
export const MAX_TIMER = 99 * 86400;

const UNIT_SECONDS: Record<string, number> = { d: 86400, h: 3600, m: 60, s: 1 };

/**
 * A `timer` length in seconds: a whole number of seconds (`14400`), or amounts
 * of d, h, m and s in any order (`4h`, `1h30m`, `30m1h`). Repeated units add up
 * and a unit may overflow into the next (`90m` is 1h 30m). Longer than
 * MAX_TIMER counts as MAX_TIMER.
 */
export function parseTimer(v: string | undefined): number | null {
  const str = v?.trim().toLowerCase().replace(/\s+/g, '') ?? '';
  let total: number;
  if (INT_RE.test(str)) total = parseInt(str, 10);
  else if (/^(\d+[dhms])+$/.test(str)) {
    total = 0;
    for (const [, n, unit] of str.matchAll(/(\d+)([dhms])/g)) total += parseInt(n, 10) * UNIT_SECONDS[unit];
  } else return null;
  return total > 0 ? Math.min(total, MAX_TIMER) : null;
}

/** Seconds as the shortest `timer` value, largest unit first (`2d4h`, `1h30m`). */
export function formatTimer(total: number): string {
  let rest = Math.max(0, Math.floor(total));
  let out = '';
  for (const [unit, size] of Object.entries(UNIT_SECONDS)) {
    const n = Math.floor(rest / size);
    rest -= n * size;
    if (n) out += `${n}${unit}`;
  }
  return out;
}

/**
 * `until` and `timer` are mutually exclusive: whichever comes first in the URL
 * is used and the other is ignored.
 */
export function countdownSource(params: Record<string, string>): 'until' | 'timer' | null {
  for (const k of Object.keys(params)) {
    if ((k === 'until' || k === 'timer') && params[k].trim() !== '') return k;
  }
  return null;
}

/** Smallest and largest `qrsize`, in percent of the display's shorter side. */
export const QR_SIZE_MIN = 10;
export const QR_SIZE_MAX = 50;

function qrSize(v: string | undefined): number {
  const n = posInt(v);
  return n === null ? 25 : Math.min(QR_SIZE_MAX, Math.max(QR_SIZE_MIN, n));
}

function url(v: string | undefined): string | null {
  const s = v?.trim() ?? '';
  return s ? s : null;
}

function imageUrl(v: string | undefined): string | null {
  const s = url(v);
  if (!s) return null;
  return /^(https?:\/\/|data:image\/)/i.test(s) ? s : null;
}

export function resolveSettings(state: State): Settings {
  const p = state.params;
  const size = p.size?.trim().toLowerCase() === 'auto' ? null : parseSize(p.size ?? '');
  const zeroRaw = p.zero ?? '';
  const zeroKey = zeroRaw.trim().toLowerCase();
  const source = countdownSource(p);
  const zero: ZeroBehavior =
    zeroKey === 'hide' ? { kind: 'hide' } : zeroKey === 'freeze' || zeroRaw.trim() === '' ? { kind: 'freeze' } : { kind: 'message', message: zeroRaw };
  return {
    message: state.message,
    bg: hex(p.bg),
    fg: hex(p.fg),
    font: /^[0-6]$/.test(p.font?.trim() ?? '') ? parseInt(p.font, 10) : 0,
    size,
    sizeMin: parseSize(p['size-min'] ?? ''),
    sizeMax: parseSize(p['size-max'] ?? ''),
    pad: parsePad(p.pad) ?? [5, 5, 5, 5],
    anim: oneOf(ANIMATIONS, p.anim, 'none'),
    speed: oneOf(SPEEDS, p.speed, 'normal'),
    ratio: parseRatio(p.ratio),
    qr: url(p.qr),
    qrpos: oneOf(QR_POSITIONS, p.qrpos, 'br'),
    qrsize: qrSize(p.qrsize),
    img: imageUrl(p.img),
    imgpos: oneOf(IMG_POSITIONS, p.imgpos, 'bg'),
    refresh: seconds(p.refresh),
    until: source === 'until' ? parseUntil(p.until) : null,
    timer: source === 'timer' ? parseTimer(p.timer) : null,
    cdfmt: oneOf(CD_FORMATS, p.cdfmt, 'label'),
    zero,
    interval: parseInterval(p.interval) ?? 5,
    trans: oneOf(TRANSITIONS, p.trans, 'slide'),
    wake: (p.wake?.trim().toLowerCase() ?? 'on') !== 'off',
  };
}

/** Drop params that are empty or equal to their default, so generated URLs stay short. */
export function pruneDefaults(params: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v.trim() === '') continue;
    const def = PARAM_DEFAULTS[k];
    if (def !== undefined && v.trim().toLowerCase() === def) continue;
    if (k === 'pad' && formatPad(parsePad(v) ?? []) === '5') continue;
    out[k] = v;
  }
  return out;
}
