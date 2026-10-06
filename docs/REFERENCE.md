# BIGWORDS.PAGE reference

BIGWORDS.PAGE shows a message as large as the screen allows. Everything about the display lives in the URL, so a link *is* the display. There are no accounts and no backend, and nothing is stored anywhere.

You can build every display by typing a URL by hand. The [editor]({origin}/editor) only makes that easier.

> **Try it:** [{origin}/#Hello%20World]({origin}/#Hello%20World)

## How the URL works

All state lives in the URL **fragment**, the part after `#`. Browsers never send the fragment to a server, so:

- the server never sees or logs your message,
- changing the fragment updates the display without reloading the page,
- one static page serves every possible display.

```
{origin}/#Hello%20World&bg=000000&fg=ffffff&anim=pulse
```

After the `#`:

```
#Hello%20World&bg=000000&fg=ffffff&anim=pulse
 └─ message ─┘ └──────── parameters ────────┘
```

The **message** is everything before the first unencoded `&`. Each segment after it is a `key=value` **parameter**.

The editor uses the same fragment at a different path:

```
Viewer:  {origin}/#Hello%20World&anim=pulse
Editor:  {origin}/editor#Hello%20World&anim=pulse
```

### Pages

| Path | What you get |
|---|---|
| `/` (no fragment) | Home page with examples |
| `/#…` (any fragment) | Viewer: fullscreen, no controls |
| `/editor` | Editor with live preview. Without a fragment it opens a starter message. |
| `/docs` | This reference |

Any non-empty fragment opens the viewer, even with no message. [`{origin}/#&bg=ff0000`]({origin}/#&bg=ff0000) is a solid red screen.

### Encoding

Use standard percent-encoding.

| Character | Write it as | Notes |
|---|---|---|
| Space | `%20` | |
| New line | `%0A` | The only way to make a line break |
| `&` | `%26` | Required in the message, since `&` starts a parameter |
| `#` | `%23` | Required in the message |
| `%` | `%25` | Required for a literal percent sign |
| `\|` | `%7C` | Optional |
| `{` `}` | `%7B` `%7D` | Optional |
| `\` | `%5C` | Optional |

When typing by hand you only strictly need to encode spaces, new lines, `&` and `%`. The editor always produces fully encoded URLs.

## Parameters

| Param | What it does | Values | Default |
|---|---|---|---|
| *(message)* | The text to display | Any percent-encoded text. Supports the [markdown subset](#formatting), `{countdown}`, `\|\|` slide breaks and `\` escapes. | *(empty)* |
| `bg` | Background color | `auto`, or 6-digit hex without `#` (`000000`) | `auto` |
| `fg` | Text color | `auto`, or 6-digit hex without `#` (`ffffff`) | `auto` |
| `font` | Font | `0`–`6`, see [Fonts](#fonts) | `0` |
| `size` | Font size | `auto`, pixels (`48`), or with a unit (`5vh`, `8vw`) | `auto` |
| `size-min` | Smallest auto size. Below it, text scrolls. | Pixels (`12`) or with a unit (`2vh`, `3vw`) | *(none)* |
| `size-max` | Largest size | Pixels (`72`) or with a unit (`15vh`, `10vw`) | *(none)* |
| `pad` | Padding, in percent | `5`, `5,10` or `5,10,5,10`, see [Padding](#padding) | `5` |
| `anim` | Animation | `none`, `pulse`, `flash`, `shake`, `bounce`, `scroll`, `crawl`, `typewriter`, `fadein`, `rainbow` | `none` |
| `speed` | Animation speed | `slow`, `normal`, `fast` | `normal` |
| `ratio` | Fix the display to an aspect ratio | `W:H` (`16:9`, `4:3`, `1:1`, `9:16`, `21:9`…) | *(fill the screen)* |
| `qr` | Show a QR code for a URL | Any percent-encoded URL | *(none)* |
| `qrpos` | QR code position | `tl`, `tr`, `bl`, `br`, `below` | `br` |
| `img` | Show an image | A percent-encoded public image URL | *(none)* |
| `imgpos` | Image position | `bg`, `full`, `above`, `below` | `bg` |
| `refresh` | Reload the page every N seconds | Whole number from 1 to 86400 (larger values count as 86400) | *(none)* |
| `until` | Countdown target | ISO 8601 date and time (`2026-12-31T23:59:00`) | *(none)* |
| `cdfmt` | Countdown format | `label`, `colon` | `label` |
| `zero` | What happens at zero | `freeze`, `hide`, or a replacement message | `freeze` |
| `interval` | Seconds per slide | Whole number from 1 to 86400 (larger values count as 86400) | `5` |
| `wake` | Keep the screen awake | `on`, `off` | `on` |

An invalid value (bad hex, unknown font, impossible date…) quietly falls back to that parameter's default. The viewer never shows an error.

## Formatting

There is one rendering mode. A small markdown subset always applies; a message without any markdown just shows as plain text.

| Write | Get |
|---|---|
| `**text**` or `__text__` | **Bold** |
| `*text*` or `_text_` | *Italic* |
| `***text***` or `___text___` | ***Bold italic*** |
| `~~text~~` | ~~Strikethrough~~ |
| `` `text` `` | `Code`: monospace on a faint box, shown exactly as typed |
| `# text` at the start of a line | Heading, 2× the base size |
| `## text` at the start of a line | Heading, 1.5× the base size |
| `%0A` | Line break |

Nothing else: no lists, tables, links, quotes, images or rules. Remember that `#` must be written `%23` in a URL:
[`{origin}/#%23%20Gate%2012%0ABoarding%20now`]({origin}/#%23%20Gate%2012%0ABoarding%20now)

**Underscores inside words are left alone**, as in standard Markdown, so names like `Home_Guest_5G`, `snake_case` or `first_name@example.com` show exactly as typed. Only an underscore at a word boundary starts or ends emphasis.

**Code is shown exactly as typed.** Nothing inside backticks is treated as formatting, a slide break, `{countdown}` or an escape, which makes it the easy way to show passwords and codes with symbols in them. A code span has to open and close on the same line. Browsers may write a typed backtick as `%60` in the address bar; both forms work.

[`{origin}/#Price:%20~~$20~~%20**$15**`]({origin}/#Price:%20~~$20~~%20**$15**) ·
[`{origin}/#Wi-Fi:%20Home_Guest_5G%0APassword:%20%60x*7|q%60`]({origin}/#Wi-Fi:%20Home_Guest_5G%0APassword:%20%60x*7|q%60)

### Special tokens

| Token | Meaning |
|---|---|
| `{countdown}` | Replaced by the live countdown when `until` is set. Works in any slide. Shown literally if there is no `until`. |
| `\|\|` | Slide break |

### Escapes

A backslash makes the next character literal.

| Write | Shows |
|---|---|
| <code>\\&#124;\\&#124;</code> or <code>\\&#124;&#124;</code> | <code>&#124;&#124;</code> (not a slide break) |
| `\{countdown}` | `{countdown}` |
| `\*not italic\*` | `*not italic*` |
| `\# not a heading` | `# not a heading` |
| `\~\~not struck\~\~` | `~~not struck~~` |
| ``\`not code\` `` | `` `not code` `` |
| `\_not italic\_` | `_not italic_` |
| `\\` | `\` |

A backslash before any other character is dropped. In a URL you can type the backslash as-is or as `%5C`.

Processing order: percent-decode → escapes and code spans → split slides on `||` → markdown → `{countdown}` → restore escaped characters.

## Fonts

| `font` | Font | License |
|---|---|---|
| `0` | Your device's system font | — |
| `1` | Inter | SIL OFL 1.1 |
| `2` | Montserrat | SIL OFL 1.1 |
| `3` | Roboto Slab | Apache 2.0 |
| `4` | Bebas Neue | SIL OFL 1.1 |
| `5` | JetBrains Mono | SIL OFL 1.1 |
| `6` | Caveat | SIL OFL 1.1 |

All fonts ship with the site, each next to its license file. A font is only downloaded, from this site, when a display uses it. Nothing is loaded from third-party font services.

## Size

With `size=auto` (the default), the text grows to the largest size at which the whole block fits inside the display minus its padding. Headings count at their full size. Text wraps at word boundaries and your line breaks are always kept. The size is recalculated whenever the window is resized or rotated, and each slide is fitted on its own.

| Value | Meaning |
|---|---|
| `48` | 48 pixels |
| `5vh` | 5% of the screen height |
| `8vw` | 8% of the screen width |
| `auto` | Fit to the screen (`size` only) |

- `size-max` caps the size, however much room there is.
- `size-min` sets a floor. If the text would have to shrink below it, it stays at the minimum and scrolls.
- With neither, the size scales freely with the screen.

Example: [`{origin}/#Big%20but%20not%20huge&size-max=12vh`]({origin}/#Big%20but%20not%20huge&size-max=12vh)

## Padding

`pad` is a percentage, written in CSS shorthand order. Top and bottom are a percentage of the display height; left and right are a percentage of its width. "Display" means the `ratio` region when one is set.

| Form | Example | Meaning |
|---|---|---|
| One value | `pad=5` | 5% on every side |
| Two values | `pad=5,10` | 5% top and bottom, 10% left and right |
| Four values | `pad=5,10,5,10` | Top, right, bottom, left |

The three-value form isn't supported. Each value must be below 50.

## Colors

`auto` follows the viewer's light or dark setting: white on black in dark mode (and when it can't be detected), black on white in light mode. Set `bg` and `fg` independently as 6-digit hex without the `#`. If you set only one, the other stays `auto`.

[`{origin}/#Exit&bg=0a7a2f&fg=ffffff&font=4`]({origin}/#Exit&bg=0a7a2f&fg=ffffff&font=4)

## Animations

<!-- anim-gallery -->

| `anim` | Effect | Example |
|---|---|---|
| `none` | Static | [`{origin}/#Standing%20still&font=2`]({origin}/#Standing%20still&font=2) |
| `pulse` | Gentle breathing scale | [`{origin}/#ON%20AIR&bg=b00020&fg=ffffff&font=4&anim=pulse`]({origin}/#ON%20AIR&bg=b00020&fg=ffffff&font=4&anim=pulse) |
| `flash` | Blinks on and off. *Fast flashing can affect people with photosensitive epilepsy.* | [`{origin}/#SALE&bg=ffd60a&fg=111111&font=4&anim=flash`]({origin}/#SALE&bg=ffd60a&fg=111111&font=4&anim=flash) |
| `shake` | Horizontal jitter | [`{origin}/#Wake%20up!&font=2&anim=shake`]({origin}/#Wake%20up!&font=2&anim=shake) |
| `bounce` | Vertical bounce | [`{origin}/#Over%20here!&font=6&anim=bounce`]({origin}/#Over%20here!&font=6&anim=bounce) |
| `scroll` | Marquee from right to left. The text is sized to the height, so set `size-max`. | [`{origin}/#Now%20boarding%20all%20rows&anim=scroll&size-max=30vh`]({origin}/#Now%20boarding%20all%20rows&anim=scroll&size-max=30vh) |
| `crawl` | Scrolls from bottom to top. The text is sized to the width, so set `size-max`. | [`{origin}/#Thanks%20for%20coming%0ASee%20you%20next%20year&anim=crawl&size-max=12vh&font=3`]({origin}/#Thanks%20for%20coming%0ASee%20you%20next%20year&anim=crawl&size-max=12vh&font=3) |
| `typewriter` | Types each character, pauses, deletes quickly, repeats | [`{origin}/#Hello...&anim=typewriter&font=5`]({origin}/#Hello...&anim=typewriter&font=5) |
| `fadein` | Fades in once | [`{origin}/#Good%20evening&font=3&anim=fadein&speed=slow`]({origin}/#Good%20evening&font=3&anim=fadein&speed=slow) |
| `rainbow` | Cycles the text through the color wheel, overriding `fg` | [`{origin}/#Happy%20Birthday!&anim=rainbow&font=6`]({origin}/#Happy%20Birthday!&anim=rainbow&font=6) |

`speed=slow|normal|fast` applies to all of them. Compare
[slow]({origin}/#Speed&font=4&anim=pulse&speed=slow),
[normal]({origin}/#Speed&font=4&anim=pulse) and
[fast]({origin}/#Speed&font=4&anim=pulse&speed=fast) pulses.

## Display ratio

Without `ratio`, the message fills the screen. With `ratio=W:H` it's drawn in a centered region of that shape, with the background color filling the rest. Useful for matching a projector or a video frame.

The editor also accepts a width × height in pixels and turns it into a ratio (1920 × 1080 → `16:9`). Only the ratio goes in the URL.

## Countdown

Set `until` to an ISO 8601 date and time, then put `{countdown}` in the message. The time is the **viewing device's local time**, unless you add a zone such as `Z` or `+02:00`. The editor's date picker takes the time in your own time zone and writes it to the URL in UTC (with `Z`), so the countdown ends at the same moment everywhere. If the message is empty, the countdown is shown on its own.

| `cdfmt` | Example |
|---|---|
| `label` (default) | `2d 14h 06m 32s` |
| `colon` | `02:14:06:32` |

Leading units are never dropped: three hours shows as `0d 03h 00m 00s`.

| `zero` | One slide | Several slides |
|---|---|---|
| `freeze` | Stays at zero | Every `{countdown}` stays at zero |
| `hide` | The display goes blank (background only) | Slides containing `{countdown}` drop out; the rest keep rotating. If none remain, the display goes blank. |
| *a message* | The message replaces the display | The message replaces each slide that contains `{countdown}` |

[`{origin}/#Doors%20open%20in%0A{countdown}&until=2027-01-01T19:00:00&zero=Welcome!`]({origin}/#Doors%20open%20in%0A{countdown}&until=2027-01-01T19:00:00&zero=Welcome!)

## Slides

Separate slides with `||`. All slides share every setting; each is fitted on its own and they slide in from the right every `interval` seconds.

[`{origin}/#Welcome!||Doors%20open%20in%0A{countdown}||Enjoy%20the%20show&until=2027-01-01T19:00:00&interval=8`]({origin}/#Welcome!||Doors%20open%20in%0A{countdown}||Enjoy%20the%20show&until=2027-01-01T19:00:00&interval=8)

The editor counts the URL's characters and warns as it nears about 2,000. Some messaging apps, email clients and proxies cut off longer links.

## QR code

`qr` takes a percent-encoded URL and draws its QR code in your browser. No outside service is used. `qrpos` puts it in a corner (`tl`, `tr`, `bl`, `br`) or centered below the text (`below`). It scales with the display and is always black on white with a quiet zone, so it scans whatever your colors are.

Encode any `&` inside the target URL as `%26`.

[`{origin}/#Scan%20me&qr={origin}/docs&qrpos=below`]({origin}/#Scan%20me&qr={origin}/docs&qrpos=below)

## Image

`img` takes a public image URL (`http`, `https` or `data:image`).

| `imgpos` | Behavior |
|---|---|
| `bg` | Fills the display, cropped as needed; text on top |
| `full` | Fits inside the display, letterboxed; text on top |
| `above` / `below` | Placed above or below the text, which fits into the space left |

The image loads straight from its host, which is never told which page asked for it. Like any image on the web, the host does see the viewing device's IP address and browser, and with `refresh` it sees a request every time the page reloads. Some hosts refuse to serve images to other sites, so an image that opens fine in its own tab can still fail here. If an image fails, the viewer simply leaves it out; the editor shows a warning.

`refresh=N` reloads the page every N seconds. It's only useful when the image URL points at something that changes, such as a webcam snapshot.

## Viewer behavior

- **Screen wake:** with `wake=on` (the default) the viewer asks the browser to keep the screen on. It asks again whenever the tab becomes visible. Browsers without support ignore it.
- **Fullscreen:** the viewer never asks for fullscreen and has no controls. Use your browser's or kiosk's own fullscreen mode.
- **Tab title:** always `BIGWORDS.PAGE`, whatever the message.
- **Errors:** never shown. Bad parameters use defaults; failed images are left out.

## The editor

The editor shows a live preview that renders exactly what the viewer shows, plus controls for every parameter.

- The address bar always mirrors the current state, without filling your history.
- Editing the fragment in the address bar updates the controls.
- **Copy URL** copies the viewer URL (the same fragment without `/editor`). **Open viewer** opens it in a new tab.
- Parameters left at their defaults are dropped from the URL to keep it short.

## Privacy

The message and settings live only in the URL fragment, which browsers do not send to servers. BIGWORDS.PAGE itself includes no analytics, cookies or tracking.

## Self-hosting

The build is a folder of static files. Any static host works if it serves `index.html` for `/`, `editor.html` for `/editor`, `docs.html` for `/docs`, and `404.html` with status 404 for any other path. Set `SITE_URL` to your own origin when building (for example `SITE_URL=https://signs.example.com npm run build`) to add canonical URLs, social cards and a sitemap. A Docker image based on Caddy is included in the [repository](https://github.com/SpeakingOfBrad/BIGWORDS.PAGE):

```
docker compose up -d --build
```

The container listens on port 80 inside its network and publishes no ports by default. Put it behind your reverse proxy, which handles TLS.
