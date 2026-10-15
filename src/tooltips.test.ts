import { describe, expect, it } from 'vitest';
import { BUTTON_TOOLTIPS } from './tooltips';

/** Label props whose possible values are known: they must be in the catalog too. */
const PROP_LABELS: Record<string, string[]> = { '{submitLabel}': ['Anlegen', 'Speichern'] };

const sources = import.meta.glob('./**/*.svelte', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

describe('button tooltips', () => {
  it('cover every static Button label or come with their own tooltip', () => {
    const missing: string[] = [];
    for (const [file, source] of Object.entries(sources)) {
      for (const match of source.matchAll(/<Button\b((?:[^>{]|\{[^}]*\})*)>(.*?)<\/Button>/gs)) {
        const [, attributes, body] = match;
        if (/\btooltip=/.test(attributes)) continue;
        const label = body.replace(/\s+/g, ' ').trim();
        // Dynamic labels: every value they can take must be in the catalog.
        const quoted = [...label.matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((value) => /^\p{Lu}/u.test(value));
        const labels = PROP_LABELS[label] ?? (label.includes('{') ? quoted : [label]);
        if (!labels.length) missing.push(`${file}: ${label}`);
        for (const value of labels) if (!BUTTON_TOOLTIPS[value]) missing.push(`${file}: ${value}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('are attached to every plain button element', () => {
    const missing: string[] = [];
    for (const [file, source] of Object.entries(sources)) {
      if (file.endsWith('ui/Button.svelte')) continue;
      for (const match of source.matchAll(/<button\b((?:[^>{]|\{(?:[^{}]|\{[^}]*\})*\})*)>/gs)) {
        if (!match[1].includes('@attach tooltip')) missing.push(`${file}: ${match[0].slice(0, 60)}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
