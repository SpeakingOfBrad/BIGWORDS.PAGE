import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { typewriter } from '../src/render/animation';
import { breakableSpaces, renderBlock } from '../src/render/block';
import { displayColors, luminance, rainbowLightness } from '../src/render/colors';
import { parseSingle } from '../src/render/text';
import { planTransition, slideTravel } from '../src/render/transitions';

describe('colors', () => {
  it('follows the system scheme unless colors are set', () => {
    expect(displayColors(null, null, false)).toEqual({ bg: '#000000', fg: '#ffffff' });
    expect(displayColors(null, null, true)).toEqual({ bg: '#ffffff', fg: '#000000' });
    expect(displayColors('112233', null, true)).toEqual({ bg: '#112233', fg: '#000000' });
  });

  it('computes relative luminance', () => {
    expect(luminance('000000')).toBe(0);
    expect(luminance('ffffff')).toBeCloseTo(1);
    expect(luminance('ff0000')).toBeCloseTo(0.2126);
  });

  it('darkens rainbow text on light backgrounds', () => {
    expect(rainbowLightness('#ffffff')).toBe('38%');
    expect(rainbowLightness('#000000')).toBe('62%');
  });
});

describe('planTransition', () => {
  const travel = { x: 1001, y: 601 };

  it('uses the transition for at most 0.6s', () => {
    const plan = planTransition('slide', 5, false, travel);
    expect(plan?.duration).toBe(600);
    expect(plan?.incoming).toEqual([{ transform: 'translateX(1001px)' }, { transform: 'translateX(0)' }]);
    expect(plan?.outgoing).toEqual([{ transform: 'translateX(0)' }, { transform: 'translateX(-1001px)' }]);
  });

  it('slides up by the vertical travel', () => {
    const plan = planTransition('up', 5, false, travel);
    expect(plan?.incoming).toEqual([{ transform: 'translateY(601px)' }, { transform: 'translateY(0)' }]);
    expect(plan?.outgoing).toEqual([{ transform: 'translateY(0)' }, { transform: 'translateY(-601px)' }]);
  });

  it('takes no more than 40% of the interval', () => {
    expect(planTransition('fade', 1, false, travel)?.duration).toBe(400);
  });

  it('cuts when asked to, or when the interval is too short to animate', () => {
    expect(planTransition('none', 5, false, travel)).toBeNull();
    expect(planTransition('slide', 0.1, false, travel)).toBeNull();
  });

  it('fades instead of moving when reduced motion is on', () => {
    const fade = planTransition('fade', 5, false, travel);
    expect(planTransition('zoom', 5, true, travel)).toEqual(fade);
    expect(planTransition('none', 5, true, travel)).toBeNull();
  });
});

describe('slideTravel', () => {
  it('moves both slides past the display edges', () => {
    // Text filling a 900x500 area inside a 1000x600 display: 100% of the
    // area would leave 50px of each slide on screen.
    const text = { left: 50, top: 50, right: 950, bottom: 550 };
    expect(slideTravel(1000, 600, text, text)).toEqual({ x: 951, y: 551 });
  });

  it('covers text that spills past the display', () => {
    const wide = { left: -200, top: 100, right: 1200, bottom: 500 };
    const small = { left: 480, top: 290, right: 520, bottom: 310 };
    expect(slideTravel(1000, 600, wide, small)).toEqual({ x: 1201, y: 501 });
    expect(slideTravel(1000, 600, small, wide)).toEqual({ x: 1201, y: 501 });
  });

  it('rounds up', () => {
    const text = { left: 10.2, top: 10.2, right: 20.5, bottom: 20.5 };
    expect(slideTravel(100, 100, text, text)).toEqual({ x: 91, y: 91 });
  });
});

describe('breakableSpaces', () => {
  const n = '\u00a0';

  it('leaves single spaces between words breakable', () => {
    expect(breakableSpaces(['Hello big world'])).toEqual(['Hello big world']);
  });

  it('keeps only the last of several spaces in a row breakable', () => {
    expect(breakableSpaces(['a   b'])).toEqual([`a${n}${n} b`]);
  });

  it('never breaks at spaces that start or end the line', () => {
    expect(breakableSpaces(['  a b  '])).toEqual([`${n}${n}a b${n}${n}`]);
    expect(breakableSpaces(['   '])).toEqual([`${n}${n}${n}`]);
  });

  it('works across runs, with a countdown counting as a word', () => {
    expect(breakableSpaces(['in  ', null, ' left', '  '])).toEqual([`in${n} `, null, ' left', `${n}${n}`]);
    expect(breakableSpaces(['a ', '', ' b'])).toEqual([`a${n}`, '', ' b']);
  });

  it('renders the spaces into the block', () => {
    const block = renderBlock(parseSingle(' **a**  b'), null);
    expect(block.textContent).toBe(`${n}a${n} b`);
  });
});

describe('typewriter', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const visible = (block: HTMLElement) =>
    [...block.querySelectorAll('.bw-ch')]
      .filter((c) => !c.classList.contains('bw-hidden'))
      .map((c) => c.textContent)
      .join('');

  it('types, pauses, deletes and starts again', () => {
    const block = renderBlock(parseSingle('Hi!'), null);
    typewriter(block, 1);
    expect(visible(block)).toBe('');
    vi.advanceTimersByTime(90);
    expect(visible(block)).toBe('H');
    vi.advanceTimersByTime(180);
    expect(visible(block)).toBe('Hi!');
    vi.advanceTimersByTime(90 + 2200);
    expect(visible(block)).toBe('Hi');
    vi.advanceTimersByTime(60);
    expect(visible(block)).toBe('');
    vi.advanceTimersByTime(500 + 90);
    expect(visible(block)).toBe('H');
  });

  it('runs slower at slow speed', () => {
    const block = renderBlock(parseSingle('ab'), null);
    typewriter(block, 2);
    vi.advanceTimersByTime(179);
    expect(visible(block)).toBe('');
    vi.advanceTimersByTime(1);
    expect(visible(block)).toBe('a');
  });

  it('keeps every character in the layout while hidden', () => {
    const block = renderBlock(parseSingle('**ab** c'), null);
    typewriter(block, 1);
    expect(block.textContent).toBe('ab c');
    expect(block.querySelectorAll('.bw-b > .bw-ch')).toHaveLength(2);
  });

  it('types a countdown as one piece', () => {
    const block = renderBlock(parseSingle('T-{countdown}'), '5s');
    typewriter(block, 1);
    vi.advanceTimersByTime(3 * 90);
    expect(visible(block)).toBe('T-5s');
  });

  it('caps the code box at the first and last visible characters', () => {
    const block = renderBlock(parseSingle('`abc`'), null);
    typewriter(block, 1);
    vi.advanceTimersByTime(2 * 90);
    const chars = [...block.querySelectorAll('.bw-ch')];
    expect(chars[0].classList.contains('bw-code-start')).toBe(true);
    expect(chars.map((c) => c.classList.contains('bw-code-end'))).toEqual([false, true, false]);
  });

  it('shows everything again when stopped', () => {
    const block = renderBlock(parseSingle('abc'), null);
    const stop = typewriter(block, 1);
    vi.advanceTimersByTime(90);
    stop();
    expect(visible(block)).toBe('abc');
    expect(block.classList.contains('bw-tw')).toBe(false);
    vi.advanceTimersByTime(10_000);
    expect(visible(block)).toBe('abc');
  });
});
