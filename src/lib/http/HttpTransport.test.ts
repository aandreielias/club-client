import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpTransport } from './HttpTransport';

function stubFetch(...responses: Response[]) {
  const fetch = vi.fn<typeof globalThis.fetch>();
  responses.forEach((response) => fetch.mockResolvedValueOnce(response));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const json = (status: number, body: unknown, type = 'application/json') =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': type } });

const headersOf = (call: Parameters<typeof fetch>) => call[1]!.headers as Record<string, string>;

afterEach(() => vi.unstubAllGlobals());

describe('HttpTransport', () => {
  const transport = new HttpTransport('https://api.test', async () => 'tok');

  it('sends bearer and JSON, and the idempotency key it is given', async () => {
    const fetch = stubFetch(json(200, { ok: 1 }), json(200, {}));
    expect(await transport.send('POST', '/api/v1/x', { a: 1 }, 'key-00000001')).toEqual({ ok: 1 });
    await transport.send('PUT', '/api/v1/x', { a: 1 });

    const post = fetch.mock.calls[0];
    expect(post[0]).toBe('https://api.test/api/v1/x');
    expect(headersOf(post)).toMatchObject({ Authorization: 'Bearer tok', 'Content-Type': 'application/json' });
    expect(headersOf(post)['Idempotency-Key']).toBe('key-00000001');
    expect(post[1]!.body).toBe('{"a":1}');
    expect(headersOf(fetch.mock.calls[1])['Idempotency-Key']).toBeUndefined();
  });

  it('turns a broken success body into ProblemError, not a SyntaxError', async () => {
    stubFetch(new Response('<html>', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await expect(transport.send('GET', '/x')).rejects.toMatchObject({ name: 'ProblemError', code: 'internal' });
  });

  it('turns problem answers into ProblemError', async () => {
    stubFetch(json(404, { status: 404, code: 'task.not-found', correlationId: 'c-1' }, 'application/problem+json'));
    await expect(transport.send('GET', '/x')).rejects.toMatchObject({ status: 404, code: 'task.not-found', correlationId: 'c-1' });
  });

  it('maps non-JSON errors and network failures', async () => {
    stubFetch(new Response('<html>bad gateway</html>', { status: 502, headers: { 'X-Correlation-Id': 'c-2' } }));
    await expect(transport.send('GET', '/x')).rejects.toMatchObject({ status: 502, code: 'http.502', correlationId: 'c-2' });

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(transport.send('GET', '/x')).rejects.toMatchObject({ status: 0, code: 'network' });
  });

  it('builds absolute URLs', () => {
    expect(transport.url('/ical/t.ics')).toBe('https://api.test/ical/t.ics');
  });
});
