# BIGWORDS.PAGE

Show a message as big as the screen allows. The URL is the whole display: no accounts, no login, no backend.

```
https://your-domain/#Hello%20World&bg=000000&fg=ffd60a&font=4&anim=pulse
```

- **Viewer** `/#…`: fullscreen render, no UI.
- **Editor** `/editor#…`: live preview and controls. The address bar always mirrors the state, **Copy URL** copies the viewer link, and the QR button shows it as a code to scan.
- **Docs** `/docs`: the full reference, built from [`docs/REFERENCE.md`](docs/REFERENCE.md).

Everything lives in the URL fragment, which browsers never send to the server. Features: auto-fit sizing, a small markdown subset with relative headings, slides (`||`), countdowns (`{countdown}` + `until`), animations, bundled open-source fonts, aspect-ratio framing, client-side QR codes and embedded images. See the **[reference](docs/REFERENCE.md)** for every parameter.

## Development

Requires Node 22.12+. CI and the Docker build use the LTS release in [`.node-version`](.node-version), currently 24.

```sh
npm install
npm run dev        # dev server
npm test           # unit tests (Vitest)
npm run typecheck
npm run build      # static output in dist/
npm run preview    # serve dist/ on :4173
npm run smoke      # browser smoke test against the preview server (Playwright)
npm run clipcheck  # checks that no glyph ink is clipped at the text area edges
```

GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs the unit tests, build and smoke test on every push to `main` and every pull request. Clipcheck runs too, but its result doesn't fail the build.

Project layout:

| Path | Purpose |
|---|---|
| `src/state/` | Fragment parsing/serialization, parameter validation and defaults |
| `src/render/text.ts` | Message pipeline: escapes → slides → markdown → `{countdown}` |
| `src/render/display.ts` | The renderer shared by the viewer, editor preview and home page |
| `src/editor/` | Editor UI |
| `docs/REFERENCE.md` | Documentation source, rendered into `/docs` at build time |
| `public/fonts/` | Vendored fonts with their licenses (`npm run fonts` regenerates them) |

## Self-hosting

The build is a folder of static files, so any static host works if it serves `index.html` for `/`, `editor.html` for `/editor`, `docs.html` for `/docs`, and `404.html` with status 404 for any other path. If your host sends a Content-Security-Policy, copy the `script-src` from the [`Caddyfile`](Caddyfile): `index.html` has one inline script, allowed by its hash. The supported way to run it is the Docker image.

### Docker

The image is the official `caddy` image serving the build from `/usr/share/caddy`, with a Caddyfile that listens on `:80`, sets the security headers and serves `404.html` for unknown paths.

```sh
git clone https://github.com/SpeakingOfBrad/BIGWORDS.PAGE.git
cd BIGWORDS.PAGE
docker compose up -d --build
```

`compose.yaml` publishes no ports (port 80 is listed but commented out). Attach the service to your reverse proxy's network and let the proxy handle TLS. The proxy should also send `Strict-Transport-Security`.

The image keeps the stock Caddy defaults, including running as root, so it behaves like any other `caddy` container. The site is static and holds no secrets, but if you want to lock the container down further, these compose settings work with it:

```yaml
services:
  bigwords:
    read_only: true
    tmpfs:
      - /data
      - /config
    cap_drop: [ALL]
    cap_add: [NET_BIND_SERVICE] # needed to listen on :80
    security_opt: [no-new-privileges:true]
    mem_limit: 128m
    cpus: 0.5
```

To run as a non-root user as well, change the Caddyfile to listen on a port above 1024 (for example `:8080`), add `user: "1000:1000"`, and point your proxy and the Dockerfile `HEALTHCHECK` at the new port.

### Build settings

All optional. Set them as environment variables for `npm run build`, or as build args in `compose.yaml` (`build.args`) or `docker build --build-arg`.

| Setting | Effect |
|---|---|
| `SITE_URL` | Your public origin, e.g. `https://signs.example.com`. Adds canonical URLs, Open Graph/Twitter image tags, home page JSON-LD and `sitemap.xml`, all of which need an absolute URL. Without it they're left out. |
| `NOINDEX` | `1` adds `noindex` to every page, makes `robots.txt` disallow everything and drops the sitemap. For staging copies and private instances. |
| `OPERATOR_DOCS` | Path to a Markdown file appended to `/docs`, for notes about your instance, such as who runs it and how to report abuse. Relative to the repository root. |

### SEO

The build writes one HTML file per page (`index.html`, `editor.html`, `docs.html`), each with its own title, description and Open Graph tags. Page titles and descriptions live in [`src/pages.ts`](src/pages.ts), which the runtime also uses for the tab title. `index.html` and `docs.html` contain the prerendered home page and reference, so they read without JavaScript. `index.html` also serves every display (`/#…`), so a small inline script in its `<head>` hides the home page when the URL has a fragment, before anything is drawn; its hash is in the Caddyfile's CSP, and a unit test checks that they match. The build also writes `robots.txt` and a `noindex` `404.html` that hosts serve with status 404 for unknown paths, so typos and stale links aren't indexed as copies of the home page. `npm run preview` does the same.

The social card `public/og.png` and `public/apple-touch-icon.png` are rendered with the real viewer by `npm run og` (with `npm run preview` running) and committed. Re-run it after changing the fonts or the favicon.

## License

[MIT](LICENSE). Bundled fonts and libraries keep their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
