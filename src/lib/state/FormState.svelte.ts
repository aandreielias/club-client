/**
 * Validation state shared by the forms: `errors` follows the fields live, but a field shows its error only
 * after the first submit (`submitted`). Subclasses implement `validate`; `E` maps field → message.
 */
export abstract class FormState<E extends { [K in keyof E]?: string }> {
  submitted = $state(false);
  readonly errors: E = $derived(this.validate());
  readonly valid: boolean = $derived(Object.keys(this.errors).length === 0);

  error(field: keyof E): string | null {
    return this.submitted ? (this.errors[field] ?? null) : null;
  }

  protected abstract validate(): E;
}
