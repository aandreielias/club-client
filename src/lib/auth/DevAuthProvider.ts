import type { LocalStore } from '../storage/LocalStore';
import type { AuthProvider, AuthSession, TotpEnrollment } from './AuthProvider';

/**
 * Offline login for mock mode: any password is accepted and the token is `dev:<email>`, which the
 * mock server resolves to a seeded member. The authenticator app is simulated: any 6-digit code counts,
 * and the token then carries `#totp=<epoch s>` like the `amr` claim of a real token. Never used with the real server.
 */
export class DevAuthProvider implements AuthProvider {
  static readonly TOKEN_PREFIX = 'dev:';
  private static readonly TOTP_MARK = '#totp=';
  private static readonly KEY = 'dev-session';
  private static readonly TOTP_KEY = 'dev-totp';

  #session: AuthSession | null;
  #totpAt: number | null = null;

  constructor(private readonly store: LocalStore) {
    this.#session = store.get<AuthSession>(DevAuthProvider.KEY);
  }

  async init() {
    return { session: this.#session, needsPassword: false };
  }

  async signIn(email: string): Promise<AuthSession> {
    this.#session = { email: email.trim().toLowerCase() };
    this.#totpAt = null;
    this.store.set(DevAuthProvider.KEY, this.#session);
    return this.#session;
  }

  async signOut(): Promise<void> {
    this.#session = null;
    this.#totpAt = null;
    this.store.remove(DevAuthProvider.KEY);
  }

  async resetPassword(): Promise<void> {}

  async updatePassword(): Promise<void> {}

  async token(): Promise<string | null> {
    if (!this.#session) return null;
    return DevAuthProvider.TOKEN_PREFIX + this.#session.email + (this.#totpAt ? DevAuthProvider.TOTP_MARK + this.#totpAt : '');
  }

  async totpFactor(): Promise<string | null> {
    return this.#factors()[this.#email()] ?? null;
  }

  async enrollTotp(): Promise<TotpEnrollment> {
    return { factorId: `dev-factor-${this.#email()}`, qrCode: null, secret: 'DEVSECRETDEVSECRET' };
  }

  async verifyTotp(factorId: string, code: string): Promise<void> {
    if (!/^\d{6}$/.test(code)) throw new Error('Der Code stimmt nicht. Nimm den aktuellen Code aus der App.');
    this.store.set(DevAuthProvider.TOTP_KEY, { ...this.#factors(), [this.#email()]: factorId });
    this.#totpAt = Math.floor(Date.now() / 1000);
  }

  #email(): string {
    if (!this.#session) throw new Error('Nicht angemeldet.');
    return this.#session.email;
  }

  #factors(): Record<string, string> {
    return this.store.get<Record<string, string>>(DevAuthProvider.TOTP_KEY) ?? {};
  }

  static emailFromToken(token: string | null): string | null {
    if (!token?.startsWith(DevAuthProvider.TOKEN_PREFIX)) return null;
    return token.slice(DevAuthProvider.TOKEN_PREFIX.length).split(DevAuthProvider.TOTP_MARK)[0];
  }

  /** Epoch seconds of the last simulated authenticator-app check in the token; null when none. */
  static totpAtFromToken(token: string | null): number | null {
    const mark = token?.indexOf(DevAuthProvider.TOTP_MARK) ?? -1;
    return token && mark >= 0 ? Number(token.slice(mark + DevAuthProvider.TOTP_MARK.length)) : null;
  }
}
