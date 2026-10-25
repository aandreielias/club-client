import { describe, expect, it } from 'vitest';
import { ZonedClock } from '../../lib/time/ZonedClock';
import { TeamForm } from './TeamForm.svelte';

describe('TeamForm', () => {
  it('derives the current season from the start month', () => {
    expect(TeamForm.currentSeason('2026-10-15', 7)).toBe('2026/27');
    expect(TeamForm.currentSeason('2027-03-01', 7)).toBe('2026/27');
    expect(TeamForm.currentSeason('2099-08-01', 7)).toBe('2099/00');
  });

  it('validates name and season format', () => {
    const form = new TeamForm(new ZonedClock('Europe/Vienna'), 7);
    expect(Object.keys(form.errors)).toEqual(['name']);
    form.name = 'Herren 2';
    form.season = '2026-27';
    expect(Object.keys(form.errors)).toEqual(['season']);
    form.season = '2026/27';
    expect(form.valid).toBe(true);
  });
});
