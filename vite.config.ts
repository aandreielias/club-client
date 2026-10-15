/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Relative base: the same build works under GitHub Pages' /<repo>/ path and at a domain root.
export default defineConfig({
  base: './',
  plugins: [svelte()],
  test: { include: ['src/**/*.test.ts'] },
});
