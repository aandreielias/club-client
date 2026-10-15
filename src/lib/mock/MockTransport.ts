import { DevAuthProvider } from '../auth/DevAuthProvider';
import type { HttpMethod, ProgressListener, TokenSource, Transport } from '../http/Transport';
import type { MockServer } from './MockServer';

/** Transport that answers from the MockServer with a small delay, like a network round trip. */
export class MockTransport implements Transport {
  constructor(
    private readonly server: MockServer,
    private readonly token: TokenSource,
    private readonly latencyMs: number,
    private readonly origin: string,
  ) {}

  async send(method: HttpMethod, path: string, body?: unknown): Promise<unknown> {
    await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    // JSON round trip like the real wire: no shared references, no Svelte proxies in the tables.
    const wire = body === undefined || body instanceof FormData ? body : JSON.parse(JSON.stringify(body));
    const email = DevAuthProvider.emailFromToken(await this.token());
    const result = await this.server.handle(method, path, wire, email);
    return result === undefined ? undefined : structuredClone(result);
  }

  async upload(path: string, form: FormData, onProgress?: ProgressListener): Promise<unknown> {
    const email = DevAuthProvider.emailFromToken(await this.token());
    const report = (loaded: number, total: number) => onProgress?.({ loaded, total });
    const result = await this.server.handle('POST', path, form, email, report);
    return result === undefined ? undefined : structuredClone(result);
  }

  url(path: string): string {
    return this.origin + path;
  }
}
