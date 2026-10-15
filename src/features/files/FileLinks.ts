import type { FilesApi } from './FilesApi';

/**
 * Caches short-lived download links per file and variant, so a photo grid does not ask the server
 * again on every render. A link is reused until `marginMs` before it expires; parallel requests
 * for the same file share one call.
 */
export class FileLinks {
  readonly #cache = new Map<string, Promise<{ url: string; expiresAt: number }>>();

  constructor(
    private readonly api: FilesApi,
    private readonly marginMs: number,
  ) {}

  async url(fileId: string, thumbnail = false): Promise<string> {
    const key = `${fileId}:${thumbnail}`;
    const cached = this.#cache.get(key);
    if (cached) {
      const link = await cached.catch(() => null);
      if (link && link.expiresAt - this.marginMs > Date.now()) return link.url;
    }
    const pending = this.api.link(fileId, thumbnail).then((l) => ({ url: l.url, expiresAt: Date.parse(l.expiresAt) }));
    this.#cache.set(key, pending);
    pending.catch(() => this.#cache.delete(key));
    return (await pending).url;
  }

  forget(fileId: string): void {
    this.#cache.delete(`${fileId}:true`);
    this.#cache.delete(`${fileId}:false`);
  }
}
