export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Supplies the current access token; null when signed out. */
export type TokenSource = () => Promise<string | null>;

export interface UploadProgress {
  loaded: number;
  total: number;
}

export type ProgressListener = (progress: UploadProgress) => void;

/** Moves one request to a backend (real server or in-browser mock) and returns the parsed body. */
export interface Transport {
  /** Rejects with ProblemError for every failure. The same `idempotencyKey` on a retry makes the server answer it once. */
  send(method: HttpMethod, path: string, body?: unknown, idempotencyKey?: string): Promise<unknown>;
  /** Multipart POST with upload progress (fetch cannot report it). Rejects with ProblemError. */
  upload(path: string, form: FormData, onProgress?: ProgressListener): Promise<unknown>;
  /** Absolute URL of a server path, e.g. for links handed to other apps. */
  url(path: string): string;
}

/** Defers creating the real transport (and loading its code) until the first request. */
export class LazyTransport implements Transport {
  #transport: Promise<Transport> | null = null;

  constructor(
    private readonly load: () => Promise<Transport>,
    private readonly origin: string,
  ) {}

  async send(method: HttpMethod, path: string, body?: unknown, idempotencyKey?: string): Promise<unknown> {
    return (await this.transport()).send(method, path, body, idempotencyKey);
  }

  async upload(path: string, form: FormData, onProgress?: ProgressListener): Promise<unknown> {
    return (await this.transport()).upload(path, form, onProgress);
  }

  /** A failed load (e.g. chunk not reachable) is tried again on the next request. */
  private transport(): Promise<Transport> {
    this.#transport ??= this.load().catch((error) => {
      this.#transport = null;
      throw error;
    });
    return this.#transport;
  }

  url(path: string): string {
    return this.origin + path;
  }
}
