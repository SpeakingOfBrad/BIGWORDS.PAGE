import { defineConfig } from 'vitest/config';
import docsPlugin from './vite-plugin-docs.ts';

export default defineConfig({
  plugins: [docsPlugin()],
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
  },
});
