/** Typed channel tokens: the token carries the payload type, so publish, subscribe and request are checked by the compiler. */
export interface EventChannel<T> {
  readonly path: string;
  /** Type marker only; never set. */
  readonly payload?: T;
}

export interface RequestChannel<Req, Res> {
  readonly path: string;
  readonly request?: Req;
  readonly response?: Res;
}

export function defineEvent<T = void>(path: string): EventChannel<T> {
  return { path };
}

export function defineRequest<Req, Res>(path: string): RequestChannel<Req, Res> {
  return { path };
}
