import { previewDisplay, siteHeader } from './chrome';
import type { Display } from './render/display';
import { ensureFont } from './render/fonts';
import { examples, HERO, homeMarkup } from './home-markup';
import { parseFragment } from './state/fragment';
import { resolveSettings } from './state/params';

export function mountHome(app: HTMLElement): { destroy(): void } {
  document.body.className = 'page-site';
  const displays = new Map<Element, Display>();

  const page = document.createElement('template');
  page.innerHTML = homeMarkup(location.origin);
  app.replaceChildren(siteHeader('home'), page.content);

  const demo = app.querySelector('.demo-frame')!;
  // Cards are in the same order as examples(): the ones shown, then the ones behind More.
  const all = examples();
  const fragments = [...all.filter((ex) => !ex.more), ...all.filter((ex) => ex.more)].map((ex) => ex.fragment);
  const thumbs = [...app.querySelectorAll('.example .thumb')];

  // Previews run only while on screen, so their timers, refits and fonts cost
  // nothing when scrolled away.
  const previews = new Map<Element, { stage: HTMLElement; fragment: string }>([
    [demo, { stage: demo.firstElementChild as HTMLElement, fragment: HERO }],
    ...thumbs.map((thumb, i) => [thumb, { stage: thumb.firstElementChild as HTMLElement, fragment: fragments[i] }] as const),
  ]);
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const p = previews.get(entry.target);
      if (!p) continue;
      const live = displays.get(entry.target);
      if (entry.isIntersecting && !live) {
        displays.set(entry.target, previewDisplay(p.stage, p.fragment));
      } else if (!entry.isIntersecting && live) {
        live.destroy();
        displays.delete(entry.target);
      }
    }
  });
  for (const frame of previews.keys()) observer.observe(frame);
  // Fetch every preview's font now, so cards further down are ready by the
  // time they scroll into view instead of waiting on the network then.
  for (const { fragment } of previews.values()) void ensureFont(resolveSettings(parseFragment(fragment)).font, { bold: /\*\*|%23/.test(fragment) });

  return {
    destroy() {
      observer.disconnect();
      displays.forEach((d) => d.destroy());
    },
  };
}
