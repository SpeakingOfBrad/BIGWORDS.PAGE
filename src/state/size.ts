export type SizeUnit = 'px' | 'vh' | 'vw';
export interface SizeValue {
  value: number;
  unit: SizeUnit;
}

const SIZE_RE = /^(\d+(?:\.\d+)?|\.\d+)(px|vh|vw)?$/i;

export function parseSize(s: string): SizeValue | null {
  const m = SIZE_RE.exec(s.trim());
  if (!m) return null;
  const value = parseFloat(m[1]);
  if (!(value > 0) || !Number.isFinite(value)) return null;
  return { value, unit: (m[2]?.toLowerCase() as SizeUnit) ?? 'px' };
}

/** Normalize to pixels using the current viewport dimensions. */
export function sizeToPx(size: SizeValue, viewportW: number, viewportH: number): number {
  switch (size.unit) {
    case 'vh':
      return (size.value / 100) * viewportH;
    case 'vw':
      return (size.value / 100) * viewportW;
    default:
      return size.value;
  }
}

export function formatSize(size: SizeValue): string {
  const n = String(Math.round(size.value * 100) / 100);
  return size.unit === 'px' ? n : n + size.unit;
}
