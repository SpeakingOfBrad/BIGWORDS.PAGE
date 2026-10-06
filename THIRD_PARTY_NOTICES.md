# Third-party notices

BIGWORDS.PAGE is released under the MIT license (see `LICENSE`). It bundles the
following third-party components, each under its own license.

## Fonts

The font files in `public/fonts/` are the upstream fonts, unmodified, as
redistributed by the [Fontsource](https://fontsource.org) packages (Latin and
Latin Extended subsets, regular and bold, with italics where the family has
them). Each folder contains the font's full license text as `LICENSE.txt`, and
that file ships next to the fonts in the build output.

| Font | Upstream | License |
|---|---|---|
| Inter | https://github.com/rsms/inter | SIL Open Font License 1.1 |
| Montserrat | https://github.com/JulietaUla/Montserrat | SIL Open Font License 1.1 |
| Roboto Slab | https://github.com/googlefonts/robotoslab | Apache License 2.0 |
| Bebas Neue | https://github.com/dharmatype/Bebas-Neue | SIL Open Font License 1.1 |
| JetBrains Mono | https://github.com/JetBrains/JetBrainsMono | SIL Open Font License 1.1 |
| Caveat | https://github.com/googlefonts/caveat | SIL Open Font License 1.1 |

To update the fonts, bump the `@fontsource/*` dev dependencies and run
`npm run fonts`.

## JavaScript

| Package | License |
|---|---|
| [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) by Kazuhiko Arase | MIT |

"QR Code" is a registered trademark of DENSO WAVE INCORPORATED.
