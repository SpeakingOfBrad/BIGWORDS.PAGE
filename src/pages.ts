// Titles and descriptions for the indexable pages. The build writes them into
// each page's static HTML (vite-plugin-docs.ts) and main.ts sets the same
// titles at runtime, so the two never disagree.

export const SITE_NAME = 'BIGWORDS.PAGE';

/** The project's source code, linked from the home page footer. */
export const SOURCE_URL = 'https://github.com/SpeakingOfBrad/BIGWORDS.PAGE';

export interface PageMeta {
  path: string;
  title: string;
  description: string;
}

export const PAGES = {
  home: {
    path: '/',
    title: 'BIGWORDS.PAGE: Big words for any screen',
    description: 'Show any message as big as the screen allows. The URL is the whole display: no app, no account, no backend. Free and open source.',
  },
  editor: {
    path: '/editor',
    title: 'Editor · BIGWORDS.PAGE',
    description: 'Build a fullscreen message with a live preview: colors, fonts, slides, countdowns, animations and QR codes. Share it as a single link.',
  },
  docs: {
    path: '/docs',
    title: 'Docs: URL reference · BIGWORDS.PAGE',
    description: 'Every BIGWORDS.PAGE URL parameter: formatting, fonts, size, colors, animations, slides, countdowns, QR codes, images and self-hosting.',
  },
} as const satisfies Record<string, PageMeta>;

/** Served with status 404 for unknown paths. Not indexed and not in the sitemap. */
export const NOT_FOUND = {
  title: 'Page not found · BIGWORDS.PAGE',
  description: 'There is no page at this address.',
} as const;
