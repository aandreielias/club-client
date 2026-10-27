import { describe, expect, it } from 'vitest';
import serverCodes from './lib/api/error-codes.json';
import { CORE_MESSAGES } from './lib/errors/coreMessages';
import type { MessageCatalog } from './lib/errors/ErrorMessages';

// Every code the server can answer, from its snapshot (club-server/docs/api/error-codes.json, copied by `npm run api:sync`).
const catalogs = import.meta.glob('./**/messages.ts', { eager: true }) as Record<string, Record<string, MessageCatalog>>;

/** Error codes the client never sees: internal channels, the HTTP gateway's own mapping, or framework checks. */
const NOT_SHOWN = new Set<string>([]);

describe('server error codes', () => {
  it('each has a message on the client', () => {
    const known = new Set([CORE_MESSAGES, ...Object.values(catalogs).flatMap((m) => Object.values(m))].flatMap((c) => Object.keys(c)));
    expect(serverCodes.length).toBeGreaterThan(50);
    expect(serverCodes.filter((c) => !known.has(c) && !NOT_SHOWN.has(c)).sort()).toEqual([]);
  });
});
