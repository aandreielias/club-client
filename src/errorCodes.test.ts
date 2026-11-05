import { describe, expect, it } from 'vitest';
import serverCodes from './lib/api/error-codes.json';
import { CORE_MESSAGES } from './lib/errors/coreMessages';
import type { MessageCatalog } from './lib/errors/ErrorMessages';

// Every code the server can answer: club-server/docs/api/error-codes.json (kept by hand there, copied by `npm run api:sync`).
const catalogs = import.meta.glob('./**/messages.ts', { eager: true }) as Record<string, Record<string, MessageCatalog>>;
const mocks = import.meta.glob(['./**/mock*.ts', '!./**/*.test.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** Server codes the client never shows. */
const NOT_SHOWN = new Set<string>([]);
/** Codes the client makes itself (HttpTransport), not the server. */
const CLIENT_ONLY = new Set(['network', 'timeout']);

const known = new Set([CORE_MESSAGES, ...Object.values(catalogs).flatMap((m) => Object.values(m))].flatMap((c) => Object.keys(c)));
const server = new Set<string>(serverCodes);

describe('server error codes', () => {
  it('each has a message on the client', () => {
    expect(serverCodes.length).toBeGreaterThan(50);
    expect(serverCodes.filter((c) => !known.has(c) && !NOT_SHOWN.has(c)).sort()).toEqual([]);
  });

  it('are the only codes the client has messages for', () => {
    expect([...known].filter((c) => !server.has(c) && !CLIENT_ONLY.has(c)).sort()).toEqual([]);
  });

  it('are the only codes the mock server answers with', () => {
    const used = Object.values(mocks).flatMap((source) => [...source.matchAll(/fail\(\s*\d+\s*,\s*'([^']+)'/g)].map((m) => m[1]));
    expect(used.length).toBeGreaterThan(50);
    expect([...new Set(used)].filter((c) => !server.has(c)).sort()).toEqual([]);
  });
});
