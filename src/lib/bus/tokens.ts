/**
 * Typed channel tokens, the TypeScript stand-in for the Java `Class<T>` arguments: the token carries
 * the payload type, so publish, subscribe and request are checked by the compiler.
 */
export interface EventChannel<T> {
  readonly kind: 'event';
  readonly path: string;
  /** Type marker only; never set. */
  readonly payload?: T;
}

export interface RequestChannel<Req, Res> {
  readonly kind: 'request';
  readonly path: string;
  /** Overrides the bus default; 0 waits forever (e.g. a dialog the user answers). */
  readonly timeoutMs?: number;
  readonly request?: Req;
  readonly response?: Res;
}

export function defineEvent<T = void>(path: string): EventChannel<T> {
  return { kind: 'event', path };
}

export function defineRequest<Req, Res>(path: string, options: { timeoutMs?: number } = {}): RequestChannel<Req, Res> {
  return { kind: 'request', path, ...options };
}
