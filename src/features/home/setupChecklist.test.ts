import { describe, expect, it } from 'vitest';
import { setupSteps, type SetupFacts } from './SetupChecklist';

const fresh: SetupFacts = {
  admins: 1,
  authenticator: false,
  mailDomain: false,
  offices: 0,
  teams: 0,
  locations: 0,
  folders: 0,
  statutes: false,
  members: 0,
  visited: new Set(),
};

describe('setupSteps', () => {
  it('starts with everything open and warns about the only admin', () => {
    const steps = setupSteps(fresh);
    expect(steps.every((s) => !s.done)).toBe(true);
    expect(steps.filter((s) => s.warn).map((s) => s.id)).toEqual(['admins']);
  });

  it('ticks steps off from facts and seeded settings once opened', () => {
    const steps = setupSteps({
      ...fresh,
      admins: 2,
      teams: 1,
      folders: 2,
      statutes: false,
      visited: new Set(['membership']),
    });
    const done = steps.filter((s) => s.done).map((s) => s.id);
    expect(done).toEqual(['admins', 'membership', 'teams']); // folders without a statutes place stay open
    expect(steps.find((s) => s.id === 'files')?.href).toBe('#/settings/resolution-rules');
  });
});
