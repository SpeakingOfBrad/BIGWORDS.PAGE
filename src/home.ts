import { h, previewDisplay, siteHeader } from './chrome';
import type { Display } from './render/display';
import { ensureFont } from './render/fonts';
import { parseFragment } from './state/fragment';
import { resolveSettings } from './state/params';

const nextNewYear = () => `${new Date().getFullYear() + 1}-01-01T00:00:00`;

const HERO = 'Say%20it%20**big.**||Any%20screen.%0AAny%20size.||No%20app.%20No%20login.%0AJust%20a%20**URL.**&bg=111111&fg=ffd60a&font=4&interval=3';

interface Example {
  title: string;
  fragment: string;
}

const examples = (): Example[] => [
  { title: 'Plain text', fragment: 'Hello%20World' },
  { title: 'Colors, font, newline', fragment: '%23%20Gate%2012%0ABoarding%20now&bg=0b3d91&fg=ffffff&font=2' },
  { title: 'Countdown', fragment: `Happy%20New%20Year%20in%0A{countdown}&until=${nextNewYear()}&font=5&cdfmt=colon&zero=Happy%20New%20Year!` },
  { title: 'Pulse animation', fragment: 'ON%20AIR&bg=b00020&fg=ffffff&font=4&anim=pulse' },
  { title: 'Slides', fragment: 'Welcome!||Wi-Fi:%20**guest**%0APassword:%20*sunshine*&font=1&interval=4' },
  { title: 'Scrolling marquee', fragment: 'Breaking%20news:%20this%20text%20scrolls%20forever&anim=scroll&size-max=40vh&font=1&bg=000000&fg=00ff66' },
  { title: 'Rainbow', fragment: 'Happy%20Birthday!&anim=rainbow&font=6' },
  { title: 'QR code', fragment: `Scan%20to%20open%0Athe%20editor&qr=${location.origin}/editor&qrpos=below&font=1&bg=ffffff&fg=111111` },
];

function url(fragment: string): string {
  return `${location.origin}/#${fragment}`;
}

export function mountHome(app: HTMLElement): { destroy(): void } {
  document.body.className = 'page-site';
  const displays = new Map<Element, Display>();

  const demo = h('div', { class: 'demo-frame' });
  const demoStage = h('div');
  demo.append(demoStage);

  const steps = [
    ['Type a message after the #. Spaces are %20.', 'Hello%20World'],
    ['Add settings with &key=value.', 'Hello%20World&bg=000000&fg=ffd60a&font=4'],
    ['%0A starts a new line. # makes a heading (write it as %23).', '%23%20Room%20204%0AMeeting%20in%20progress'],
    ['|| splits the message into slides.', 'Coffee%20%E2%98%95||Tea%20%F0%9F%8D%B5||Water%20%F0%9F%92%A7&interval=2'],
  ];

  const exampleCards = examples().map((ex) => {
    const thumb = h('div', { class: 'thumb' });
    const stage = h('div');
    thumb.append(stage);
    const card = h(
      'div',
      { class: 'example' },
      h('a', { href: `/#${ex.fragment}`, style: 'text-decoration:none', 'aria-label': `Open example: ${ex.title}` }, thumb, h('div', { class: 'meta' }, h('strong', {}, ex.title), h('code', {}, url(ex.fragment)))),
      h('div', { class: 'example-actions' }, h('a', { class: 'btn btn-sm', href: `/#${ex.fragment}` }, 'Open'), h('a', { class: 'btn btn-sm', href: `/editor#${ex.fragment}` }, 'Edit')),
    );
    return { card, stage, fragment: ex.fragment };
  });

  const features: [string, string][] = [
    ['Auto-fit', 'Text grows to fill any screen, from a phone to a stadium board.'],
    ['Markdown', '**bold**, *italic*, # and ## headings, real line breaks.'],
    ['Slides', 'Split with || and they rotate on a timer.'],
    ['Countdowns', 'Put {countdown} anywhere and set &until=.'],
    ['QR codes & images', 'Generated in your browser. No third-party services.'],
    ['Private by design', 'The message lives in the URL fragment, which browsers never send to a server.'],
  ];

  app.replaceChildren(
    siteHeader('home'),
    h(
      'main',
      { class: 'home' },
      h(
        'section',
        { class: 'hero' },
        h(
          'div',
          {},
          h('h1', {}, 'Big words for any screen'),
          h('p', { class: 'lede' }, 'Put a message in a URL and it fills the screen. No account, no app, no server storing anything. The link is the whole display, so you can share it, bookmark it, or type it by hand.'),
          h('div', { class: 'hero-actions' }, h('a', { class: 'btn btn-primary', href: '/editor' }, 'Open the editor'), h('a', { class: 'btn', href: '/docs' }, 'Read the docs'), h('a', { class: 'btn', href: `/#${HERO}` }, 'View fullscreen')),
        ),
        h('div', { class: 'demo' }, demo, h('div', { class: 'demo-url' }, h('a', { href: `/#${HERO}` }, url(HERO)))),
      ),
      h(
        'section',
        { class: 'section' },
        h('h2', {}, 'Make one by hand'),
        h('p', {}, 'Use the editor if you like, but you never need it. Every display is just a URL.'),
        h(
          'ol',
          { class: 'steps' },
          ...steps.map(([text, frag]) => h('li', {}, h('div', {}, h('p', {}, text), h('a', { class: 'url', href: `/#${frag}` }, url(frag))))),
        ),
      ),
      h('section', { class: 'section' }, h('h2', {}, 'Examples'), h('p', {}, 'Every card is a working link. Open it fullscreen, or load it into the editor and change it.'), h('div', { class: 'examples' }, ...exampleCards.map((c) => c.card))),
      h('section', { class: 'section' }, h('h2', {}, 'What it does'), h('div', { class: 'features' }, ...features.map(([t, d]) => h('div', { class: 'feature' }, h('strong', {}, t), h('span', {}, d))))),
    ),
    h(
      'footer',
      { class: 'site-footer' },
      h('p', {}, 'BIGWORDS.PAGE is open source under the MIT license. Fonts are bundled under their own open licenses.'),
      h('p', {}, h('a', { href: '/docs' }, 'Docs'), ' · ', h('a', { href: '/editor' }, 'Editor')),
    ),
  );

  // Previews run only while on screen, so their timers, refits and fonts cost
  // nothing when scrolled away.
  const previews = new Map<Element, { stage: HTMLElement; fragment: string }>([
    [demo, { stage: demoStage, fragment: HERO }],
    ...exampleCards.map((c) => [c.stage.parentElement!, { stage: c.stage, fragment: c.fragment }] as const),
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
