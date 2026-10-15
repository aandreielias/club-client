export interface AuthSession {
  email: string;
}

export interface AuthInitResult {
  session: AuthSession | null;
  /** The page was opened from an invite or recovery link: the user must choose a password now. */
  needsPassword: boolean;
}

/** Login backend. DevAuthProvider works offline; SupabaseAuthProvider is used with the real server. */
export interface AuthProvider {
  /** Restores a stored session and consumes invite/recovery tokens from the URL. */
  init(): Promise<AuthInitResult>;
  signIn(email: string, password: string): Promise<AuthSession>;
  signOut(): Promise<void>;
  /** Sends the reset mail; must not reveal whether the address exists. */
  resetPassword(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  /** Current access token, refreshed when needed; null when signed out. */
  token(): Promise<string | null>;
}
