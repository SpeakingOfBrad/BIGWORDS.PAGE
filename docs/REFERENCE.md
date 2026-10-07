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
| `qr` | Show a QR code | A percent-encoded URL, or a Wi-Fi, phone, text, email or location code, see [QR code](#qr-code) | *(none)* |
| `qrpos` | QR code position | `tl`, `tr`, `bl`, `br`, `below` | `br` |
| `qrsize` | QR code size, in percent of the display's shorter side | Whole number from 10 to 50 | `25` |
| `img` | Show an image | A percent-encoded public image URL | *(none)* |
| `imgpos` | Image position | `bg`, `full`, `above`, `below` | `bg` |
| `refresh` | Reload the page every N seconds | Whole number from 1 to 86400 (larger values count as 86400) | *(none)* |
| `until` | Countdown target | ISO 8601 date and time (`2026-12-31T23:59:00`) | *(none)* |
| `timer` | Countdown length, from when the page opens. Use `until` or `timer`, not both. | Seconds (`14400`), or `d`, `h`, `m`, `s` amounts (`4h`, `1h30m`) | *(none)* |
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
| `{countdown}` | Replaced by the live countdown when `until` or `timer` is set. Works in any slide. Shown literally if neither is set. |
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

There are two kinds: `until` counts down to a date and time, and `timer` counts down for a length of time. Set one and put `{countdown}` in the message. If the message is empty, the countdown is shown on its own. Format and `zero` work the same for both.

### Until a date and time

Set `until` to an ISO 8601 date and time. The time is the **viewing device's local time**, unless you add a zone such as `Z` or `+02:00`. The editor's date picker takes the time in your own time zone and writes it to the URL in UTC (with `Z`), so the countdown ends at the same moment everywhere.

### For a length of time

Set `timer` to a length of time. **The timer starts when the page opens**, so reloading the page or opening the link again starts it over, and so does `refresh`. Each device that opens the link runs its own timer. It keeps time while the tab is in the background or the screen is off.

| `timer` | Length |
|---|---|
| `14400` | A plain number is seconds: 4 hours |
| `4h` | 4 hours |
| `1h30m` | 1 hour 30 minutes |
| `2d12h` | 2 days 12 hours |
| `45s` | 45 seconds |

Use any of `d`, `h`, `m` and `s`, in any order, with no spaces. Amounts add up and can go past the next unit, so `90m` is 1 hour 30 minutes and `1d28h` is 2 days 4 hours. The longest timer is 99 days.

[`{origin}/#Break%20ends%20in%0A{countdown}&timer=15m&zero=Back%20to%20work!`]({origin}/#Break%20ends%20in%0A{countdown}&timer=15m&zero=Back%20to%20work!)

**`until` and `timer` can't be used together.** If a link has both, the one that comes first is used and the other is ignored. The editor shows one at a time: pick **Countdown** or **Timer** at the top of its Countdown or timer section.

### Format and zero

| `cdfmt` | Example |
|---|---|
| `label` (default) | `2d 14h 06m 32s` |
| `colon` | `02:14:06:32` |

With `label`, units are dropped from the front once they reach zero: three hours shows as `3h 00m 00s`, then `59m 59s`, then `59s`. Zeros after the first unit stay, so the countdown doesn't jump around as it ticks. `colon` always shows all four units.

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

`qr` puts a QR code on the display, drawn in your browser with no outside service. Its value is the text the code holds, and how it starts decides what the scanning phone does:

| Type | `qr` starts with | Phone action |
|---|---|---|
| [Link](#link) | Any URL, such as `https://` | Opens the link |
| [Wi-Fi](#wi-fi) | `WIFI:` | Offers to join the network |
| [Phone call](#phone-call) | `tel:` | Offers to call the number |
| [Text/SMS](#text-sms) | `SMSTO:` | Opens a new text message |
| [Email](#email) | `mailto:` | Opens a new email |
| [Location](#location) | `geo:` | Opens a maps app (Android) |
| [Plain text](#plain-text) | Anything else | Shows the text |

The editor's **QR code** section has a form for each type and writes the URL for you. Writing one by hand, follow the usual [encoding](#encoding) inside the `qr` value too: spaces are `%20` and `&` is `%26`.

### Placement and size

| Param | What it does | Values | Default |
|---|---|---|---|
| `qrpos` | Where the code goes | A corner (`tl`, `tr`, `bl`, `br`), or centered below the text (`below`) | `br` |
| `qrsize` | Size, in percent of the display's shorter side | Whole number from `10` to `50` | `25` |

The code scales with the screen. Larger codes scan from farther away, and a long `qr` value makes a denser code, which needs a larger size. The code is always black on white with a quiet zone, so it scans whatever your colors are.

### Link

`qr=<URL>`: any URL, such as `https://example.com/menu`. Inside it, write `&` as `%26`, `#` as `%23` and `%` as `%25` (so an escaped space, `%20`, becomes `%2520`).

[`{origin}/#Scan%20me&qr={origin}/docs&qrpos=below`]({origin}/#Scan%20me&qr={origin}/docs&qrpos=below)

### Wi-Fi

`qr=WIFI:T:<security>;S:<network>;P:<password>;;`

Phones that scan it offer to join the network. Each field ends in `;`, the fields can come in any order, and the whole value ends with one more `;`.

| Field | Meaning | Values | Required |
|---|---|---|---|
| `T` | Security | `WPA` (also covers WPA2 and WPA3), `WEP`, or `nopass` for an open network | Yes |
| `S` | Network name (SSID), exactly as the phone lists it | Text | Yes |
| `P` | Password | Text | Yes, unless `T:nopass`; leave it out then |
| `H` | Hidden network | `true` | No; leave it out for a visible network |

In the network name and password, first put a `\` before any `\`, `;`, `,`, `:` or `"`. Then encode the result for the URL: spaces become `%20` and each `\` becomes `%5C`. For the network `Cafe Guest` with the password `latte;art`:

| Step | Value |
|---|---|
| Fields | `T:WPA;` `S:Cafe Guest;` `P:latte\;art;` |
| Code text | `WIFI:T:WPA;S:Cafe Guest;P:latte\;art;;` |
| In the URL | `qr=WIFI:T:WPA;S:Cafe%20Guest;P:latte%5C;art;;` |

[`{origin}/#Free%20Wi-Fi%0AScan%20to%20join&qr=WIFI:T:WPA;S:Cafe%20Guest;P:latte%5C;art;;&qrpos=below&qrsize=35`]({origin}/#Free%20Wi-Fi%0AScan%20to%20join&qr=WIFI:T:WPA;S:Cafe%20Guest;P:latte%5C;art;;&qrpos=below&qrsize=35)

An open network: `qr=WIFI:T:nopass;S:Library;;`. A hidden one: `qr=WIFI:T:WPA;S:Back%20Office;P:secret123;H:true;;`.

The password is in the link and in the code, so anyone with the link or a view of the screen can read it.

### Phone call

`qr=tel:<number>`

The number is required. Use the international form, such as `+15551234567`, so it works from any country; the `+` can be typed as is. Spaces and dashes in the number are ignored, so `tel:+1-555-123-4567` works too.

[`{origin}/#%23%20Lost%20dog%0AMax,%20brown%20terrier%0ACall%20555-123-4567&qr=tel:+15551234567&qrpos=below&qrsize=30`]({origin}/#%23%20Lost%20dog%0AMax,%20brown%20terrier%0ACall%20555-123-4567&qr=tel:+15551234567&qrpos=below&qrsize=30)

### Text/SMS

`qr=SMSTO:<number>:<message>`

| Field | Meaning | Required |
|---|---|---|
| Number | The number to text, as for [Phone call](#phone-call) | Yes |
| Message | Filled in for the sender to edit before sending. It can contain `:`. Leave it out along with the `:` before it for an empty message. | No |

[`{origin}/#%23%20Found%20a%20cat?%0AText%20us&qr=SMSTO:+15551234567:I%20found%20your%20cat&qrpos=below&qrsize=30`]({origin}/#%23%20Found%20a%20cat?%0AText%20us&qr=SMSTO:+15551234567:I%20found%20your%20cat&qrpos=below&qrsize=30)

### Email

`qr=mailto:<address>?subject=<subject>%26body=<message>`

| Field | Meaning | Required |
|---|---|---|
| Address | Who the email goes to | Yes |
| `subject` | Filled-in subject | No |
| `body` | Filled-in message | No |

Leave out a field you don't need, and the `?` too if there are none. The `&` between `subject` and `body` must be written `%26`.

[`{origin}/#Questions?%0AEmail%20us&qr=mailto:hello@example.com?subject=Question%26body=Hi!&qrpos=below`]({origin}/#Questions?%0AEmail%20us&qr=mailto:hello@example.com?subject=Question%26body=Hi!&qrpos=below)

### Location

`qr=geo:<latitude>,<longitude>`

| Field | Meaning | Values | Required |
|---|---|---|---|
| Latitude | North (+) or south (−) | Decimal degrees, `-90` to `90` | Yes |
| Longitude | East (+) or west (−) | Decimal degrees, `-180` to `180` | Yes |

Android opens it in a maps app. iPhone cameras may only show it as text, so for iPhones use a [link](#link) to a map instead.

[`{origin}/#Meet%20here&qr=geo:40.6892,-74.0445&qrpos=below`]({origin}/#Meet%20here&qr=geo:40.6892,-74.0445&qrpos=below)

### Plain text

Any value that isn't one of the above, such as `qr=Table%2012`, goes in the code as text, decoded like the rest of the URL (`Table 12`). The phone shows the text and does nothing else.

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
- **Copy URL** copies the viewer URL (the same fragment without `/editor`). **Open viewer** opens it in a new tab. The QR button next to the URL shows it as a QR code, so a phone or tablet can scan it to open the display.
- Parameters left at their defaults are dropped from the URL to keep it short.

## Privacy

The message and settings live only in the URL fragment, which browsers do not send to servers. BIGWORDS.PAGE's own code adds no analytics, cookies or tracking. A site that hosts it may add analytics of its own: check that site's notes, which may follow at the end of this page, or its privacy policy.

## Self-hosting

The build is a folder of static files. Any static host works if it serves `index.html` for `/`, `editor.html` for `/editor`, `docs.html` for `/docs`, and `404.html` with status 404 for any other path. Set `SITE_URL` to your own origin when building (for example `SITE_URL=https://signs.example.com npm run build`) to add canonical URLs, social cards and a sitemap. A Docker image based on Caddy is included in the [repository](https://github.com/SpeakingOfBrad/BIGWORDS.PAGE):

```
docker compose up -d --build
```

The container listens on port 80 inside its network and publishes no ports by default. Put it behind your reverse proxy, which handles TLS.
