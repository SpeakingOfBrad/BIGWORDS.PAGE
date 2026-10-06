import manifest from './font-manifest.json';

interface Face {
  file: string;
  weight: number;
  style: string;
  range: string;
}
interface FontEntry {
  family: string;
  slug: string;
  faces: Face[];
}

const FONTS = manifest as Record<string, FontEntry>;
const SYSTEM_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif';
const FALLBACKS: Record<number, string> = {
  3: 'Georgia, serif',
  4: 'Impact, "Arial Narrow", sans-serif',
  5: 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace',
  6: '"Comic Sans MS", cursive',
};

export const FONT_NAMES = ['System UI', ...Object.values(FONTS).map((f) => f.family)];

/** Each family gets a private name so a locally installed copy never shadows the bundled one. */
const familyName = (id: number) => `bw-${FONTS[id].slug}`;

export function fontStack(id: number): string {
  if (!FONTS[id]) return SYSTEM_STACK;
  return [`"${familyName(id)}"`, FALLBACKS[id], SYSTEM_STACK].filter(Boolean).join(', ');
}

const registered = new Set<number>();
const loading = new Map<string, Promise<void>>();
const settled = new Set<string>();

/** True once ensureFont's promise for these faces has settled, so callers can skip waiting. */
export function fontReady(id: number, { bold = false } = {}): boolean {
  if (!FONTS[id]) return true;
  return settled.has(`${id}:400`) && (!bold || settled.has(`${id}:700`));
}

/**
 * Register a bundled font's @font-face rules on first use. Files come from the
 * app's own origin; the browser fetches only the faces and unicode subsets the
 * text actually uses. Resolves once the regular face, and the bold one when
 * `bold` is set, is ready (or failed). Other faces load when text uses them.
 */
export function ensureFont(id: number, { bold = false } = {}): Promise<void> {
  const entry = FONTS[id];
  if (!entry) return Promise.resolve();
  if (!registered.has(id)) {
    registered.add(id);
    const base = import.meta.env.BASE_URL + 'fonts/';
    const css = entry.faces
      .map(
        (f) =>
          `@font-face{font-family:"${familyName(id)}";src:url("${base}${f.file}") format("woff2");font-weight:${f.weight};font-style:${f.style};font-display:swap;unicode-range:${f.range};}`,
      )
      .join('\n');
    const style = document.createElement('style');
    style.dataset.font = entry.slug;
    style.textContent = css;
    document.head.appendChild(style);
  }
  const load = (weight: number) => {
    const key = `${id}:${weight}`;
    let p = loading.get(key);
    if (!p) {
      p = document.fonts
        ? document.fonts.load(`${weight} 1em "${familyName(id)}"`).then(
            () => undefined,
            () => undefined,
          )
        : Promise.resolve();
      p = p.then(() => void settled.add(key));
      loading.set(key, p);
    }
    return p;
  };
  return bold ? Promise.all([load(400), load(700)]).then(() => undefined) : load(400);
}
