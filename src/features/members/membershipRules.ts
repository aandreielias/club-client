/** The membership rules of Einstellungen › Mitgliedschaft (server: BoardSettings, saved with the board settings). */
export interface MembershipRules {
  multipleKinds: boolean;
  guardianUntilAge: number;
  ownConsentAge: number;
}

export interface AgeLimits {
  guardianMin: number;
  guardianMax: number;
  consentMin: number;
}

/** What is wrong with the minors' ages, per field; empty when they can be saved. */
export function ageProblems(rules: MembershipRules, limits: AgeLimits): Partial<Record<'guardianUntilAge' | 'ownConsentAge', string>> {
  const problems: Partial<Record<'guardianUntilAge' | 'ownConsentAge', string>> = {};
  const { guardianUntilAge: guardian, ownConsentAge: consent } = rules;
  if (!Number.isInteger(guardian) || guardian < limits.guardianMin || guardian > limits.guardianMax) {
    problems.guardianUntilAge = `Ein Alter von ${limits.guardianMin} bis ${limits.guardianMax}.`;
  }
  if (!Number.isInteger(consent) || consent < limits.consentMin) {
    problems.ownConsentAge = `Mindestens ${limits.consentMin}.`;
  } else if (Number.isInteger(guardian) && consent > guardian) {
    problems.ownConsentAge = 'Höchstens das Alter, bis zu dem Erziehungsberechtigte handeln.';
  }
  return problems;
}
