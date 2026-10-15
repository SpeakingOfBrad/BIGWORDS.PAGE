import { describe, expect, it } from 'vitest';
import { autoSize, boxRect, contentInsets, fitMode, marquee, qrMetrics } from '../src/render/fit';

/** Text that fits whenever the font size is at most `limit` px. */
const upTo = (limit: number) => (px: number) => px <= limit;
const opts = { mode: 'both' as const, W: 800, H: 450, minPx: 0, maxPx: Infinity, anim: 'none' as const };

describe('autoSize', () => {
  it('finds a fitting size less than a pixel under the largest, in half pixels', () => {
    for (const limit of [12.3, 40, 123.7, 333]) {
      const px = autoSize(upTo(limit), opts);
      expect(px).toBeLessThanOrEqual(limit);
      expect(px).toBeGreaterThan(limit - 1);
      expect(px * 2).toBe(Math.round(px * 2));
    }
  });

  it('tries no larger than 1.2 times the height, or the width for crawls', () => {
    const tried: number[] = [];
    autoSize((px) => (tried.push(px), true), opts);
    expect(tried).toEqual([540]);
    tried.length = 0;
    autoSize((px) => (tried.push(px), true), { ...opts, mode: 'width' });
    expect(tried).toEqual([800]);
  });

  it('starts from size-max when it is smaller', () => {
    expect(autoSize(() => true, { ...opts, maxPx: 90 })).toBe(90);
  });

  it('holds the size between size-min and size-max', () => {
    expect(autoSize(upTo(10), { ...opts, minPx: 30 })).toBe(30);
    expect(autoSize(upTo(300), { ...opts, maxPx: 120 })).toBe(120);
  });

  it('leaves room for animations that grow or move the text', () => {
    const plain = autoSize(upTo(100), opts);
    expect(autoSize(upTo(100), { ...opts, anim: 'pulse' })).toBeCloseTo(plain * 0.94);
    expect(autoSize(upTo(100), { ...opts, anim: 'shake' })).toBeCloseTo(plain * 0.96);
    expect(autoSize(upTo(100), { ...opts, anim: 'bounce' })).toBeCloseTo(plain * 0.96);
    expect(autoSize(upTo(100), { ...opts, anim: 'flash' })).toBe(plain);
  });

  it('never goes below 1px, even when nothing fits', () => {
    expect(autoSize(() => false, opts)).toBe(1);
  });
});

describe('fitMode', () => {
  it('fits marquees only across their direction of travel', () => {
    expect(fitMode('scroll')).toBe('height');
    expect(fitMode('crawl')).toBe('width');
    expect(fitMode('pulse')).toBe('both');
    expect(fitMode(undefined)).toBe('both');
  });
});

describe('boxRect', () => {
  it('fills the stage without a ratio', () => {
    expect(boxRect(1000, 500, null)).toEqual({ width: 1000, height: 500, left: 0, top: 0 });
  });

  it('centers the largest box of the ratio', () => {
    expect(boxRect(1000, 500, [4, 3])).toEqual({ width: 667, height: 500, left: 167, top: 0 });
    expect(boxRect(500, 1000, [16, 9])).toEqual({ width: 500, height: 281, left: 0, top: 360 });
  });
});

describe('contentInsets', () => {
  it('takes top and bottom from the height, left and right from the width', () => {
    expect(contentInsets([10, 5, 20, 0], 1000, 500)).toEqual([50, 50, 100, 0]);
  });
});

describe('qrMetrics', () => {
  it('sizes the code from the shorter side, at least 48px', () => {
    expect(qrMetrics(1000, 500, 20)).toEqual({ size: 100, margin: 15 });
    expect(qrMetrics(200, 100, 10)).toEqual({ size: 48, margin: 3 });
  });
});

describe('marquee', () => {
  it('runs from one edge of the area to past the other', () => {
    expect(marquee('height', 800, 1600, 1)).toEqual({ from: 800, to: -1600, dur: 18 });
    expect(marquee('width', 450, 450, 1)).toEqual({ from: 450, to: -450, dur: 16 });
  });

  it('scales with speed', () => {
    expect(marquee('height', 800, 800, 2).dur).toBe(24);
    expect(marquee('height', 800, 800, 0.5).dur).toBe(6);
  });
});
