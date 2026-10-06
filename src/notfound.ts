import { h, siteHeader } from './chrome';

export function mountNotFound(app: HTMLElement): { update(): void; destroy(): void } {
  document.body.className = 'page-site';
  const render = () => {
    // Someone may have mistyped the path of a display link; the message is
    // still in the fragment, so offer it on the right path.
    const hash = location.hash.length > 1 ? location.hash : '';
    app.replaceChildren(
      siteHeader(),
      h(
        'main',
        {},
        h(
          'article',
          { class: 'docs' },
          h('h1', {}, 'Page not found'),
          h('p', {}, 'There’s no page at this address. Displays live on the home page, after the # in the URL.'),
          hash ? h('p', {}, h('a', { class: 'btn btn-primary', href: `/${hash}` }, 'Open this display')) : null,
          h('p', {}, h('a', { href: '/' }, 'Home'), ' · ', h('a', { href: '/editor' }, 'Editor'), ' · ', h('a', { href: '/docs' }, 'Docs')),
        ),
      ),
    );
  };
  render();
  return { update: render, destroy() {} };
}
