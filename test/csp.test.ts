import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DISPLAY_GUARD_HASH } from '../vite-plugin-docs';

describe('Content-Security-Policy', () => {
  it('allows the inline display guard in index.html by its hash', () => {
    const caddyfile = readFileSync(resolve(import.meta.dirname, '../Caddyfile'), 'utf8');
    const scriptSrc = caddyfile.match(/script-src [^;"]*/)?.[0] ?? '';
    expect(scriptSrc.split(' ')).toContain(DISPLAY_GUARD_HASH);
  });
});
