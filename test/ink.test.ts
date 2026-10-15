import { describe, expect, it } from 'vitest';
import { linesOverhang, MEASURE_PX, type Ink, type InkLine } from '../src/render/ink';

const line = (text: string, scale = 1, font = 'f'): InkLine => ({ scale, chars: Array.from(text, (c) => ({ c, font })) });
/** Ink inside its boxes, with a font whose ascent and descent fill a 1.15 line. */
const inside: Ink = { width: 0, left: 0, right: 0, ascent: 70, descent: 25, fontAscent: 80, fontDescent: 35 };
const pad = (em: number) => em * 1.05 + 0.02;

describe('linesOverhang', () => {
  it('is zero when no ink leaves its boxes', () => {
    expect(linesOverhang([line('Hello world')], () => inside)).toEqual([0, 0, 0, 0]);
  });

  it('measures runs of non-space characters in one font', () => {
    const runs: string[] = [];
    linesOverhang([{ scale: 1, chars: [...line('ab cd').chars, ...line('ef', 1, 'g').chars] }], (text) => (runs.push(text), inside));
    expect(runs).toEqual(['ab', 'cd', 'ef']);
  });

  it('measures only the runs at the edges of middle lines', () => {
    const runs: string[] = [];
    linesOverhang([line('top'), line('a b c'), line('end')], (text) => (runs.push(text), inside));
    expect(runs).toEqual(['top', 'a', 'c', 'end']);
  });

  it('takes the left overhang from first runs and the right from last runs', () => {
    const ink = (text: string): Ink => ({ ...inside, left: text === 'Wavy' ? 10 : 0, right: text === 'f' ? 20 : 3 });
    const [, right, , left] = linesOverhang([line('Wavy f')], ink);
    expect(left).toBeCloseTo(pad(10 / MEASURE_PX));
    expect(right).toBeCloseTo(pad(20 / MEASURE_PX));
  });

  it('takes the top from the first line and the bottom from the last, past the half-leading', () => {
    // A 1.15 line at 100px leaves 0 leading for 80 + 35, so ink 10px above
    // the font's ascent and 5px below its descent spills by that much.
    const tall: Ink = { ...inside, ascent: 90, descent: 40 };
    const [top, , bottom] = linesOverhang([line('A'), line('B')], () => tall);
    expect(top).toBeCloseTo(pad(0.1));
    expect(bottom).toBeCloseTo(pad(0.05));
  });

  it('scales headings, measured at their own size', () => {
    const ink = { ...inside, left: 10 };
    const [, , , body] = linesOverhang([line('x')], () => ink);
    const [, , , h1] = linesOverhang([line('x', 2)], () => ink);
    expect(h1 - 0.02).toBeCloseTo((body - 0.02) * 2);
  });
});
