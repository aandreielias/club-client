import { GoTrueClient, type AuthError } from '@supabase/auth-js';
import type { AuthInitResult, AuthProvider, AuthSession, TotpEnrollment } from './AuthProvider';

/**
 * Login through Supabase Auth. Invite and recovery links come back with `type=invite|recovery` in the URL
 * (implicit links from the server's invite) or as a PASSWORD_RECOVERY event (PKCE reset mails); both mean
 * the user must choose a password now. The access token is refreshed by `getSession()` before it expires.
 */
export class SupabaseAuthProvider implements AuthProvider {
  readonly #client: GoTrueClient;
  #recovery = false;

  constructor(url: string, publishableKey: string) {
    this.#client = new GoTrueClient({
      url: `${url}/auth/v1`,
      headers: { apikey: publishableKey },
      flowType: 'pkce',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    });
    this.#client.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') this.#recovery = true;
    });
  }

  async init(): Promise<AuthInitResult> {
    // Read before the client consumes the URL.
    const linkType = new URLSearchParams(location.hash.slice(1)).get('type') ?? new URLSearchParams(location.search).get('type');
    const session = await this.#session();
    return { session, needsPassword: session !== null && (this.#recovery || linkType === 'invite' || linkType === 'recovery') };
  }

  async signIn(email: string, password: string): Promise<AuthSession> {
    const { data, error } = await this.#client.signInWithPassword({ email, password });
    check(error);
    return { email: data.user?.email ?? email };
  }

  async signOut(): Promise<void> {
    check((await this.#client.signOut()).error);
  }

  async resetPassword(email: string): Promise<void> {
    // Errors other than rate limits would tell whether the address exists, so they are not shown.
    const { error } = await this.#client.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (error?.status === 429) check(error);
  }

  async updatePassword(password: string): Promise<void> {
    check((await this.#client.updateUser({ password })).error);
    this.#recovery = false;
  }

  async token(): Promise<string | null> {
    const { data, error } = await this.#client.getSession();
    check(error);
    return data.session?.access_token ?? null;
  }

  async totpFactor(): Promise<string | null> {
    const { data, error } = await this.#client.mfa.listFactors();
    check(error);
    return data?.totp[0]?.id ?? null;
  }

  async enrollTotp(): Promise<TotpEnrollment> {
    const factors = await this.#client.mfa.listFactors();
    check(factors.error);
    for (const factor of factors.data?.all ?? []) {
      if (factor.factor_type === 'totp' && factor.status === 'unverified') check((await this.#client.mfa.unenroll({ factorId: factor.id })).error);
    }
    const { data, error } = await this.#client.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator-App' });
    check(error);
    if (!data) throw new Error('Die Authenticator-App konnte nicht eingerichtet werden.');
    return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
  }

  async verifyTotp(factorId: string, code: string): Promise<void> {
    check((await this.#client.mfa.challengeAndVerify({ factorId, code })).error);
  }

  async #session(): Promise<AuthSession | null> {
    const { data, error } = await this.#client.getSession();
    check(error);
    return data.session?.user.email ? { email: data.session.user.email } : null;
  }
}

/** Supabase answers in English; the login pages show German texts for the usual cases. */
function check(error: AuthError | null): void {
  if (!error) return;
  const text: Record<string, string> = {
    invalid_credentials: 'E-Mail oder Passwort ist falsch.',
    mfa_verification_failed: 'Der Code stimmt nicht. Nimm den aktuellen Code aus der App.',
    over_request_rate_limit: 'Zu viele Versuche. Bitte warte kurz.',
    over_email_send_rate_limit: 'Zu viele E-Mails. Bitte warte kurz.',
    weak_password: 'Das Passwort ist zu schwach.',
    same_password: 'Das neue Passwort muss sich vom alten unterscheiden.',
  };
  throw new Error((error.code && text[error.code]) || 'Die Anmeldung hat nicht geklappt. Bitte versuche es noch einmal.');
}
