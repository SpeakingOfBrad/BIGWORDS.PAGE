// Vendors the bundled fonts from @fontsource packages (which redistribute the
// upstream font files unmodified) into public/fonts, along with each license,
// and writes the manifest the app uses to register @font-face rules lazily.
// Font files sit in a directory named after the package version: they are
// served as immutable, so an updated file must get a new URL.
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const FONTS = [
  { id: 1, slug: 'inter', family: 'Inter' },
  { id: 2, slug: 'montserrat', family: 'Montserrat' },
  { id: 3, slug: 'roboto-slab', family: 'Roboto Slab' },
  { id: 4, slug: 'bebas-neue', family: 'Bebas Neue' },
  { id: 5, slug: 'jetbrains-mono', family: 'JetBrains Mono' },
  { id: 6, slug: 'caveat', family: 'Caveat' },
];
const SUBSETS = ['latin', 'latin-ext'];
const WEIGHTS = [400, 700];
const STYLES = ['normal', 'italic'];

rmSync('public/fonts', { recursive: true, force: true });
const manifest = {};
for (const f of FONTS) {
  const pkg = join('node_modules/@fontsource', f.slug);
  const ranges = JSON.parse(readFileSync(join(pkg, 'unicode.json'), 'utf8'));
  const { version } = JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8'));
  const dir = `${f.slug}/${version}`;
  const out = join('public/fonts', dir);
  mkdirSync(out, { recursive: true });
  cpSync(join(pkg, 'LICENSE'), join('public/fonts', f.slug, 'LICENSE.txt'));
  const faces = [];
  for (const subset of SUBSETS)
    for (const weight of WEIGHTS)
      for (const style of STYLES) {
        const file = `${f.slug}-${subset}-${weight}-${style}.woff2`;
        if (!existsSync(join(pkg, 'files', file))) continue;
        cpSync(join(pkg, 'files', file), join(out, file));
        faces.push({ file: `${dir}/${file}`, weight, style, range: ranges[subset] });
      }
  manifest[f.id] = { family: f.family, slug: f.slug, faces };
}
writeFileSync('src/render/font-manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log('fonts vendored:', FONTS.map((f) => f.slug).join(', '));
