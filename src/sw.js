// Service worker: keeps a copy of the site so displays, the editor and the
// docs work offline after the first visit. The build (vite-plugin-docs.ts)
// writes dist/sw.js from this file, with VERSION and PRECACHE defined above
// it: a hash of the cached files and the list of URLs to cache.
/* global VERSION, PRECACHE */

const CACHE = `bigwords-${VERSION}`;
// How long a page request waits for the network before using the cached copy.
const NETWORK_TIMEOUT = 3000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Build files and fonts never change under the same name, so the copy
      // the browser just downloaded for the page will do. Anything else is
      // checked with the server first.
      await Promise.all(
        PRECACHE.map(async (url) => {
          const res = await fetch(new Request(url, { cache: isImmutable(url) ? 'default' : 'no-cache' }));
          if (!res.ok) throw new Error(`sw: ${url} returned ${res.status}`);
          await cache.put(url, await servable(res));
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Start page requests while the worker boots, instead of after.
      await self.registration.navigationPreload?.enable();
      // Keep the previous version's cache: a display left open since then
      // still loads its files (a font, the QR code) from it. Older ones go.
      const old = (await caches.keys()).filter((key) => key.startsWith('bigwords-') && key !== CACHE);
      for (const key of old.slice(0, -1)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Images on other hosts and anything that isn't a plain GET go straight to
  // the network.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') event.respondWith(page(event, url));
  else if (isImmutable(url.pathname)) event.respondWith(immutable(req));
  else event.respondWith(other(req));
});

/**
 * Pages: the network first, so updates show up as soon as they're deployed,
 * then the cached copy. Every route renders from the cached home page,
 * because the app routes on the client.
 */
async function page(event, url) {
  const cache = await caches.open(CACHE);
  const cached = async () => (await cache.match(url.pathname, { ignoreVary: true })) ?? (await cache.match('/', { ignoreVary: true }));
  const network = (async () => (await event.preloadResponse) ?? fetch(event.request))().then(async (res) => {
    if (res.ok && res.type === 'basic' && !res.redirected) await cache.put(url.pathname, res.clone());
    return res;
  });
  event.waitUntil(network.catch(() => {}));
  const offline = network.catch(async () => (await cached()) ?? Response.error());
  const slow = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT)).then(async () => (await cached()) ?? offline);
  return Promise.race([offline, slow]);
}

/**
 * Hashed build files and fonts never change: the cache first, any version's,
 * since a page from the previous version still asks for its own files.
 */
async function immutable(req) {
  // ignoreVary: a header such as Vary: Origin would make the page's request
  // (which can carry an Origin header) miss the copy saved without one. These
  // files are the same for every request.
  const hit = await caches.match(req, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.type === 'basic') await (await caches.open(CACHE)).put(req, res.clone());
  return res;
}

/** Everything else (icons, the manifest): the network, then the cache. */
async function other(req) {
  try {
    return await fetch(req);
  } catch (err) {
    const hit = await caches.match(req, { cacheName: CACHE, ignoreSearch: true, ignoreVary: true });
    if (hit) return hit;
    throw err;
  }
}

/** Hashed build files and versioned fonts: a name never gets new content. */
function isImmutable(path) {
  return path.startsWith('/assets/') || path.startsWith('/fonts/');
}

/** Browsers refuse a redirected response for a page, so store a plain copy. */
async function servable(res) {
  if (!res.redirected) return res;
  return new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers });
}
