import type { AuthProvider, AuthSession, TotpEnrollment } from './AuthProvider';

/** Reactive login state on top of an AuthProvider. */
export class AuthService {
  ready = $state(false);
  session = $state<AuthSession | null>(null);

  constructor(private readonly provider: AuthProvider) {}

  get signedIn(): boolean {
    return this.session !== null;
  }

  /** Restores the session; true when the user arrived from an invite/recovery link. */
  async init(): Promise<boolean> {
    const { session, needsPassword } = await this.provider.init();
    this.session = session;
    this.ready = true;
    return needsPassword;
  }

  async signIn(email: string, password: string): Promise<void> {
    this.session = await this.provider.signIn(email, password);
  }

  async signOut(): Promise<void> {
    await this.provider.signOut();
    this.session = null;
  }

  resetPassword(email: string): Promise<void> {
    return this.provider.resetPassword(email);
  }

  updatePassword(password: string): Promise<void> {
    return this.provider.updatePassword(password);
  }

  /** Confirms the current password by signing in again, then sets the new one. */
  async changePassword(current: string, next: string): Promise<void> {
    const email = this.session?.email;
    if (!email) throw new Error('Nicht angemeldet.');
    await this.provider.signIn(email, current);
    await this.provider.updatePassword(next);
  }

  readonly token = (): Promise<string | null> => this.provider.token();

  totpFactor(): Promise<string | null> {
    return this.provider.totpFactor();
  }

  enrollTotp(): Promise<TotpEnrollment> {
    return this.provider.enrollTotp();
  }

  verifyTotp(factorId: string, code: string): Promise<void> {
    return this.provider.verifyTotp(factorId, code);
  }
}
