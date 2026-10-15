import { describe, expect, it } from 'vitest';
import { renderBlock } from '../src/render/block';
import { activeSlides } from '../src/render/slides';
import { parseSingle, slideToPlainText } from '../src/render/text';

const plain = (message: string, countdown: Parameters<typeof activeSlides>[1]) => activeSlides(message, countdown).map((s) => slideToPlainText(s, '<CD>'));
const running = { expired: false, zero: { kind: 'hide' } as const };

describe('activeSlides', () => {
  it('shows the message as slides', () => {
    expect(plain('a||b', null)).toEqual(['a', 'b']);
  });

  it('shows just the countdown for an empty message with one', () => {
    expect(plain('  ', running)).toEqual(['<CD>']);
    expect(plain('', null)).toEqual(['']);
  });

  it('keeps everything while the countdown runs, or at zero with freeze', () => {
    expect(plain('Go {countdown}||x', running)).toEqual(['Go <CD>', 'x']);
    expect(plain('Go {countdown}||x', { expired: true, zero: { kind: 'freeze' } })).toEqual(['Go <CD>', 'x']);
  });

  it('at zero, hides the slides with the countdown', () => {
    const zero = { expired: true, zero: { kind: 'hide' } as const };
    expect(plain('Go {countdown}||x', zero)).toEqual(['x']);
    expect(plain('only text', zero)).toEqual([]);
  });

  it('at zero, replaces the slides with the countdown by the message', () => {
    const zero = { expired: true, zero: { kind: 'message', message: '**Now!**' } as const };
    expect(plain('Go {countdown}||x', zero)).toEqual(['Now!', 'x']);
    expect(plain('single', zero)).toEqual(['Now!']);
  });
});

describe('renderBlock', () => {
  it('renders lines and styled runs', () => {
    const block = renderBlock(parseSingle('# Title\n**bold** *it* ~~gone~~ `code`\n\nend'), null);
    const lines = [...block.children];
    expect(lines.map((l) => l.className)).toEqual(['bw-line bw-h1', 'bw-line', 'bw-line', 'bw-line']);
    expect(lines[0].textContent).toBe('Title');
    expect([...lines[1].children].map((s) => [s.className, s.textContent])).toEqual([
      ['bw-b', 'bold'],
      ['', ' '],
      ['bw-i', 'it'],
      ['', ' '],
      ['bw-s', 'gone'],
      ['', ' '],
      ['bw-code', 'code'],
    ]);
    expect(lines[2].innerHTML).toBe('<br>');
  });

  it('fills countdowns with the time, or leaves the token without a countdown', () => {
    const slide = parseSingle('T-{countdown}');
    const counting = renderBlock(slide, '5s').querySelector('.bw-cd');
    expect(counting?.textContent).toBe('5s');
    const block = renderBlock(slide, null);
    expect(block.querySelector('.bw-cd')).toBeNull();
    expect(block.textContent).toBe('T-{countdown}');
  });
});
