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
  /** Rejects with ProblemError for every failure. */
  send(method: HttpMethod, path: string, body?: unknown): Promise<unknown>;
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

  async send(method: HttpMethod, path: string, body?: unknown): Promise<unknown> {
    this.#transport ??= this.load();
    return (await this.#transport).send(method, path, body);
  }

  async upload(path: string, form: FormData, onProgress?: ProgressListener): Promise<unknown> {
    this.#transport ??= this.load();
    return (await this.#transport).upload(path, form, onProgress);
  }

  url(path: string): string {
    return this.origin + path;
  }
}
