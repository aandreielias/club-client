import { describe, expect, it } from 'vitest';
import { ageProblems } from './membershipRules';

const limits = { guardianMin: 14, guardianMax: 21, consentMin: 10 };
const rules = (guardianUntilAge: number, ownConsentAge: number) => ({ multipleKinds: false, guardianUntilAge, ownConsentAge });

describe('ageProblems', () => {
  it('accepts ages within the limits', () => {
    expect(ageProblems(rules(18, 14), limits)).toEqual({});
    expect(ageProblems(rules(14, 14), limits)).toEqual({});
  });

  it('refuses a guardian age outside the limits or not whole', () => {
    expect(ageProblems(rules(13, 10), limits).guardianUntilAge).toBeDefined();
    expect(ageProblems(rules(22, 14), limits).guardianUntilAge).toBeDefined();
    expect(ageProblems(rules(Number.NaN, 14), limits).guardianUntilAge).toBeDefined();
  });

  it('refuses an own consent age below the minimum or above the guardian age', () => {
    expect(ageProblems(rules(18, 9), limits).ownConsentAge).toBeDefined();
    expect(ageProblems(rules(16, 17), limits).ownConsentAge).toBeDefined();
  });
});
