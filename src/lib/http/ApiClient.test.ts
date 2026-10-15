import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from './ApiClient';
import { ProblemError } from './ProblemError';
import type { Transport } from './Transport';

function transport(send: Transport['send'], upload: Transport['upload'] = vi.fn()): Transport {
  return { send, upload, url: (path) => `https://api.test${path}` };
}

const stepUpRequired = new ProblemError(403, ProblemError.STEP_UP_REQUIRED);

describe('ApiClient', () => {
  it('asks for a step-up once and retries once', async () => {
    const send = vi.fn<Transport['send']>().mockRejectedValueOnce(stepUpRequired).mockResolvedValueOnce('done');
    const stepUp = vi.fn().mockResolvedValue(true);
    expect(await new ApiClient(transport(send), stepUp).post('/x')).toBe('done');
    expect(stepUp).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('does not loop when the retry needs a step-up again', async () => {
    const send = vi.fn<Transport['send']>().mockRejectedValue(stepUpRequired);
    await expect(new ApiClient(transport(send), async () => true).post('/x')).rejects.toBe(stepUpRequired);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('gives up when the user cancels, and leaves other errors alone', async () => {
    const cancelled = vi.fn<Transport['send']>().mockRejectedValue(stepUpRequired);
    await expect(new ApiClient(transport(cancelled), async () => false).post('/x')).rejects.toBe(stepUpRequired);
    expect(cancelled).toHaveBeenCalledOnce();

    const other = new ProblemError(404, 'x.not-found');
    const stepUp = vi.fn();
    await expect(new ApiClient(transport(vi.fn().mockRejectedValue(other)), stepUp).get('/x')).rejects.toBe(other);
    expect(stepUp).not.toHaveBeenCalled();
  });

  it('retries an upload after a step-up and passes progress through', async () => {
    const upload = vi.fn<Transport['upload']>().mockRejectedValueOnce(stepUpRequired).mockResolvedValueOnce({ id: 'f1' });
    const client = new ApiClient(transport(vi.fn(), upload), async () => true);
    const progress = vi.fn();
    expect(await client.upload('/folders/1/files', new FormData(), progress, { tag: ['a', 'b'] })).toEqual({ id: 'f1' });
    expect(upload).toHaveBeenCalledTimes(2);
    expect(upload.mock.calls[0][0]).toBe('/folders/1/files?tag=a&tag=b');
    expect(upload.mock.calls[0][2]).toBe(progress);
  });

  it('encodes query parameters and skips empty ones', () => {
    expect(ApiClient.withQuery('/a', { from: '2026-01-01T00:00:00Z', teamId: null, all: true })).toBe(
      '/a?from=2026-01-01T00%3A00%3A00Z&all=true',
    );
    expect(ApiClient.withQuery('/a', { teamId: undefined })).toBe('/a');
    expect(ApiClient.withQuery('/a', { tag: ['x', null, 'y'] })).toBe('/a?tag=x&tag=y');
  });
});
