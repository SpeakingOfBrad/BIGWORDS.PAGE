import { el } from './dom';
import { COUNTDOWN_TOKEN, type Slide } from './text';

const NBSP = '\u00a0';

/**
 * The runs' texts with every space a line may not wrap at made non-breaking:
 * the spaces at the start and end of the line, and all but the last of
 * several in a row. Wrapped text then only breaks at single spaces between
 * words, which collapse at the break. Preserved spaces would hang past the
 * end of a wrapped line instead, where some browsers count them as overflow
 * and the fit shrinks the text to keep them in. A countdown (`null`) counts
 * as a word.
 */
export function breakableSpaces(texts: (string | null)[]): (string | null)[] {
  const chars = texts.flatMap((t) => (t === null ? [null] : Array.from(t)));
  for (let i = 0; i < chars.length; ) {
    if (chars[i] !== ' ') {
      i++;
      continue;
    }
    let j = i;
    while (chars[j] === ' ') j++;
    const between = i > 0 && j < chars.length;
    for (let k = i; k < (between ? j - 1 : j); k++) chars[k] = NBSP;
    i = j;
  }
  let at = 0;
  return texts.map((t) => {
    if (t === null) return chars[at++];
    const n = Array.from(t).length;
    const out = chars.slice(at, at + n).join('');
    at += n;
    return out;
  });
}

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
    const texts = breakableSpaces(line.runs.map((r) => (r.countdown ? null : r.text)));
    line.runs.forEach((run, i) => {
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
        span.textContent = texts[i];
      }
      ln.append(span);
    });
    block.append(ln);
  }
  return block;
}
