import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from './ApiClient';
import { ProblemError } from './ProblemError';
import type { Transport } from './Transport';

function transport(send: Transport['send'], upload: Transport['upload'] = vi.fn()): Transport {
  return { send, upload, url: (path) => `https://api.test${path}` };
}

describe('ApiClient', () => {
  it('keeps one idempotency key across a network retry', async () => {
    const send = vi.fn<Transport['send']>().mockRejectedValueOnce(ProblemError.network()).mockResolvedValueOnce('done');
    expect(await new ApiClient(transport(send)).post('/x')).toBe('done');
    const keys = send.mock.calls.map((call) => call[3]);
    expect(keys).toHaveLength(2);
    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toMatch(/^[A-Za-z0-9_-]{8,100}$/);
  });

  it('retries a server outage once, but not a server bug', async () => {
    const outage = vi.fn<Transport['send']>().mockRejectedValueOnce(new ProblemError(503, 'unavailable')).mockResolvedValueOnce('ok');
    expect(await new ApiClient(transport(outage)).get('/x')).toBe('ok');
    const bug = vi.fn<Transport['send']>().mockRejectedValue(new ProblemError(500, 'internal'));
    await expect(new ApiClient(transport(bug)).get('/x')).rejects.toMatchObject({ status: 500 });
    expect(bug).toHaveBeenCalledOnce();
  });

  it('reports 401 so the session ends', async () => {
    const unauthorized = vi.fn();
    const send = vi.fn<Transport['send']>().mockRejectedValue(new ProblemError(401, 'http.401'));
    await expect(new ApiClient(transport(send), unauthorized).get('/x')).rejects.toMatchObject({ status: 401 });
    expect(unauthorized).toHaveBeenCalledOnce();
  });

  it('leaves other errors alone', async () => {
    const other = new ProblemError(404, 'x.not-found');
    const send = vi.fn().mockRejectedValue(other);
    await expect(new ApiClient(transport(send)).get('/x')).rejects.toBe(other);
    expect(send).toHaveBeenCalledOnce();
  });

  it('uploads with query parameters and passes progress through', async () => {
    const upload = vi.fn<Transport['upload']>().mockResolvedValueOnce({ id: 'f1' });
    const client = new ApiClient(transport(vi.fn(), upload));
    const progress = vi.fn();
    expect(await client.upload('/folders/1/files', new FormData(), progress, { tag: ['a', 'b'] })).toEqual({ id: 'f1' });
    expect(upload).toHaveBeenCalledOnce();
    expect(upload.mock.calls[0][0]).toBe('/folders/1/files?tag=a&tag=b');
    expect(upload.mock.calls[0][2]).toBe(progress);
  });

  it('encodes query parameters and skips empty ones', () => {
    expect(ApiClient.withQuery('/a', { from: '2026-01-01T00:00:00Z', teamId: null, all: true })).toBe('/a?from=2026-01-01T00%3A00%3A00Z&all=true');
    expect(ApiClient.withQuery('/a', { teamId: undefined })).toBe('/a');
    expect(ApiClient.withQuery('/a', { tag: ['x', null, 'y'] })).toBe('/a?tag=x&tag=y');
  });
});
