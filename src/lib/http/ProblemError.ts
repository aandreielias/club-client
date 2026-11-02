/** RFC 9457 answer of club-server, reduced to what the client needs. */
export class ProblemError extends Error {
  static readonly NETWORK = 'network';

  constructor(
    readonly status: number,
    readonly code: string,
    readonly correlationId: string | null = null,
  ) {
    super(code);
    this.name = 'ProblemError';
  }

  static network(): ProblemError {
    return new ProblemError(0, ProblemError.NETWORK);
  }
}
