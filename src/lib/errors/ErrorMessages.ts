import { ProblemError } from '../http/ProblemError';

export type MessageCatalog = Readonly<Record<string, string>>;

/**
 * Maps server error codes to user-facing text. The core registers shared codes, each feature
 * registers its own catalog. Unknown codes fall back by HTTP status.
 */
export class ErrorMessages {
  readonly #messages = new Map<string, string>();

  constructor(
    private readonly byStatus: Readonly<Record<number, string>>,
    private readonly unknown: string,
  ) {}

  register(catalog: MessageCatalog): this {
    for (const [code, text] of Object.entries(catalog)) this.#messages.set(code, text);
    return this;
  }

  text(error: unknown): string {
    if (!(error instanceof ProblemError)) return error instanceof Error ? error.message : this.unknown;
    const text = this.#messages.get(error.code) ?? this.byStatus[error.status] ?? `${this.unknown} (${error.code})`;
    return error.correlationId && error.status >= 500 ? `${text} Ref: ${error.correlationId}` : text;
  }
}
