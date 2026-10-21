/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const MAP_TILES = 'https://tiles.openfreemap.org';

/**
 * Content Security Policy as a meta tag (GitHub Pages sends no headers), built only: the dev server needs its own
 * HMR socket and inline helpers. API, Supabase (auth + file links) and map tiles are the only other origins.
 */
function csp(env: Record<string, string>): Plugin {
  const api = env.VITE_API_URL ?? '';
  const supabase = env.VITE_SUPABASE_URL ?? '';
  const connect = ["'self'", api, api.replace(/^http/, 'ws'), supabase, MAP_TILES].filter(Boolean).join(' ');
  const images = ["'self'", 'blob:', 'data:', supabase, MAP_TILES].filter(Boolean).join(' ');
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    // ThemeService writes a <style> tag and Svelte sets style attributes.
    "style-src 'self' 'unsafe-inline'",
    `img-src ${images}`,
    "font-src 'self' data:",
    `connect-src ${connect}`,
    "worker-src 'self' blob:",
    "frame-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  return {
    name: 'club-csp',
    apply: 'build',
    transformIndexHtml: (html) => html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`),
  };
}

// Relative base: the same build works under GitHub Pages' /<repo>/ path and at a domain root.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [svelte(), csp(loadEnv(mode, '.', 'VITE_'))],
  // MapLibre's worker is a module (src/ui/LocationMap.svelte loads it by URL).
  worker: { format: 'es' },
  test: { include: ['src/**/*.test.ts'] },
}));
