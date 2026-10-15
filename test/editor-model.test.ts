import { describe, expect, it } from 'vitest';
import {
  STARTER,
  URL_LIMIT,
  URL_WARN,
  animationAdvice,
  countdownHint,
  isFloatingUntil,
  linkLength,
  loadState,
  localInputToUtc,
  pastedHash,
  qrLinkNote,
  ratioFromPixels,
  slideAdvice,
  slideRange,
  timerParts,
  timerTotal,
  toLocalInput,
  untilHint,
} from '../src/editor/model';
import { resolveSettings } from '../src/state/params';

const settings = (params: Record<string, string>, message = 'Hi') => resolveSettings({ message, params });

describe('loadState', () => {
  it('starts from the starter message without a fragment', () => {
    expect(loadState('')).toEqual(STARTER);
    expect(loadState('#')).toEqual(STARTER);
    expect(loadState('')).not.toBe(STARTER);
  });

  it('keeps only the countdown that comes first in the URL', () => {
    expect(loadState('#Hi&timer=5m&until=2030-01-01T00:00:00Z').params).toEqual({ timer: '5m' });
    expect(loadState('#Hi&until=2030-01-01T00:00:00Z&timer=5m').params).toEqual({ until: '2030-01-01T00:00:00Z' });
  });
});

describe('pastedHash', () => {
  it('takes the fragment of a pasted link', () => {
    expect(pastedHash(' https://example.com/#Hi&bg=000000 ')).toBe('#Hi&bg=000000');
  });

  it('loads the starter message for a link without a fragment', () => {
    expect(pastedHash('https://example.com/')).toBe('');
  });

  it('takes anything else as a fragment', () => {
    expect(pastedHash('Hello&anim=pulse')).toBe('#Hello&anim=pulse');
  });
});

describe('dates', () => {
  it('round-trips a local time through UTC', () => {
    const d = new Date(2030, 5, 15, 9, 5, 7);
    expect(toLocalInput(d)).toBe('2030-06-15T09:05:07');
    expect(localInputToUtc(toLocalInput(d))).toBe(d.toISOString().replace('.000Z', 'Z'));
  });

  it('gives nothing for an unreadable time', () => {
    expect(localInputToUtc('')).toBe('');
    expect(localInputToUtc('soon')).toBe('');
  });

  it('spots an until without a time zone', () => {
    expect(isFloatingUntil('2030-01-01T09:00')).toBe(true);
    expect(isFloatingUntil('2030-01-01T09:00:00Z')).toBe(false);
    expect(isFloatingUntil('2030-01-01T09:00+02:00')).toBe(false);
    expect(isFloatingUntil('2030-01-01T09:00-0500 ')).toBe(false);
  });
});

describe('ratioFromPixels', () => {
  it('reduces a pixel size to its ratio', () => {
    expect(ratioFromPixels(1920, 1080)).toBe('16:9');
    expect(ratioFromPixels(1024, 768)).toBe('4:3');
    expect(ratioFromPixels(1080.4, 1920)).toBe('9:16');
  });

  it('refuses sizes that are not positive', () => {
    expect(ratioFromPixels(0, 1080)).toBeNull();
    expect(ratioFromPixels(NaN, 1080)).toBeNull();
  });
});

describe('timer fields', () => {
  it('splits seconds into days, hours, minutes and seconds', () => {
    expect(timerParts(90061)).toEqual([1, 1, 1, 1]);
    expect(timerParts(5400)).toEqual([0, 1, 30, 0]);
  });

  it('adds up any amounts, ignoring fields that are not whole numbers', () => {
    expect(timerTotal(['', '', '90', ''])).toBe(5400);
    expect(timerTotal(['', '28', '', ''])).toBe(100800);
    expect(timerTotal(['1.5', '-1', 'x', '30'])).toBe(30);
  });
});

describe('slideRange', () => {
  it('finds a slide in the message', () => {
    const msg = 'one||two||three';
    expect(slideRange(msg, 0)).toEqual([0, 3]);
    expect(slideRange(msg, 1)).toEqual([5, 8]);
    expect(msg.slice(...slideRange(msg, 2))).toBe('three');
  });
});

describe('linkLength', () => {
  it('warns as a link nears the length apps keep, and past it', () => {
    expect(linkLength(URL_WARN - 1)).toEqual({ level: 'ok', advice: '' });
    expect(linkLength(URL_WARN).level).toBe('warn');
    expect(linkLength(URL_LIMIT).level).toBe('warn');
    expect(linkLength(URL_LIMIT + 1).level).toBe('over');
    expect(linkLength(URL_LIMIT + 1).advice).toContain('cut links off');
  });
});

describe('qrLinkNote', () => {
  it('says when the link is too long or makes a dense code', () => {
    expect(qrLinkNote(false, 3000)).toContain('too long');
    expect(qrLinkNote(true, 601)).toContain('dense');
    expect(qrLinkNote(true, 100)).toContain('Point a phone');
  });
});

describe('advice', () => {
  it('recommends a maximum size for marquees', () => {
    expect(animationAdvice(settings({ anim: 'scroll' }))).toContain('screen height');
    expect(animationAdvice(settings({ anim: 'crawl' }))).toContain('screen width');
    expect(animationAdvice(settings({ anim: 'scroll', 'size-max': '30vh' }))).toBe('');
  });

  it('warns about fast flashing, and rainbow over a set text color', () => {
    expect(animationAdvice(settings({ anim: 'flash', speed: 'fast' }))).toContain('Photosensitivity');
    expect(animationAdvice(settings({ anim: 'flash' }))).toBe('');
    expect(animationAdvice(settings({ anim: 'rainbow', fg: 'ff0000' }))).toContain('Rainbow');
  });

  it('warns about fast slides only when there are several', () => {
    expect(slideAdvice(settings({ interval: '0.5' }), 2)).toContain('Photosensitivity');
    expect(slideAdvice(settings({ interval: '0.5' }), 1)).toBe('');
    expect(slideAdvice(settings({ interval: '3' }), 2)).toBe('');
  });
});

describe('countdown hints', () => {
  it('asks for {countdown} when a countdown is set and the message lacks it', () => {
    expect(countdownHint(settings({ timer: '5m' }), 'Break')).toContain('left on the timer');
    expect(countdownHint(settings({ until: '2030-01-01T00:00:00Z' }), 'Launch')).toContain('remaining');
    expect(countdownHint(settings({ timer: '5m' }), 'Break {countdown}')).toContain('Put {countdown}');
    expect(countdownHint(settings({}), 'Hi')).toContain('Put {countdown}');
  });

  it('explains time zones', () => {
    expect(untilHint(false, 'Europe/Paris')).toContain('(Europe/Paris)');
    expect(untilHint(true, 'Europe/Paris')).toContain('no time zone');
  });
});
