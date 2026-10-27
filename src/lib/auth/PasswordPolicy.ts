/** Client-side mirror of the Supabase password policy, so users see problems before submitting. */
export class PasswordPolicy {
  constructor(readonly minLength: number) {}

  /** Readable rule for hints. */
  get description(): string {
    return `Mind. ${this.minLength} Zeichen mit Groß- und Kleinbuchstaben, Ziffer und Sonderzeichen.`;
  }

  accepts(password: string): boolean {
    return (
      password.length >= this.minLength && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password)
    );
  }
}
