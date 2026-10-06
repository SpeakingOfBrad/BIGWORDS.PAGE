import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Marked } from 'marked';
import type { Plugin } from 'vite';
import { NOT_FOUND, PAGES, SITE_NAME, type PageMeta } from './src/pages.ts';

const VIRTUAL_ID = 'virtual:docs';
const RESOLVED_ID = '\0' + VIRTUAL_ID;
const DOCS_PATH = resolve(import.meta.dirname, 'docs/REFERENCE.md');

/**
 * Optional Markdown appended to the reference, for notes about one particular
 * instance (who runs it, how to reach them). Relative to the working directory.
 */
function operatorDocsPath(): string | undefined {
  const path = process.env.OPERATOR_DOCS;
  return path ? resolve(path) : undefined;
}

// Box-drawing characters come from whatever fallback font has them, at that
// font's width, so diagrams drawn with them don't line up with the text.
// Each run (└───, ───┘ or ───) becomes one span, exactly as many characters
// wide, that CSS draws with borders; browsers snap borders to whole pixels,
// so the lines stay crisp at any zoom. The characters stay inside
// (transparent) so copying still works.
const BOX_RUNS: [RegExp, string][] = [
  [/^└─*$/, 'l'],
  [/^─*┘$/, 'r'],
  [/^─+$/, 'h'],
];

function drawBoxChars(html: string): string {
  return html.replace(/<pre>[\s\S]*?<\/pre>/g, (pre) =>
    pre.replace(/└─*|─*┘|─+/g, (run) => {
      const kind = BOX_RUNS.find(([re]) => re.test(run))![1];
      return `<span class="bx bx-${kind}" style="--n:${[...run].length}">${run}</span>`;
    }),
  );
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Renders docs/REFERENCE.md to HTML. Example URLs keep their {origin} placeholder. */
function renderDocs(): string {
  const extra = operatorDocsPath();
  const md = readFileSync(DOCS_PATH, 'utf8') + (extra ? '\n' + readFileSync(extra, 'utf8') : '');
  const marked = new Marked({
    renderer: {
      heading({ tokens, depth }) {
        const html = this.parser.parseInline(tokens);
        const id = slugify(html);
        return `<h${depth} id="${id}"><a class="anchor" href="#${id}" aria-hidden="true">#</a>${html}</h${depth}>\n`;
      },
    },
  });
  return drawBoxChars(marked.parse(md, { async: false }) as string)
    .replace(/<table>/g, '<div class="table-wrap"><table>')
    .replace(/<\/table>/g, '</table></div>');
}

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * The public origin (SITE_URL), used for canonical URLs, social cards, the
 * sitemap and example URLs in the prerendered docs. Empty when unset: the
 * build then leaves out everything that needs an absolute URL.
 */
function siteUrl(): string {
  const url = process.env.SITE_URL;
  return url ? new URL(url).origin : '';
}

/** NOINDEX=1 keeps a build out of search engines, e.g. for staging or a private instance. */
function isNoindex(): boolean {
  return /^(1|true|yes)$/i.test(process.env.NOINDEX ?? '');
}

/**
 * Title, description, canonical, Open Graph and Twitter tags for one page.
 * Canonical and og:url/og:image need an absolute URL, so they're only written
 * when SITE_URL is set.
 */
function headTags(page: PageMeta, site: string, noindex: boolean): string {
  const url = site + page.path;
  const meta = (attr: 'name' | 'property', key: string, value: string) => `<meta ${attr}="${key}" content="${escapeAttr(value)}" />`;
  const tags = [
    `<title>${escapeAttr(page.title)}</title>`,
    meta('name', 'description', page.description),
    noindex ? meta('name', 'robots', 'noindex') : '',
    meta('property', 'og:type', 'website'),
    meta('property', 'og:site_name', SITE_NAME),
    meta('property', 'og:title', page.title),
    meta('property', 'og:description', page.description),
  ];
  if (site) {
    tags.push(
      `<link rel="canonical" href="${escapeAttr(url)}" />`,
      meta('property', 'og:url', url),
      meta('property', 'og:image', `${site}/og.png`),
      meta('property', 'og:image:width', '1200'),
      meta('property', 'og:image:height', '630'),
      meta('property', 'og:image:alt', 'BIGWORDS.PAGE: big words for any screen'),
      meta('name', 'twitter:card', 'summary_large_image'),
    );
    if (page === PAGES.home) tags.push(jsonLd(site));
  } else {
    tags.push(meta('name', 'twitter:card', 'summary'));
  }
  return tags.filter(Boolean).join('\n    ');
}

/** Structured data for the home page. A data block, so the CSP doesn't apply. */
function jsonLd(site: string): string {
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': `${site}/#website`, name: SITE_NAME, url: `${site}/` },
      {
        '@type': 'WebApplication',
        name: SITE_NAME,
        url: `${site}/`,
        description: PAGES.home.description,
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Any',
        browserRequirements: 'Requires JavaScript',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        license: 'https://opensource.org/licenses/MIT',
      },
    ],
  };
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

/** Fallback for visitors and crawlers without JavaScript. */
function noscript(page: PageMeta): string {
  if (page === PAGES.docs) return '';
  const intro =
    page === PAGES.editor
      ? 'The editor needs JavaScript.'
      : `${SITE_NAME} shows any message as big as the screen allows, and the URL is the whole display. It needs JavaScript.`;
  return `<noscript><p>${intro} Read the <a href="/docs">docs</a> to learn how the URLs work, or open the <a href="/editor">editor</a>.</p></noscript>`;
}

/** Static copy of what siteHeader() in src/chrome.ts renders. */
function staticHeader(current?: 'editor' | 'docs'): string {
  const link = (href: string, label: string, key: string) => `<a href="${href}"${current === key ? ' aria-current="page"' : ''}>${label}</a>`;
  return (
    '<header class="site-header"><a class="wordmark" href="/" aria-label="BIGWORDS.PAGE home">BIGWORDS<span class="dot" aria-hidden="true"></span>PAGE</a>' +
    `<nav class="site-nav">${link('/editor', 'Editor', 'editor')}${link('/docs', 'Docs', 'docs')}</nav></header>`
  );
}

function fillPage(template: string, page: PageMeta, site: string, noindex: boolean): string {
  return template
    .replace('<!-- seo:head -->', () => headTags(page, site, noindex))
    .replace('<!-- seo:noscript -->', () => noscript(page));
}

/**
 * A site page (header + main) prerendered into #app, with the site styles
 * linked up front so it's styled before, or without, JavaScript. The client
 * renders the same markup over it.
 */
function prerender(html: string, cssLinks: string, body: string): string {
  return html
    .replace('</head>', `  ${cssLinks}\n  </head>`)
    .replace('<body>', '<body class="page-site">')
    .replace('<div id="app"></div>', () => `<div id="app">${body}</div>`);
}

/** Static copy of what mountNotFound() in src/notfound.ts renders, minus the fragment link. */
function notFoundPage(template: string, cssLinks: string): string {
  const head = [
    `<title>${escapeAttr(NOT_FOUND.title)}</title>`,
    `<meta name="description" content="${escapeAttr(NOT_FOUND.description)}" />`,
    '<meta name="robots" content="noindex" />',
  ].join('\n    ');
  const body =
    '<h1>Page not found</h1><p>There’s no page at this address. Displays live on the home page, after the # in the URL.</p>' +
    '<p><a href="/">Home</a> · <a href="/editor">Editor</a> · <a href="/docs">Docs</a></p>';
  return prerender(
    template.replace('<!-- seo:head -->', () => head).replace('<!-- seo:noscript -->', ''),
    cssLinks,
    `${staticHeader()}<main><article class="docs">${body}</article></main>`,
  );
}

/**
 * Renders docs/REFERENCE.md (plus OPERATOR_DOCS, if set) to HTML at build
 * time and exposes it as `virtual:docs`, so the /docs route and the README
 * share one source.
 *
 * At build time it also writes one HTML file per page (index.html,
 * editor.html, docs.html) with that page's metadata, prerenders the docs into
 * docs.html so they're readable without JavaScript, and writes 404.html,
 * robots.txt and, when SITE_URL is set, sitemap.xml.
 */
export default function docsPlugin(): Plugin[] {
  let command: 'build' | 'serve' = 'serve';
  return [
    {
      name: 'bigwords-docs',
      configResolved(config) {
        command = config.command;
      },
      resolveId(id) {
        return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
      },
      load(id) {
        if (id !== RESOLVED_ID) return undefined;
        this.addWatchFile(DOCS_PATH);
        const extra = operatorDocsPath();
        if (extra) this.addWatchFile(extra);
        return `export default ${JSON.stringify(renderDocs())};`;
      },
      // Serve unknown paths the way production does (404.html with status
      // 404), so `npm run preview` and the smoke test see real 404s.
      configurePreviewServer(server) {
        const out = resolve(server.config.root, server.config.build.outDir);
        const isFile = (p: string) => existsSync(p) && statSync(p).isFile();
        server.middlewares.use((req, res, next) => {
          if (req.method !== 'GET' && req.method !== 'HEAD') return next();
          let path: string;
          try {
            path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
          } catch {
            return next();
          }
          const base = path.replace(/\/+$/, '');
          if (base === '' || isFile(join(out, path)) || isFile(join(out, `${base}.html`))) return next();
          res.statusCode = 404;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(readFileSync(join(out, '404.html')));
        });
      },
      transformIndexHtml(html) {
        // The build fills the SEO markers per page in writeBundle.
        return command === 'serve' ? fillPage(html, PAGES.home, siteUrl(), false) : html;
      },
    },
    {
      name: 'bigwords-pages',
      apply: 'build',
      writeBundle(options, bundle) {
        const out = options.dir!;
        const site = siteUrl();
        const noindex = isNoindex();
        const index = bundle['index.html'];
        if (index?.type !== 'asset') throw new Error('bigwords-pages: index.html missing from the bundle');
        const template = String(index.source);
        if (!template.includes('<!-- seo:head -->')) throw new Error('bigwords-pages: <!-- seo:head --> missing from index.html');

        // The site styles load with the lazy chrome chunk. docs.html links
        // them up front, so the prerendered docs are styled before JS runs.
        const css = new Set<string>();
        for (const chunk of Object.values(bundle)) {
          if (chunk.type === 'chunk' && chunk.moduleIds.some((id) => id.endsWith('/src/chrome.ts'))) {
            chunk.viteMetadata?.importedCss.forEach((f) => css.add(f));
          }
        }
        if (css.size === 0) throw new Error('bigwords-pages: no CSS found for the chrome chunk');
        const cssLinks = [...css].map((f) => `<link rel="stylesheet" crossorigin href="/${f}">`).join('\n    ');

        // Without SITE_URL, example links become relative (/#…); the client
        // swaps in the real origin when it renders the docs.
        const origin = escapeAttr(site);
        const article = renderDocs().replace(/\{origin\}|%7Borigin%7D/gi, origin);
        const docs = prerender(fillPage(template, PAGES.docs, site, noindex), cssLinks, `${staticHeader('docs')}<main><article class="docs">${article}</article></main>`);

        writeFileSync(resolve(out, 'index.html'), fillPage(template, PAGES.home, site, noindex));
        writeFileSync(resolve(out, 'editor.html'), fillPage(template, PAGES.editor, site, noindex));
        writeFileSync(resolve(out, 'docs.html'), docs);
        writeFileSync(resolve(out, '404.html'), notFoundPage(template, cssLinks));

        if (noindex) {
          writeFileSync(resolve(out, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
          return;
        }
        if (!site) {
          writeFileSync(resolve(out, 'robots.txt'), 'User-agent: *\nAllow: /\n');
          return;
        }
        writeFileSync(resolve(out, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`);
        const urls = Object.values(PAGES)
          .map((p) => `  <url><loc>${escapeAttr(site + p.path)}</loc></url>`)
          .join('\n');
        writeFileSync(
          resolve(out, 'sitemap.xml'),
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
        );
      },
    },
  ];
}
