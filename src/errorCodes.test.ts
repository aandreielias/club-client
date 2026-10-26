import { describe, expect, it } from 'vitest';
import { CORE_MESSAGES } from './lib/errors/coreMessages';
import type { MessageCatalog } from './lib/errors/ErrorMessages';

// The server repo sits next to this one; without it the check has nothing to compare and is skipped.
const server = import.meta.glob('../../club-server/src/main/java/**/*.java', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const catalogs = import.meta.glob('./**/messages.ts', { eager: true }) as Record<string, Record<string, MessageCatalog>>;

/** Error codes the client never sees: internal channels, the HTTP gateway's own mapping, or framework checks. */
const NOT_SHOWN = new Set<string>([]);

describe('server error codes', () => {
  it.skipIf(Object.keys(server).length === 0)('each has a message on the client', () => {
    const known = new Set([CORE_MESSAGES, ...Object.values(catalogs).flatMap((m) => Object.values(m))].flatMap((c) => Object.keys(c)));
    const codes = new Set<string>();
    for (const source of Object.values(server)) {
      for (const match of source.matchAll(/"([a-z][a-z-]*\.[a-z][a-z0-9-]*)"/g)) {
        if (/(DomainException|invalid|conflict|notFound|forbidden)\([^;]*$/.test(source.slice(Math.max(0, match.index - 200), match.index))) codes.add(match[1]);
      }
    }
    expect(codes.size).toBeGreaterThan(50);
    expect([...codes].filter((c) => !known.has(c) && !NOT_SHOWN.has(c)).sort()).toEqual([]);
  });
});
