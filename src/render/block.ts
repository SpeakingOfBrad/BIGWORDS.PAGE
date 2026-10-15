import { el } from './dom';
import { COUNTDOWN_TOKEN, type Slide } from './text';

/**
 * A slide's text as a block of lines, one span per run. Countdown runs show
 * `countdownText` and are marked to be updated each second, or show the
 * token as written when the display has no countdown (`null`).
 */
export function renderBlock(slide: Slide, countdownText: string | null): HTMLElement {
  const block = el('div', 'bw-block');
  for (const line of slide.lines) {
    const ln = el('div', line.level ? `bw-line bw-h${line.level}` : 'bw-line');
    if (line.runs.length === 0) ln.append(document.createElement('br'));
    for (const run of line.runs) {
      const span = el('span');
      if (run.bold) span.classList.add('bw-b');
      if (run.italic) span.classList.add('bw-i');
      if (run.strike) span.classList.add('bw-s');
      if (run.code) span.classList.add('bw-code');
      if (run.countdown) {
        if (countdownText !== null) {
          span.classList.add('bw-cd');
          span.textContent = countdownText;
        } else {
          span.textContent = COUNTDOWN_TOKEN;
        }
      } else {
        span.textContent = run.text;
      }
      ln.append(span);
    }
    block.append(ln);
  }
  return block;
}
