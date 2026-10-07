// The home page as an HTML string. The build prerenders it into index.html,
// so the page reads without JavaScript, and home.ts renders the same markup
// at runtime before attaching the live previews. No DOM access here: the
// build runs it in Node.

import { SITE_NAME, SOURCE_URL } from './pages';

export const HERO = 'Say%20it%20**big.**||Any%20screen.%0AAny%20size.||No%20app.%20No%20login.%0AJust%20a%20**URL.**&bg=111111&fg=ffd60a&font=4&interval=3';

const nextNewYear = () => `${new Date().getFullYear() + 1}-01-01T00:00:00`;

export interface Example {
  title: string;
  fragment: string;
  more?: boolean;
}

/**
 * The use case cards. The first eight show on the page; the ones marked
 * `more` sit behind a "More use cases" button. Every card is a working link.
 */
export const examples = (): Example[] => [
  { title: 'Arrivals sign', fragment: '**WELCOME%20HOME,%20GRANDMA!**&bg=f9d5e5&fg=4a2c40&font=6&anim=pulse' },
  { title: 'Quiz timer', fragment: 'Quiz%20timer:%0A%7Bcountdown%7D&bg=000000&fg=ffffff&font=3&timer=15m&zero=Pencils%20down' },
  { title: 'Café Wi-Fi', fragment: 'Wi-Fi:%20**Cafe%20Guest**%0APassword:%20**latte;art**%7C%7CWelcome!&fg=f3e5d0&font=2&qr=WIFI:T:WPA;S:Cafe%20Guest;P:latte%5C;art;;&interval=4&img=data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCAxOTIgMTA4Jz48ZGVmcz48ZyBpZD0nYic+PGVsbGlwc2Ugcng9JzUnIHJ5PSczLjQnLz48ZWxsaXBzZSByeD0nNScgcnk9JzMuNCcgZmlsbD0ndXJsKCNzKScvPjxwYXRoIGQ9J00tNCwwQy0xLjUtLjksMS41LjksNCwwJyBzdHJva2U9JyMxNDBjMDgnIHN0cm9rZS13aWR0aD0nLjUnIGZpbGw9J25vbmUnLz48L2c+PHJhZGlhbEdyYWRpZW50IGlkPSdzJyBjeD0nLjM1JyBjeT0nLjMnPjxzdG9wIHN0b3AtY29sb3I9JyM4YTVhM2MnIHN0b3Atb3BhY2l0eT0nLjUnLz48c3RvcCBvZmZzZXQ9JzEnIHN0b3Atb3BhY2l0eT0nLjMnLz48L3JhZGlhbEdyYWRpZW50PjxwYXR0ZXJuIGlkPSdwJyB3aWR0aD0nMzgnIGhlaWdodD0nMzQnIHBhdHRlcm5Vbml0cz0ndXNlclNwYWNlT25Vc2UnIHBhdHRlcm5UcmFuc2Zvcm09J3JvdGF0ZSgxNyknPjx1c2UgaHJlZj0nI2InIHRyYW5zZm9ybT0ndHJhbnNsYXRlKDcsNylyb3RhdGUoMzApJyBmaWxsPScjNGEyZjIwJy8+PHVzZSBocmVmPScjYicgdHJhbnNmb3JtPSd0cmFuc2xhdGUoMjAsNilyb3RhdGUoLTUwKXNjYWxlKDEuMDUpJyBmaWxsPScjNTYzODI2Jy8+PHVzZSBocmVmPScjYicgdHJhbnNmb3JtPSd0cmFuc2xhdGUoMzIsOSlyb3RhdGUoNzUpc2NhbGUoMC45KScgZmlsbD0nIzNmMjgxYicvPjx1c2UgaHJlZj0nI2InIHRyYW5zZm9ybT0ndHJhbnNsYXRlKDEyLDE4KXJvdGF0ZSg5NSlzY2FsZSgwLjk1KScgZmlsbD0nIzVlM2QyOCcvPjx1c2UgaHJlZj0nI2InIHRyYW5zZm9ybT0ndHJhbnNsYXRlKDI2LDE5KXJvdGF0ZSgxNjApJyBmaWxsPScjNGEyZjIwJy8+PHVzZSBocmVmPScjYicgdHJhbnNmb3JtPSd0cmFuc2xhdGUoNywyOClyb3RhdGUoLTIwKScgZmlsbD0nIzU2MzgyNicvPjx1c2UgaHJlZj0nI2InIHRyYW5zZm9ybT0ndHJhbnNsYXRlKDE5LDI5KXJvdGF0ZSg0MClzY2FsZSgwLjk1KScgZmlsbD0nIzNmMjgxYicvPjx1c2UgaHJlZj0nI2InIHRyYW5zZm9ybT0ndHJhbnNsYXRlKDMxLDI4KXJvdGF0ZSgxMjApc2NhbGUoMS4wNSknIGZpbGw9JyM1ZTNkMjgnLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPScxOTInIGhlaWdodD0nMTA4JyBmaWxsPScjMWExMTBjJy8+PHJlY3Qgd2lkdGg9JzE5MicgaGVpZ2h0PScxMDgnIGZpbGw9J3VybCgjcCknLz48L3N2Zz4=' },
  { title: 'New Year countdown', fragment: `Happy%20New%20Year%20in%0A{countdown}&until=${nextNewYear()}&font=5&cdfmt=colon&zero=Happy%20New%20Year!` },
  { title: 'On air', fragment: 'ON%20AIR&bg=b00020&fg=ffffff&font=4&anim=pulse' },
  { title: 'Gate or room sign', fragment: '%23%20Gate%2012%0ABoarding%20now&bg=0b3d91&fg=ffffff&font=2' },
  { title: 'News ticker', fragment: 'Breaking%20news:%20this%20text%20scrolls%20forever&anim=scroll&size-max=40vh&font=1&bg=000000&fg=00ff66' },
  { title: 'Birthday', fragment: 'Happy%20Birthday!&anim=rainbow&font=6' },
  { title: 'Quiet, recording', fragment: 'Quiet%20please%0A**Recording%20in%20progress**&bg=111111&fg=ff5c5c&font=1', more: true },
  { title: 'Exam room', fragment: 'Exam%20in%20progress%0AEnds%20in%20%7Bcountdown%7D&timer=1h&bg=ffffff&fg=111111&font=1', more: true },
  { title: "Today's agenda", fragment: "%23%20Today's%20agenda||9:00%20Welcome||10:30%20Workshops||12:30%20Lunch&font=2&interval=3", more: true },
  { title: 'Menu by QR code', fragment: 'Scan%20for%20the%20menu&qr=https://example.com/menu&qrpos=below&qrsize=50&font=2&bg=ffffff&fg=111111', more: true },
];

const STEPS: [string, string][] = [
  ['Type a message after the #. Spaces are %20.', 'Hello%20World'],
  ['Add settings with &key=value.', 'Hello%20World&bg=000000&fg=ffd60a&font=4'],
  ['%0A starts a new line. # makes a heading (write it as %23).', '%23%20Room%20204%0AMeeting%20in%20progress'],
  ['|| splits the message into slides.', 'Coffee%20%E2%98%95||Tea%20%F0%9F%8D%B5||Water%20%F0%9F%92%A7&interval=2'],
];

const FEATURES: [string, string][] = [
  ['Auto-fit', 'Text grows to fill any screen, from a phone to a stadium board.'],
  ['Any device', 'Works in any browser: phones, tablets, laptops, smart TVs.'],
  ['Markdown', '**bold**, *italic*, # and ## headings, real line breaks.'],
  ['Slides', 'Split with || and they rotate on a timer.'],
  ['Countdowns', 'Put {countdown} anywhere and set &until= for a date or &timer= for a length of time.'],
  ['QR codes & images', 'Links, Wi-Fi, calls, texts and email, generated in your browser. No third-party services.'],
  ['Private by design', 'The message lives in the URL fragment, which browsers never send to a server.'],
];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The home page's <main> and <footer>. `origin` makes the example URLs
 * absolute; the build passes SITE_URL, which may be empty.
 */
export function homeMarkup(origin: string): string {
  const url = (fragment: string) => esc(`${origin}/#${fragment}`);
  const href = (path: string, fragment: string) => esc(`${path}#${fragment}`);
  const card = (ex: Example) =>
    `<div class="example"><a href="${href('/', ex.fragment)}" style="text-decoration:none" aria-label="Open example: ${esc(ex.title)}">` +
    `<div class="thumb"><div></div></div><div class="meta"><strong>${esc(ex.title)}</strong><code>${url(ex.fragment)}</code></div></a>` +
    `<div class="example-actions"><a class="btn btn-sm" href="${href('/', ex.fragment)}">Open</a><a class="btn btn-sm" href="${href('/editor', ex.fragment)}">Edit</a></div></div>`;
  const all = examples();
  const shown = all.filter((ex) => !ex.more).map(card).join('');
  const more = all.filter((ex) => ex.more).map(card).join('');
  return (
    '<main class="home">' +
    '<section class="hero"><div><h1>Big words for any screen</h1>' +
    '<p class="lede">Make a full-screen sign, timer or message from a link. Hold up your phone at arrivals, put a countdown on the TV, or show the Wi-Fi password at the front desk. No account, no app, nothing stored on a server. The link is the whole display, so you can share it or bookmark it.</p>' +
    `<div class="hero-actions"><a class="btn btn-primary" href="/editor">Open the editor</a><a class="btn" href="/docs">Read the docs</a><a class="btn" href="${href('/', HERO)}">View fullscreen</a></div></div>` +
    `<div class="demo"><div class="demo-frame"><div></div></div><div class="demo-url"><a href="${href('/', HERO)}">${url(HERO)}</a></div></div></section>` +
    '<section class="section"><h2>Make one by hand</h2><p>Using the built-in editor is easiest, but generate a link however you like.</p><ol class="steps">' +
    STEPS.map(([text, frag]) => `<li><div><p>${esc(text)}</p><a class="url" href="${href('/', frag)}">${url(frag)}</a></div></li>`).join('') +
    '</ol></section>' +
    `<section class="section"><h2>Use cases</h2><p>Every card is a working link. Open it fullscreen, or load it into the editor and make it yours.</p><div class="examples">${shown}</div>` +
    `<details class="more-examples"><summary class="btn"><span class="when-closed">More use cases</span><span class="when-open">Fewer use cases</span></summary><div class="examples">${more}</div></details></section>` +
    '<section class="section"><h2>What it does</h2><div class="features">' +
    FEATURES.map(([t, d]) => `<div class="feature"><strong>${esc(t)}</strong><span>${esc(d)}</span></div>`).join('') +
    '</div></section></main>' +
    `<footer class="site-footer"><p>${SITE_NAME} is <a href="${esc(SOURCE_URL)}">open source</a> under the MIT license. Fonts are bundled under their own open licenses.</p>` +
    `<p><a href="/docs">Docs</a> · <a href="/editor">Editor</a> · <a href="${esc(SOURCE_URL)}">GitHub</a></p></footer>`
  );
}
