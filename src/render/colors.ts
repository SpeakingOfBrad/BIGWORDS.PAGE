export function prefersLight(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches;
}

/** Relative luminance (WCAG) of a hex color without '#'. */
export function luminance(hex: string): number {
  const n = parseInt(hex, 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** The display's colors: the ones set, or black and white following the system's scheme. */
export function displayColors(bg: string | null, fg: string | null, light: boolean): { bg: string; fg: string } {
  return {
    bg: '#' + (bg ?? (light ? 'ffffff' : '000000')),
    fg: '#' + (fg ?? (light ? '000000' : 'ffffff')),
  };
}

/** Rainbow text's lightness, so it keeps contrast against the background (`#rrggbb`). */
export function rainbowLightness(bg: string): string {
  return luminance(bg.slice(1)) > 0.4 ? '38%' : '62%';
}
