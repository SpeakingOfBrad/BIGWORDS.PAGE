/** Font size, in px, that text is measured at. */
export const MEASURE_PX = 100;
const isSpace = (c: string | undefined) => c === undefined || /\s/.test(c);

/** Where a run of text puts ink, in px at MEASURE_PX. */
export interface Ink {
  width: number; // advance width
  left: number; // ink past the start of the advance box
  right: number; // ink past the end of the advance box
  ascent: number; // ink above the baseline
  descent: number; // ink below the baseline
  fontAscent?: number;
  fontDescent?: number;
}

let measureCtx: CanvasRenderingContext2D | null = null;
const inkCache = new Map<string, Ink>();
// Cached results depend on which fonts were loaded when measured.
if (typeof document !== 'undefined' && document.fonts) {
  document.fonts.addEventListener('loadingdone', () => inkCache.clear());
}

/**
 * Where a run of text really puts ink, found by drawing it and scanning the
 * pixels. Canvas text metrics (actualBoundingBox*) are not trustworthy for
 * this: Safari reports Caveat's overhangs short of what it draws.
 */
function measureInk(ctx: CanvasRenderingContext2D, text: string, font: string, ready: boolean): Ink {
  // Whether the web font is ready is part of the key, so a measurement taken
  // with a fallback font is never reused once the real one loads.
  const key = `${ready}\n${font}\n${text}`;
  const hit = inkCache.get(key);
  if (hit) return hit;
  ctx.font = font;
  const m = ctx.measureText(text);
  const M = MEASURE_PX;
  const w = Math.ceil(m.width + 2 * M);
  const h = 3 * M;
  const cv = ctx.canvas;
  if (cv.width < w) cv.width = w;
  if (cv.height < h) cv.height = h;
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.font = font; // resizing the canvas resets its state
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#000';
  ctx.fillText(text, M, 2 * M);
  const data = ctx.getImageData(0, 0, w, h).data;
  let minX = w;
  let maxX = -1;
  let minY = h;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const ink: Ink =
    maxX < 0
      ? { width: m.width, left: 0, right: 0, ascent: 0, descent: 0 }
      : { width: m.width, left: M - minX, right: maxX + 1 - (M + m.width), ascent: 2 * M - minY, descent: maxY + 1 - 2 * M };
  ink.fontAscent = m.fontBoundingBoxAscent;
  ink.fontDescent = m.fontBoundingBoxDescent;
  inkCache.set(key, ink);
  return ink;
}

/** A line of text as characters with the CSS font each is drawn in, and its size relative to the block's. */
export interface InkLine {
  scale: number;
  chars: { c: string; font: string }[];
}

/**
 * The overhang of a block's lines, in em of its base size: [top, right,
 * bottom, left], with a small margin for antialiasing and rendering
 * differences between the canvas and the page. `measure` gives the ink of a
 * run of characters in one font. Only runs that reach an edge are measured:
 * the first and last of each line, and every run of the first and last lines.
 */
export function linesOverhang(lines: InkLine[], measure: (text: string, font: string) => Ink): [number, number, number, number] {
  let top = 0;
  let right = 0;
  let bottom = 0;
  let left = 0;
  lines.forEach(({ scale, chars }, li) => {
    const lineHeight = scale > 1 ? 1.1 : 1.15;
    const em = scale / MEASURE_PX;
    const firstLine = li === 0;
    const lastLine = li === lines.length - 1;
    // Measure runs of same-style, non-space characters rather than single
    // characters: script fonts like Caveat pick contextual glyph variants, so a
    // letter's ink depends on its neighbours.
    let i = 0;
    while (i < chars.length) {
      if (isSpace(chars[i].c)) {
        i++;
        continue;
      }
      let j = i;
      let text = '';
      while (j < chars.length && !isSpace(chars[j].c) && chars[j].font === chars[i].font) text += chars[j++].c;
      // Lines never wrap, so only a line's first and last runs reach its edges.
      const atStart = i === 0;
      const atEnd = j === chars.length;
      if (atStart || atEnd || firstLine || lastLine) {
        const ink = measure(text, chars[i].font);
        if (atStart) left = Math.max(left, ink.left * em);
        if (atEnd) right = Math.max(right, ink.right * em);
        if ((firstLine || lastLine) && ink.fontAscent !== undefined && ink.fontDescent !== undefined) {
          const halfLeading = (lineHeight * MEASURE_PX - (ink.fontAscent + ink.fontDescent)) / 2;
          if (firstLine) top = Math.max(top, (ink.ascent - ink.fontAscent - halfLeading) * em);
          if (lastLine) bottom = Math.max(bottom, (ink.descent - ink.fontDescent - halfLeading) * em);
        }
      }
      i = j;
    }
  });
  const pad = (n: number) => (n > 0 ? n * 1.05 + 0.02 : 0);
  return [pad(top), pad(right), pad(bottom), pad(left)];
}

/**
 * How far the block's glyph ink extends past its layout boxes, in em of the
 * block's base size: [top, right, bottom, left]. Some fonts draw outside the
 * space they reserve for a character (Caveat's slanted strokes and swashes,
 * italic faces), and since text is fitted against layout boxes, that ink was
 * clipped at the edges of the text area. Padding the block by these amounts
 * makes the fit leave room for it, and centers the ink rather than the boxes.
 */
export function inkOverhang(block: HTMLElement): [number, number, number, number] {
  measureCtx ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const ctx = measureCtx;
  if (!ctx) return [0, 0, 0, 0];
  // document.fonts.check is slow, so ask once per font per call.
  const readyByFont = new Map<string, boolean>();
  const fontReady = (font: string) => {
    let r = readyByFont.get(font);
    if (r === undefined) {
      r = document.fonts ? document.fonts.check(font) : true;
      readyByFont.set(font, r);
    }
    return r;
  };
  const lines = [...block.querySelectorAll<HTMLElement>(':scope > .bw-line')].map((line): InkLine => {
    const scale = line.classList.contains('bw-h1') ? 2 : line.classList.contains('bw-h2') ? 1.5 : 1;
    // Each character with the style it's drawn in.
    const chars: InkLine['chars'] = [];
    for (const span of line.querySelectorAll<HTMLElement>(':scope > span')) {
      const cs = getComputedStyle(span);
      const font = `${cs.fontStyle} ${cs.fontWeight} ${MEASURE_PX}px ${cs.fontFamily}`;
      for (const c of Array.from(span.textContent ?? '')) chars.push({ c, font });
    }
    return { scale, chars };
  });
  return linesOverhang(lines, (text, font) => measureInk(ctx, text, font, fontReady(font)));
}
