import { ProblemError } from './ProblemError';
import type { HttpMethod, ProgressListener, Transport } from './Transport';

/** Asks the user to confirm (PIN); resolves true when the step-up succeeded. */
export type StepUpHandler = () => Promise<boolean>;

type QueryValue = string | number | boolean | null | undefined;

/** Arrays become repeated parameters (`tag=a&tag=b`). */
export type QueryParams = Record<string, QueryValue | readonly QueryValue[]>;

/**
 * Typed entry point for every server call. On `auth.step-up-required` it asks for a step-up once
 * and retries the request once; every other failure propagates as ProblemError.
 */
export class ApiClient {
  constructor(
    private readonly transport: Transport,
    private readonly stepUp: StepUpHandler,
  ) {}

  get<T>(path: string, query?: QueryParams): Promise<T> {
    return this.request<T>('GET', ApiClient.withQuery(path, query));
  }

  post<T>(path: string, body?: unknown, query?: QueryParams): Promise<T> {
    return this.request<T>('POST', ApiClient.withQuery(path, query), body);
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  delete<T = void>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  /** Multipart upload with progress; a step-up retry starts the upload again. */
  upload<T>(path: string, form: FormData, onProgress?: ProgressListener, query?: QueryParams): Promise<T> {
    const target = ApiClient.withQuery(path, query);
    return this.withStepUp(() => this.transport.upload(target, form, onProgress)) as Promise<T>;
  }

  /** Absolute URL of a server path (for links given to other apps). */
  url(path: string): string {
    return this.transport.url(path);
  }

  static withQuery(path: string, query?: QueryParams): string {
    if (!query) return path;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      const values = Array.isArray(value) ? value : [value];
      for (const item of values) if (item !== null && item !== undefined) params.append(key, String(item));
    }
    const search = params.toString();
    return search ? `${path}?${search}` : path;
  }

  private request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
    return this.withStepUp(() => this.transport.send(method, path, body)) as Promise<T>;
  }

  private async withStepUp(call: () => Promise<unknown>): Promise<unknown> {
    try {
      return await call();
    } catch (error) {
      if (error instanceof ProblemError && error.isStepUpRequired && (await this.stepUp())) return call();
      throw error;
    }
  }
}
