import { ProblemError } from './ProblemError';
import type { HttpMethod, ProgressListener, TokenSource, Transport } from './Transport';

/** fetch-based transport for club-server: bearer token, JSON, idempotency keys, problem answers. */
export class HttpTransport implements Transport {
  static readonly IDEMPOTENCY_HEADER = 'Idempotency-Key';
  static readonly CORRELATION_HEADER = 'X-Correlation-Id';

  constructor(
    private readonly baseUrl: string,
    private readonly token: TokenSource,
  ) {}

  async send(method: HttpMethod, path: string, body?: unknown, idempotencyKey?: string): Promise<unknown> {
    const headers = await this.headers();
    if (idempotencyKey) headers[HttpTransport.IDEMPOTENCY_HEADER] = idempotencyKey;
    const response = await this.fetch(method, path, headers, body);
    let data: any;
    try {
      data = response.headers.get('Content-Type')?.includes('json') ? await response.json() : undefined;
    } catch {
      // A broken body (proxy error page, cut connection) is a failure like any other, never a raw SyntaxError.
      if (response.ok) throw new ProblemError(502, 'internal', response.headers.get(HttpTransport.CORRELATION_HEADER));
    }
    if (!response.ok) {
      throw new ProblemError(
        response.status,
        data?.code ?? `http.${response.status}`,
        data?.correlationId ?? response.headers.get(HttpTransport.CORRELATION_HEADER),
      );
    }
    return data;
  }

  async upload(path: string, form: FormData, onProgress?: ProgressListener): Promise<unknown> {
    // No idempotency key: the server does not buffer multipart bodies, so it would not apply.
    const headers = await this.headers();
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', this.url(path));
      for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
      xhr.upload.onprogress = (event) => onProgress?.({ loaded: event.loaded, total: event.lengthComputable ? event.total : 0 });
      xhr.onerror = () => reject(ProblemError.network());
      xhr.onload = () => {
        const isJson = xhr.getResponseHeader('Content-Type')?.includes('json');
        let data: any;
        try {
          data = isJson && xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
        } catch {
          data = undefined;
        }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else {
          reject(
            new ProblemError(
              xhr.status,
              data?.code ?? `http.${xhr.status}`,
              data?.correlationId ?? xhr.getResponseHeader(HttpTransport.CORRELATION_HEADER),
            ),
          );
        }
      };
      xhr.send(form);
    });
  }

  url(path: string): string {
    return this.baseUrl + path;
  }

  private async headers(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};
    const token = await this.token();
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  private async fetch(method: HttpMethod, path: string, headers: Record<string, string>, body: unknown): Promise<Response> {
    let payload: BodyInit | undefined;
    if (body instanceof FormData) {
      payload = body;
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    try {
      // keepalive: a delete sent while the page unloads (pending deletes) still reaches the server.
      return await fetch(this.url(path), { method, headers, body: payload, keepalive: method === 'DELETE' });
    } catch {
      throw ProblemError.network();
    }
  }
}
