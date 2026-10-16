/** No request handler is registered on the channel. */
export class NoResponderError extends Error {
  override name = 'NoResponderError';
  constructor(readonly channel: string) {
    super(`No responder on "${channel}".`);
  }
}

export class RequestTimeoutError extends Error {
  override name = 'RequestTimeoutError';
  constructor(
    readonly channel: string,
    readonly timeoutMs: number,
  ) {
    super(`Request on "${channel}" timed out after ${timeoutMs} ms.`);
  }
}

export class BusClosedError extends Error {
  override name = 'BusClosedError';
  constructor() {
    super('The event bus is closed.');
  }
}
