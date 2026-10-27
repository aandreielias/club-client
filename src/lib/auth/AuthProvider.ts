export interface AuthSession {
  email: string;
}

export interface AuthInitResult {
  session: AuthSession | null;
  /** The page was opened from an invite or recovery link: the user must choose a password now. */
  needsPassword: boolean;
}

/** A new authenticator-app factor, unverified until the first code is confirmed. */
export interface TotpEnrollment {
  factorId: string;
  /** SVG of the QR code; null when the provider has none (dev login). */
  qrCode: string | null;
  /** The secret to type in when the QR code cannot be scanned. */
  secret: string;
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
  /** Id of the verified authenticator-app factor; null while none is set up. */
  totpFactor(): Promise<string | null>;
  /** Starts setting up the authenticator app; unfinished earlier attempts are dropped. */
  enrollTotp(): Promise<TotpEnrollment>;
  /** Checks a code of the factor; afterwards the token shows a fresh authenticator-app check (`amr`). */
  verifyTotp(factorId: string, code: string): Promise<void>;
}
