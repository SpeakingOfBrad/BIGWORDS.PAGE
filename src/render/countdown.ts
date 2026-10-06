import type { CdFormat } from '../state/params';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Format remaining milliseconds. Leading units are never dropped. */
export function formatCountdown(remainingMs: number, fmt: CdFormat): string {
  const total = Math.max(0, Math.floor(remainingMs / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return fmt === 'colon' ? `${pad2(d)}:${pad2(h)}:${pad2(m)}:${pad2(s)}` : `${d}d ${pad2(h)}h ${pad2(m)}m ${pad2(s)}s`;
}

/** Calls `tick` immediately and then on every whole-second boundary. Returns a stop function. */
export function everySecond(tick: () => void): () => void {
  let timer = 0;
  let stopped = false;
  const loop = () => {
    if (stopped) return;
    tick();
    timer = window.setTimeout(loop, 1000 - (Date.now() % 1000) + 5);
  };
  loop();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
