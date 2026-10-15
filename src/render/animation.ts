import type { Speed } from '../state/params';
import { el } from './dom';

/** Animation durations scale by speed; slow takes twice as long. */
export const SPEED_FACTOR: Record<Speed, number> = { slow: 2, normal: 1, fast: 0.5 };
/** Seconds per cycle at normal speed, for the animations done in CSS. */
export const BASE_DURATION: Record<string, number> = {
  pulse: 2,
  flash: 1,
  shake: 0.4,
  bounce: 1,
  fadein: 1.5,
  rainbow: 6,
};

/**
 * Typewriter: reveal characters one by one, pause, delete letter by letter
 * quickly, then restart. Characters are hidden (not removed) so the layout and
 * the fitted size stay stable.
 */
export function typewriter(block: HTMLElement, factor: number): () => void {
  // Split text spans into per-character spans once.
  if (!block.dataset.tw) {
    block.dataset.tw = '1';
    block.querySelectorAll<HTMLElement>('.bw-line > span').forEach((span) => {
      if (span.classList.contains('bw-cd')) {
        span.classList.add('bw-ch');
        return;
      }
      const text = span.textContent ?? '';
      span.textContent = '';
      for (const ch of Array.from(text)) {
        const c = el('span', 'bw-ch');
        c.textContent = ch;
        span.append(c);
      }
    });
  }
  const chars = Array.from(block.querySelectorAll<HTMLElement>('.bw-ch'));
  const TYPE = 90 * factor;
  const DELETE = 30 * factor;
  const PAUSE = 2200 * factor;
  const GAP = 500 * factor;
  let timer = 0;
  let shown = 0;
  let phase: 'type' | 'pause' | 'delete' | 'gap' = 'type';
  chars.forEach((c) => c.classList.add('bw-hidden'));
  // Safari repaints only around the character that changed, so glyph ink that
  // reaches past that area (Caveat's "!" and "f") was left cut off. Flipping a
  // practically invisible background on the whole block makes every step
  // repaint all of it, including the ring around it that covers overhangs.
  block.classList.add('bw-tw');
  let flip = false;
  const repaint = () => {
    flip = !flip;
    block.classList.toggle('bw-tw-flip', flip);
  };
  // Code spans: the box is drawn per character while typing, with rounded
  // caps on the first character and on the last visible one, so it grows and
  // shrinks with the text instead of showing empty.
  const codeOf = chars.map((c) => c.closest<HTMLElement>('.bw-code'));
  const updateCodeEnd = (i: number) => {
    const code = codeOf[i];
    if (!code) return;
    code.querySelector('.bw-code-end')?.classList.remove('bw-code-end');
    let last = -1;
    for (let j = 0; j < shown; j++) if (codeOf[j] === code) last = j;
    if (last !== -1) chars[last].classList.add('bw-code-end');
  };
  for (const code of new Set(codeOf)) {
    code?.querySelector('.bw-ch')?.classList.add('bw-code-start');
  }
  const step = () => {
    switch (phase) {
      case 'type':
        if (shown < chars.length) {
          chars[shown++].classList.remove('bw-hidden');
          updateCodeEnd(shown - 1);
          repaint();
          timer = window.setTimeout(step, TYPE);
        } else {
          phase = 'pause';
          timer = window.setTimeout(step, PAUSE);
        }
        return;
      case 'pause':
        phase = 'delete';
        step();
        return;
      case 'delete':
        if (shown > 0) {
          chars[--shown].classList.add('bw-hidden');
          updateCodeEnd(shown);
          repaint();
          timer = window.setTimeout(step, DELETE);
        } else {
          phase = 'gap';
          timer = window.setTimeout(step, GAP);
        }
        return;
      case 'gap':
        phase = 'type';
        step();
    }
  };
  timer = window.setTimeout(step, TYPE);
  return () => {
    clearTimeout(timer);
    chars.forEach((c) => c.classList.remove('bw-hidden', 'bw-code-start', 'bw-code-end'));
    block.classList.remove('bw-tw', 'bw-tw-flip');
  };
}
