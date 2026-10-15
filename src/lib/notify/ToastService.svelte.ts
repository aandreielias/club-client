export interface Toast {
  id: number;
  text: string;
  error: boolean;
}

/** Short, self-dismissing status messages. */
export class ToastService {
  items = $state<Toast[]>([]);

  #next = 0;

  constructor(
    private readonly durationMs: number,
    private readonly errorDurationMs: number,
  ) {}

  show(text: string): void {
    this.push(text, false, this.durationMs);
  }

  error(text: string): void {
    this.push(text, true, this.errorDurationMs);
  }

  dismiss(id: number): void {
    const index = this.items.findIndex((t) => t.id === id);
    if (index >= 0) this.items.splice(index, 1);
  }

  private push(text: string, error: boolean, durationMs: number): void {
    const id = this.#next++;
    this.items.push({ id, text, error });
    setTimeout(() => this.dismiss(id), durationMs);
  }
}
