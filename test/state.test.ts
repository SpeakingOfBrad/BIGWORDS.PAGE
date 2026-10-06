import { describe, expect, it } from 'vitest';
import { parseFragment, serializeFragment, safeDecode } from '../src/state/fragment';
import { PARAM_ORDER, parsePad, formatPad, parseRatio, parseUntil, pruneDefaults, resolveSettings } from '../src/state/params';
import { parseSize, sizeToPx } from '../src/state/size';

describe('fragment', () => {
  it('splits message from params on the first unencoded &', () => {
    const s = parseFragment('#Hello%20World%26more&bg=000000&fg=ffffff&anim=pulse');
    expect(s.message).toBe('Hello World&more');
    expect(s.params).toEqual({ bg: '000000', fg: 'ffffff', anim: 'pulse' });
  });

  it('undoes a second round of percent-encoding', () => {
    const s = parseFragment('#Hello,%2520**world**!%257C%257C%257Bcountdown%257D&until=2026-10-06T18:15:00Z&bg=%2523000000');
    expect(s.message).toBe('Hello, **world**!||{countdown}');
    expect(s.params).toEqual({ until: '2026-10-06T18:15:00Z', bg: '#000000' });
  });

  it('keeps a literal %XX when the fragment is encoded once', () => {
    expect(parseFragment('#50%25%20off%2520today').message).toBe('50% off%20today');
    expect(parseFragment('#100%25').message).toBe('100%');
  });

  it('handles a fragment with no message', () => {
    const s = parseFragment('#&bg=ff0000');
    expect(s.message).toBe('');
    expect(s.params.bg).toBe('ff0000');
  });

  it('decodes newlines, percent signs and literal pipes', () => {
    expect(parseFragment('a%0Ab%25c|d').message).toBe('a\nb%c|d');
  });

  it('survives malformed percent-encoding', () => {
    expect(safeDecode('100%')).toBe('100%');
    expect(safeDecode('a%20b%zz')).toBe('a b%zz');
    expect(safeDecode('%E2%82')).toBe('%E2%82');
  });

  it('round-trips through serialize', () => {
    const state = { message: 'Hi & #1 100%\nnext || {countdown} \\* ok', params: { until: '2026-12-31T19:00:00', qr: 'https://x.dev/a?b=1&c=2', bg: '112233' } };
    const hash = serializeFragment(state, PARAM_ORDER);
    expect(hash).toContain('until=2026-12-31T19:00:00');
    expect(hash.startsWith('Hi%20%26%20%231%20100%25%0Anext%20%7C%7C%20%7Bcountdown%7D%20%5C*%20ok&bg=112233')).toBe(true);
    expect(parseFragment(hash)).toEqual(state);
  });
});

describe('params', () => {
  it('falls back to defaults on invalid values', () => {
    const s = resolveSettings({ message: '', params: { bg: 'red', font: '9', anim: 'spin', pad: '1,2,3', interval: '-2', until: '2026-02-30T10:00', wake: 'maybe' } });
    expect(s.bg).toBeNull();
    expect(s.font).toBe(0);
    expect(s.anim).toBe('none');
    expect(s.pad).toEqual([5, 5, 5, 5]);
    expect(s.interval).toBe(5);
    expect(s.until).toBeNull();
    expect(s.wake).toBe(true);
  });

  it('caps refresh and interval so browser timers never overflow', () => {
    const s = resolveSettings({ message: '', params: { refresh: '2147484', interval: '9999999999' } });
    expect(s.refresh).toBe(86400);
    expect(s.interval).toBe(86400);
    expect(resolveSettings({ message: '', params: { refresh: '30', interval: '86400' } })).toMatchObject({ refresh: 30, interval: 86400 });
  });

  it('parses padding shorthand', () => {
    expect(parsePad('5')).toEqual([5, 5, 5, 5]);
    expect(parsePad('5,10')).toEqual([5, 10, 5, 10]);
    expect(parsePad('1,2,3,4')).toEqual([1, 2, 3, 4]);
    expect(parsePad('1,2,3')).toBeNull();
    expect(formatPad([5, 10, 5, 10])).toBe('5,10');
    expect(formatPad([3, 3, 3, 3])).toBe('3');
  });

  it('parses ratios', () => {
    expect(parseRatio('16:9')).toEqual([16, 9]);
    expect(parseRatio('0:9')).toBeNull();
    expect(parseRatio('wide')).toBeNull();
  });

  it('parses until in local time', () => {
    const d = parseUntil('2026-12-31T23:59:00')!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getHours()).toBe(23);
    expect(d.getMinutes()).toBe(59);
    expect(parseUntil('2026-12-31T23:59:00Z')!.toISOString()).toBe('2026-12-31T23:59:00.000Z');
    expect(parseUntil('nope')).toBeNull();
  });

  it('zero accepts freeze, hide or a message', () => {
    expect(resolveSettings({ message: '', params: { zero: 'hide' } }).zero).toEqual({ kind: 'hide' });
    expect(resolveSettings({ message: '', params: { zero: 'Go!' } }).zero).toEqual({ kind: 'message', message: 'Go!' });
  });

  it('qrsize is a percent from 10 to 50, defaulting to 25', () => {
    const qrsize = (v?: string) => resolveSettings({ message: '', params: v === undefined ? {} : { qrsize: v } }).qrsize;
    expect(qrsize()).toBe(25);
    expect(qrsize('40')).toBe(40);
    expect(qrsize('5')).toBe(10);
    expect(qrsize('90')).toBe(50);
    expect(qrsize('big')).toBe(25);
  });

  it('prunes defaults', () => {
    expect(pruneDefaults({ bg: 'auto', fg: 'ffffff', pad: '5,5', anim: 'none', speed: 'fast', qr: '', qrsize: '25' })).toEqual({ fg: 'ffffff', speed: 'fast' });
  });
});

describe('size', () => {
  it('parses px, vh, vw', () => {
    expect(parseSize('48')).toEqual({ value: 48, unit: 'px' });
    expect(parseSize('5vh')).toEqual({ value: 5, unit: 'vh' });
    expect(parseSize('8VW')).toEqual({ value: 8, unit: 'vw' });
    expect(parseSize('auto')).toBeNull();
    expect(parseSize('0')).toBeNull();
    expect(sizeToPx({ value: 10, unit: 'vh' }, 1000, 500)).toBe(50);
    expect(sizeToPx({ value: 10, unit: 'vw' }, 1000, 500)).toBe(100);
  });
});
