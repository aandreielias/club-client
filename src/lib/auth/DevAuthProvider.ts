import type { LocalStore } from '../storage/LocalStore';
import type { AuthProvider, AuthSession } from './AuthProvider';

/**
 * Offline login for mock mode: any password is accepted and the token is `dev:<email>`, which the
 * mock server resolves to a seeded member. Never used with the real server.
 */
export class DevAuthProvider implements AuthProvider {
  static readonly TOKEN_PREFIX = 'dev:';
  private static readonly KEY = 'dev-session';

  #session: AuthSession | null;

  constructor(private readonly store: LocalStore) {
    this.#session = store.get<AuthSession>(DevAuthProvider.KEY);
  }

  async init() {
    return { session: this.#session, needsPassword: false };
  }

  async signIn(email: string): Promise<AuthSession> {
    this.#session = { email: email.trim().toLowerCase() };
    this.store.set(DevAuthProvider.KEY, this.#session);
    return this.#session;
  }

  async signOut(): Promise<void> {
    this.#session = null;
    this.store.remove(DevAuthProvider.KEY);
  }

  async resetPassword(): Promise<void> {}

  async updatePassword(): Promise<void> {}

  async token(): Promise<string | null> {
    return this.#session ? DevAuthProvider.TOKEN_PREFIX + this.#session.email : null;
  }

  static emailFromToken(token: string | null): string | null {
    return token?.startsWith(DevAuthProvider.TOKEN_PREFIX) ? token.slice(DevAuthProvider.TOKEN_PREFIX.length) : null;
  }
}
