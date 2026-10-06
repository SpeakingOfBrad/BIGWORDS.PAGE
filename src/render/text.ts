/**
 * Message pipeline:
 *   percent-decode (done by the fragment parser)
 *   → resolve `\` escapes into placeholder characters
 *   → split slides on `||`
 *   → render the markdown subset
 *   → mark `{countdown}` tokens
 *   → restore escaped literals
 */

export interface Run {
  text: string;
  bold: boolean;
  italic: boolean;
  strike?: boolean;
  code?: boolean;
  countdown?: boolean;
}

interface Style {
  bold: boolean;
  italic: boolean;
  strike?: boolean;
}

export interface Line {
  level: 0 | 1 | 2; // 0 = body, 1 = H1, 2 = H2
  runs: Run[];
}

export interface Slide {
  lines: Line[];
  hasCountdown: boolean;
}

// Placeholders live in the Unicode Private Use Area so they can never collide with
// syntax. Each escapable character maps to one placeholder.
const ESCAPABLE = ['\\', '|', '{', '}', '*', '#', '~', '`', '_'];
const PUA_BASE = 0xe000;
const TO_PLACEHOLDER = new Map(ESCAPABLE.map((c, i) => [c, String.fromCharCode(PUA_BASE + i)]));
const FROM_PLACEHOLDER = new Map(ESCAPABLE.map((c, i) => [String.fromCharCode(PUA_BASE + i), c]));
const PLACEHOLDER_RE = new RegExp(`[\\u${PUA_BASE.toString(16)}-\\u${(PUA_BASE + ESCAPABLE.length - 1).toString(16)}]`, 'g');

export const COUNTDOWN_TOKEN = '{countdown}';

/**
 * Replace `\x` escapes with placeholders. A backslash before any other
 * character is dropped. Code spans (`...` on one line) are kept verbatim:
 * every syntax character inside becomes a placeholder, so nothing in them is
 * read as markdown, a slide break, `{countdown}` or an escape.
 */
export function resolveEscapes(s: string): string {
  // Strip any stray PUA placeholders from input so they can't masquerade as escapes.
  s = s.replace(PLACEHOLDER_RE, '');
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && i + 1 < s.length) {
      const next = s[i + 1];
      out += TO_PLACEHOLDER.get(next) ?? next;
      i++;
    } else if (c === '`') {
      const end = s.indexOf('`', i + 1);
      const newline = s.indexOf('\n', i + 1);
      if (end > i + 1 && (newline === -1 || end < newline)) {
        const content = Array.from(s.slice(i + 1, end), (ch) => TO_PLACEHOLDER.get(ch) ?? ch).join('');
        out += '`' + content + '`';
        i = end;
      } else {
        out += c;
      }
    } else {
      out += c;
    }
  }
  return out;
}

export function restoreEscapes(s: string): string {
  return s.replace(PLACEHOLDER_RE, (c) => FROM_PLACEHOLDER.get(c) ?? c);
}

function findClosingStar(s: string, from: number): number {
  for (let j = from; j < s.length; j++) {
    if (s.startsWith('**', j)) {
      const close = s.indexOf('**', j + 2);
      if (close > j + 2) {
        j = close + 1;
        continue;
      }
    }
    if (s[j] === '*') return j;
  }
  return -1;
}

const isWordChar = (c: string | undefined) => c !== undefined && /[\p{L}\p{N}]/u.test(c);
const isSpace = (c: string | undefined) => c === undefined || /\s/.test(c);

/**
 * Underscore emphasis follows CommonMark's rule for word boundaries: an
 * underscore inside a word never counts, so names like Home_Guest_5G or
 * snake_case stay literal. Returns the index of the closing run, or -1.
 */
function findClosingUnderscore(s: string, from: number, n: number): number {
  for (let j = from; j < s.length; j++) {
    if (s[j] !== '_') continue;
    let run = 0;
    while (s[j + run] === '_') run++;
    if (run === n && !isSpace(s[j - 1]) && !isWordChar(s[j + n])) return j;
    j += run - 1;
  }
  return -1;
}

function parseInline(s: string, style: Style, out: Run[]): void {
  let buf = '';
  const flush = () => {
    if (buf) out.push({ text: buf, ...style });
    buf = '';
  };
  const wrap = (inner: string, change: Partial<Style>) => {
    flush();
    parseInline(inner, { ...style, ...change }, out);
  };
  // Whether an underscore run closes doesn't depend on where the search
  // starts, so once a search for a run of length n fails from some position,
  // it fails from every later one. Remembering that keeps text full of
  // unclosed underscores linear instead of quadratic.
  const noCloserFrom = new Map<number, number>();
  let k = 0;
  while (k < s.length) {
    // `code`: contents were protected by resolveEscapes and render as typed.
    if (s[k] === '`') {
      const end = s.indexOf('`', k + 1);
      if (end > k + 1) {
        flush();
        out.push({ text: s.slice(k + 1, end), ...style, code: true });
        k = end + 1;
        continue;
      }
    }
    if (s.startsWith('~~', k)) {
      const end = s.indexOf('~~', k + 2);
      if (end > k + 2) {
        wrap(s.slice(k + 2, end), { strike: true });
        k = end + 2;
        continue;
      }
    }
    if (s.startsWith('***', k)) {
      const end = s.indexOf('***', k + 3);
      if (end > k + 3) {
        wrap(s.slice(k + 3, end), { bold: true, italic: true });
        k = end + 3;
        continue;
      }
    }
    if (s.startsWith('**', k)) {
      const end = s.indexOf('**', k + 2);
      if (end > k + 2) {
        wrap(s.slice(k + 2, end), { bold: true });
        k = end + 2;
        continue;
      }
    }
    if (s[k] === '*' && s[k + 1] !== '*') {
      const end = findClosingStar(s, k + 1);
      if (end > k + 1) {
        wrap(s.slice(k + 1, end), { italic: true });
        k = end + 1;
        continue;
      }
    }
    if (s[k] === '_' && !isWordChar(s[k - 1])) {
      let n = 0;
      while (s[k + n] === '_') n++;
      if (n <= 3 && !isSpace(s[k + n])) {
        const from = k + n + 1;
        const failed = noCloserFrom.get(n);
        const end = failed !== undefined && from >= failed ? -1 : findClosingUnderscore(s, from, n);
        if (end === -1 && (failed === undefined || from < failed)) noCloserFrom.set(n, from);
        if (end !== -1) {
          wrap(s.slice(k + n, end), n === 1 ? { italic: true } : n === 2 ? { bold: true } : { bold: true, italic: true });
          k = end + n;
          continue;
        }
      }
      // Not emphasis: keep the whole underscore run literally.
      buf += '_'.repeat(n);
      k += n;
      continue;
    }
    buf += s[k];
    k++;
  }
  flush();
}

/** Split runs on `{countdown}` and restore escaped literals. */
function finalizeRuns(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const run of runs) {
    const pieces = run.text.split(COUNTDOWN_TOKEN);
    pieces.forEach((piece, i) => {
      if (i > 0) out.push({ ...run, text: '', countdown: true });
      if (piece) out.push({ ...run, text: restoreEscapes(piece) });
    });
  }
  return out;
}

/** Render one slide's (escape-resolved) source into lines. */
export function parseSlide(src: string): Slide {
  const lines: Line[] = src.split(/\r\n|\r|\n/).map((raw) => {
    let level: 0 | 1 | 2 = 0;
    let text = raw;
    const m = /^(#{1,2}) +(.*)$/.exec(raw);
    if (m) {
      level = m[1].length as 1 | 2;
      text = m[2];
    }
    const runs: Run[] = [];
    parseInline(text, { bold: false, italic: false }, runs);
    return { level, runs: finalizeRuns(runs) };
  });
  const hasCountdown = lines.some((l) => l.runs.some((r) => r.countdown));
  return { lines, hasCountdown };
}

/** Full pipeline: message → slides. */
export function parseMessage(message: string): Slide[] {
  return resolveEscapes(message).split('||').map(parseSlide);
}

/** Parse text as a single slide (no `||` splitting), e.g. a `zero` replacement message. */
export function parseSingle(message: string): Slide {
  return parseSlide(resolveEscapes(message));
}

/**
 * Split raw (unprocessed) message text into slide sources, honoring escapes,
 * without altering any characters. Used by the editor's slide manager.
 */
export function splitRawSlides(message: string): string[] {
  const out: string[] = [];
  let cur = '';
  for (let i = 0; i < message.length; i++) {
    const c = message[i];
    if (c === '\\' && i + 1 < message.length) {
      cur += c + message[i + 1];
      i++;
    } else if (c === '`' && message.indexOf('`', i + 1) > i + 1 && !message.slice(i + 1, message.indexOf('`', i + 1)).includes('\n')) {
      // A code span keeps its `||` as text, matching the renderer.
      const end = message.indexOf('`', i + 1);
      cur += message.slice(i, end + 1);
      i = end;
    } else if (c === '|' && message[i + 1] === '|') {
      out.push(cur);
      cur = '';
      i++;
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

export function slideToPlainText(slide: Slide, countdown = ''): string {
  return slide.lines.map((l) => l.runs.map((r) => (r.countdown ? countdown : r.text)).join('')).join('\n');
}
