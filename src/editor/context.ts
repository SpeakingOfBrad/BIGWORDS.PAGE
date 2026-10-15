import { h } from '../chrome';
import type { State } from '../state/fragment';
import type { Settings } from '../state/params';

/** What every section of the editor's form works with. */
export interface EditorContext {
  /** The message and parameters being edited. Replaced when a link is loaded. */
  state: State;
  /** A parameter as written in the URL, or '' when it isn't set. */
  get(key: string): string;
  /** Writes a parameter, or removes it when `value` is blank, and commits. */
  set(key: string, value: string): void;
  /** The settings the display uses for the current state. */
  settings(): Settings;
  /** Updates the preview, the URL and anything listening with onCommit. */
  commit(): void;
  /** Brings every control in line with the state. */
  syncAll(): void;
  /** Runs `fn` on every syncAll, to bring a control in line with the state. */
  onSync(fn: () => void): void;
  /** Runs `fn` on every commit, after the URL is updated. */
  onCommit(fn: () => void): void;
}

export function options(select: HTMLSelectElement, values: readonly string[], labels: Record<string, string> = {}): HTMLSelectElement {
  for (const v of values) select.append(h('option', { value: v }, labels[v] ?? v));
  return select;
}

let idCounter = 0;
export const uid = (p: string) => `${p}-${++idCounter}`;

export const row = (...kids: (Node | string)[]) => h('div', { class: 'row' }, ...kids);
export const label = (text: string, forId: string) => h('label', { class: 'lbl', for: forId }, text);
/** A field label marked optional. Unmarked fields are required. */
export const optLabel = (text: string, forId: string) => h('label', { class: 'lbl', for: forId }, text, h('span', { class: 'opt' }, 'optional'));

/** A section of the form. Collapsible ones open, and show a dot, while `isSet` holds. */
export function group(ctx: EditorContext, title: string, collapsible = false, isSet?: () => boolean): HTMLElement {
  if (!collapsible) return h('section', { class: 'group' }, h('h3', {}, title));
  const summaryLabel = h('span', {}, title);
  const det = h('details', { class: 'group' }, h('summary', {}, summaryLabel));
  if (isSet) {
    ctx.onSync(() => {
      const active = isSet();
      summaryLabel.classList.toggle('dotset', active);
      if (active) det.open = true;
    });
  }
  return det;
}
