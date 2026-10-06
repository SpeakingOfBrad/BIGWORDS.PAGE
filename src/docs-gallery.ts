import { h } from './chrome';
import { Display } from './render/display';
import { parseFragment } from './state/fragment';
import { resolveSettings, type Settings } from './state/params';

const MARKER = '<!-- anim-gallery -->';

/** Swap the gallery marker in rendered docs HTML for an empty container. */
export function galleryPlaceholder(html: string): string {
  return html.replace(MARKER, '<div class="anim-gallery" role="list" aria-label="Every animation, live"></div>');
}

/**
 * Fill the animation gallery with one live tile per row of the animations
 * table, so the table's example URLs are the single source. Tiles render only
 * while on screen. With reduced motion, tiles stay still until hovered or focused.
 */
export function mountGallery(article: HTMLElement): () => void {
  const gallery = article.querySelector<HTMLElement>('.anim-gallery');
  const heading = article.querySelector('#animations');
  if (!gallery || !heading) return () => {};

  let table: Element | null = heading.nextElementSibling;
  while (table && !table.classList.contains('table-wrap')) table = table.nextElementSibling;
  const rows = [...(table?.querySelectorAll('tbody tr') ?? [])]
    .map((tr) => {
      const link = tr.querySelector('a');
      const url = link ? new URL(link.getAttribute('href') ?? '', location.href) : null;
      return { name: tr.querySelector('td code')?.textContent ?? '', url };
    })
    .filter((r): r is { name: string; url: URL } => !!r.name && !!r.url && r.url.origin === location.origin && r.url.pathname === '/' && r.url.hash.length > 1)
    .map(({ name, url }) => ({ name, href: url.pathname + url.hash }));

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const tiles = rows.map(({ name, href }) => {
    const settings: Settings = resolveSettings(parseFragment(href.slice(1)));
    // Never show fast flashing in the gallery.
    if (settings.anim === 'flash' && settings.speed === 'fast') settings.speed = 'normal';
    const stage = h('div');
    const tile = h(
      'a',
      { class: 'anim-tile', href, role: 'listitem', 'aria-label': `${name} animation, open fullscreen` },
      h('div', { class: 'thumb' }, stage),
      h('div', { class: 'meta' }, h('code', {}, name), h('span', { class: 'play-hint' }, 'Hover to play')),
    );
    gallery.append(tile);
    return { tile, stage, settings, display: null as Display | null, playing: false };
  });

  type Tile = (typeof tiles)[number];
  const render = (t: Tile) => {
    const still = reduce.matches && !t.playing;
    t.display?.update(still ? { ...t.settings, anim: 'none' } : t.settings);
    t.tile.classList.toggle('still', still);
  };

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const t = tiles.find((x) => x.tile === entry.target);
      if (!t) continue;
      if (entry.isIntersecting && !t.display) {
        t.display = new Display(t.stage);
        render(t);
      } else if (!entry.isIntersecting && t.display) {
        t.display.destroy();
        t.display = null;
      }
    }
  });

  for (const t of tiles) {
    observer.observe(t.tile);
    const play = (on: boolean) => () => {
      t.playing = on;
      render(t);
    };
    t.tile.addEventListener('pointerenter', play(true));
    t.tile.addEventListener('pointerleave', play(false));
    t.tile.addEventListener('focus', play(true));
    t.tile.addEventListener('blur', play(false));
  }
  const onReduce = () => tiles.forEach(render);
  reduce.addEventListener('change', onReduce);

  return () => {
    observer.disconnect();
    reduce.removeEventListener('change', onReduce);
    tiles.forEach((t) => t.display?.destroy());
  };
}
