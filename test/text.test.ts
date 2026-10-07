import { describe, expect, it } from 'vitest';
import { parseMessage, splitRawSlides, slideToPlainText } from '../src/render/text';

const plain = (msg: string) => parseMessage(msg).map((s) => slideToPlainText(s, '<CD>'));

describe('text pipeline', () => {
  it('splits slides on ||', () => {
    expect(plain('a||b||c')).toEqual(['a', 'b', 'c']);
  });

  it('honors escapes', () => {
    expect(plain('a\\||b')).toEqual(['a||b']);
    expect(plain('\\{countdown}')).toEqual(['{countdown}']);
    expect(plain('\\*not italic\\*')).toEqual(['*not italic*']);
    expect(plain('\\# not a heading')).toEqual(['# not a heading']);
    expect(plain('\\\\')).toEqual(['\\']);
    expect(plain('\\q')).toEqual(['q']);
  });

  it('renders headings, bold and italic', () => {
    const [slide] = parseMessage('# Big\n## Mid\nplain **bold** and *it* and ***both***');
    expect(slide.lines.map((l) => l.level)).toEqual([1, 2, 0]);
    expect(slide.lines[2].runs).toEqual([
      { text: 'plain ', bold: false, italic: false },
      { text: 'bold', bold: true, italic: false },
      { text: ' and ', bold: false, italic: false },
      { text: 'it', bold: false, italic: true },
      { text: ' and ', bold: false, italic: false },
      { text: 'both', bold: true, italic: true },
    ]);
  });

  it('carries emphasis across the line breaks of a paragraph', () => {
    const [slide] = parseMessage('**WELCOME HOME,\nGRANDMA!**');
    expect(slide.lines.map((l) => l.runs)).toEqual([
      [{ text: 'WELCOME HOME,', bold: true, italic: false }],
      [{ text: 'GRANDMA!', bold: true, italic: false }],
    ]);
    const [two] = parseMessage('a *b\nc* d');
    expect(two.lines[1].runs[0]).toEqual({ text: 'c', bold: false, italic: true });
  });

  it('ends emphasis at a blank line or a heading', () => {
    expect(parseMessage('**a\n\nb**')[0].lines.flatMap((l) => l.runs).some((r) => r.bold)).toBe(false);
    expect(parseMessage('**a\n# b**')[0].lines.flatMap((l) => l.runs).some((r) => r.bold)).toBe(false);
    expect(plain('**a\n\nb**')).toEqual(['**a\n\nb**']);
  });

  it('keeps code spans on one line', () => {
    const [slide] = parseMessage('a `b\nc` d');
    expect(slide.lines.flatMap((l) => l.runs).some((r) => r.code)).toBe(false);
  });

  it('leaves unmatched markers alone', () => {
    expect(plain('2 * 3 = 6')).toEqual(['2 * 3 = 6']);
    expect(plain('#nospace')).toEqual(['#nospace']);
    expect(plain('### three')).toEqual(['### three']);
  });

  it('marks countdown tokens in any slide', () => {
    const slides = parseMessage('Welcome!||Doors open in\n{countdown}||Enjoy');
    expect(slides.map((s) => s.hasCountdown)).toEqual([false, true, false]);
    expect(slideToPlainText(slides[1], '1d')).toBe('Doors open in\n1d');
  });

  it('splits raw slides without altering text', () => {
    expect(splitRawSlides('a\\||b||c *d*')).toEqual(['a\\||b', 'c *d*']);
  });
});

import { formatCountdown } from '../src/render/countdown';
describe('countdown format', () => {
  const ms = ((2 * 24 + 14) * 3600 + 6 * 60 + 32) * 1000;
  it('label', () => {
    expect(formatCountdown(ms, 'label')).toBe('2d 14h 06m 32s');
    expect(formatCountdown(24 * 3600 * 1000, 'label')).toBe('1d 00h 00m 00s');
    expect(formatCountdown((3 * 3600 + 12 * 60 + 5) * 1000, 'label')).toBe('3h 12m 05s');
    expect(formatCountdown((12 * 60 + 48) * 1000, 'label')).toBe('12m 48s');
    expect(formatCountdown(7000, 'label')).toBe('7s');
    expect(formatCountdown(-5000, 'label')).toBe('0s');
  });
  it('colon', () => {
    expect(formatCountdown(ms, 'colon')).toBe('02:14:06:32');
    expect(formatCountdown(-5000, 'colon')).toBe('00:00:00:00');
  });
});

describe('strikethrough, code and underscores', () => {
  const runs = (msg: string) => parseMessage(msg)[0].lines[0].runs;
  const styled = (msg: string) =>
    runs(msg).map((r) => [r.text, [r.bold && 'b', r.italic && 'i', r.strike && 's', r.code && 'c'].filter(Boolean).join('')]);

  it('renders ~~strikethrough~~', () => {
    expect(styled('~~$20~~ $15')).toEqual([['$20', 's'], [' $15', '']]);
    expect(styled('~~**sold** out~~')).toEqual([['sold', 'bs'], [' out', 's']]);
  });

  it('leaves single tildes alone', () => {
    expect(plain('about ~5 min')).toEqual(['about ~5 min']);
  });

  it('renders `code` verbatim', () => {
    expect(styled('Wi-Fi: `my*pass*word`')).toEqual([['Wi-Fi: ', ''], ['my*pass*word', 'c']]);
    expect(styled('`C:\\temp\\new`')).toEqual([['C:\\temp\\new', 'c']]);
    expect(styled('`a||b`')).toEqual([['a||b', 'c']]);
    expect(styled('`{countdown}`')).toEqual([['{countdown}', 'c']]);
    expect(styled('`# not a heading`')).toEqual([['# not a heading', 'c']]);
    expect(parseMessage('`a||b`')).toHaveLength(1);
  });

  it('keeps an unmatched backtick literal', () => {
    expect(plain('it`s')).toEqual(['it`s']);
    expect(plain('`open\nclose`')).toEqual(['`open\nclose`']);
  });

  it('renders _italic_, __bold__ and ___both___', () => {
    expect(styled('_soft_ and __loud__ and ___both___')).toEqual([
      ['soft', 'i'],
      [' and ', ''],
      ['loud', 'b'],
      [' and ', ''],
      ['both', 'bi'],
    ]);
  });

  it('ignores underscores inside words', () => {
    expect(plain('Home_Guest_5G')).toEqual(['Home_Guest_5G']);
    expect(plain('snake_case_name and __init__')).toEqual(['snake_case_name and init']);
    expect(plain('my_wifi_ and _x')).toEqual(['my_wifi_ and _x']);
    expect(plain('first_name@example.com')).toEqual(['first_name@example.com']);
    expect(plain('a _ b _ c')).toEqual(['a _ b _ c']);
    expect(styled('_a and __b__ then _c')).toEqual([
      ['_a and ', ''],
      ['b', 'b'],
      [' then _c', ''],
    ]);
  });

  it('parses many unclosed underscores in linear time', () => {
    const msg = '_a '.repeat(20000);
    const t = performance.now();
    expect(plain(msg)).toEqual([msg]);
    // Quadratic scanning took seconds here; linear takes a few milliseconds.
    expect(performance.now() - t).toBeLessThan(500);
  });

  it('escapes the new characters', () => {
    expect(plain('\\~\\~not struck\\~\\~')).toEqual(['~~not struck~~']);
    expect(plain('\\`not code\\`')).toEqual(['`not code`']);
    expect(plain('\\_not italic\\_')).toEqual(['_not italic_']);
  });

  it('splits raw slides around code spans', () => {
    expect(splitRawSlides('`a||b`||c')).toEqual(['`a||b`', 'c']);
  });
});
