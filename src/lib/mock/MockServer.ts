import type { HttpMethod } from '../http/Transport';
import { ProblemError } from '../http/ProblemError';
import { Router, type RouteParams } from '../router/Router.svelte';
import { MockEventBus } from './MockEventBus';

export interface MockRequest {
  params: RouteParams;
  query: URLSearchParams;
  /** JSON-copied request body (FormData passes through). */
  body: any;
  /** Upload progress reporting for multipart handlers. */
  onProgress?: (loaded: number, total: number) => void;
  /** E-mail of the signed-in dev user, null when signed out. */
  email: string | null;
  /** Epoch seconds of the token's last authenticator-app check (`DevAuthProvider`), like the JWT `amr`. */
  totpAt?: number | null;
  method?: HttpMethod;
  path?: string;
}

/** May return a promise (e.g. handlers that read uploaded files). */
export type MockHandler = (request: MockRequest) => unknown;

interface MockRoute {
  method: HttpMethod;
  pattern: string;
  handler: MockHandler;
}

/** In-browser stand-in for club-server. Mock modules register endpoints with `on`. */
export class MockServer {
  /** Domain events between mock modules and towards live connections. */
  readonly events = new MockEventBus();

  readonly #routes: MockRoute[] = [];

  on(method: HttpMethod, pattern: string, handler: MockHandler): this {
    this.#routes.push({ method, pattern, handler });
    return this;
  }

  handle(method: HttpMethod, path: string, body: unknown, email: string | null, onProgress?: MockRequest['onProgress'], totpAt: number | null = null): unknown {
    const url = new URL(path, 'http://mock');
    for (const route of this.#routes) {
      if (route.method !== method) continue;
      const params = Router.match(route.pattern, url.pathname);
      if (params) return route.handler({ params, query: url.searchParams, body, email, onProgress, totpAt, method, path: url.pathname });
    }
    return MockServer.fail(404, 'not-found');
  }

  /** Throws the problem answer the real server would send. */
  static fail(status: number, code: string): never {
    throw new ProblemError(status, code, 'mock');
  }
}

export const mockServer = new MockServer();
