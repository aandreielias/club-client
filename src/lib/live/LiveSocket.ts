/** The part of the browser WebSocket API that LiveUpdates uses, so tests and the mock can stand in. */
export interface LiveSocket {
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

/** Opens a new socket; may load code first (mock mode). */
export type SocketFactory = () => Promise<LiveSocket>;

/** Browser WebSocket to club-server; `http(s)://api` becomes `ws(s)://api/ws`. */
export function webSocketFactory(apiUrl: string, path: string): SocketFactory {
  const url = apiUrl.replace(/^http/, 'ws') + path;
  return async () => new WebSocket(url);
}
