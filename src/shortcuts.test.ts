import { describe, expect, it } from 'vitest';
import { SHORTCUTS } from './shortcuts';

const features = import.meta.glob('./features/*/feature.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

describe('navigation shortcuts', () => {
  it('reach every page of the sidebar', () => {
    const navPaths = Object.values(features).flatMap((source) => [...source.matchAll(/path: '([^']+)'[^}\n]*\bnav: '/g)].map((m) => m[1]));
    const reachable = new Set<string | null>(Object.values(SHORTCUTS).map((s) => ('path' in s ? s.path : null)));
    expect(navPaths.length).toBeGreaterThan(10);
    expect(navPaths.filter((path) => !reachable.has(path))).toEqual([]);
  });
});
