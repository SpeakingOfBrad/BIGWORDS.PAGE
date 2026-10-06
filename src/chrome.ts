import './styles/site.css';
import { ensureFont } from './render/fonts';
import { parseFragment } from './state/fragment';
import { resolveSettings } from './state/params';
import { Display } from './render/display';

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | boolean | undefined> = {},
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === 'class') e.className = String(v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) e.append(c);
  return e;
}

/** Site header shared by home, docs, editor and the not-found page. Uses Bebas Neue for the wordmark. */
export function siteHeader(current?: 'home' | 'editor' | 'docs', extra?: Node): HTMLElement {
  void ensureFont(4);
  const link = (href: string, label: string, key: string) =>
    h('a', { href, 'aria-current': current === key ? 'page' : undefined }, label);
  return h(
    'header',
    { class: 'site-header' },
    h('a', { class: 'wordmark', href: '/', 'aria-label': 'BIGWORDS.PAGE home' }, 'BIGWORDS', h('span', { class: 'dot', 'aria-hidden': 'true' }), 'PAGE'),
    h('nav', { class: 'site-nav' }, link('/editor', 'Editor', 'editor'), link('/docs', 'Docs', 'docs'), extra ?? null),
  );
}

/** Render a fragment into an element, exactly as the viewer would. */
export function previewDisplay(target: HTMLElement, fragment: string): Display {
  const d = new Display(target);
  d.update(resolveSettings(parseFragment(fragment)));
  return d;
}

let toastTimer = 0;
export function toast(message: string): void {
  let t = document.querySelector<HTMLElement>('.toast');
  if (!t) {
    t = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(t);
  }
  t.textContent = message;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t!.classList.remove('show'), 1800);
}
