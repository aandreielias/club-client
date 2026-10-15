import type { AuthProvider, AuthSession } from './AuthProvider';

/**
 * Login through Supabase Auth. Not implemented until the Supabase project exists (phase 6):
 * - client: `new AuthClient({ url: `${url}/auth/v1`, headers: { apikey: key }, flowType: 'pkce' })` from @supabase/auth-js
 * - init: getSession(); invite/recovery links carry `#access_token=…&type=invite|recovery` → needsPassword
 * - signIn: signInWithPassword; resetPassword: resetPasswordForEmail(email, { redirectTo: page URL })
 * - token: getSession() refreshes the access token before it expires
 */
export class SupabaseAuthProvider implements AuthProvider {
  constructor(
    readonly url: string,
    readonly publishableKey: string,
  ) {}

  init(): Promise<never> {
    return this.notReady();
  }

  signIn(): Promise<AuthSession> {
    return this.notReady();
  }

  signOut(): Promise<void> {
    return this.notReady();
  }

  resetPassword(): Promise<void> {
    return this.notReady();
  }

  updatePassword(): Promise<void> {
    return this.notReady();
  }

  token(): Promise<string | null> {
    return this.notReady();
  }

  private notReady(): Promise<never> {
    return Promise.reject(new Error('Supabase-Login ist noch nicht eingerichtet (VITE_API_MODE=mock verwenden).'));
  }
}
