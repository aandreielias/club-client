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

describe('mock teams', async () => {
  const { directory } = await import('../../lib/mock/core');
  const { teams } = await import('./mock');
  const { calendar } = await import('../calendar/mock');
  const { notifications } = await import('../notifications/mock');
  const member = (id: string) => directory.members.data.find((m) => m.id === id)!;

  it('numbers players, starts a new season with the roster and lets guardians read it', () => {
    directory.confirm(member('admin'));
    const roster = teams.setPlayerInfo(member('admin'), 't-u16', 'spieler', { jersey: 7, position: 'Zuspiel', captain: true });
    expect(roster.entries.find((e) => e.memberId === 'spieler')).toMatchObject({ jersey: 7, captain: true });
    expect(directory.roster(member('eltern'), 't-u16').entries.length).toBeGreaterThan(0);
    const next = teams.copyTeam(member('admin'), 't-u16', { season: '2030/31' });
    expect(directory.roster(member('admin'), next.id).entries.find((e) => e.memberId === 'spieler')).toMatchObject({ jersey: 7 });
    expect(teams.updateTeam(member('admin'), next.id, { archived: true }).archived).toBe(true);
  });

  it('sends coach requests to admin and board', () => {
    teams.requestPlayer(member('trainer'), 't-u16', { note: 'Lea aus der Schul-AG' });
    expect(notifications.list('admin', false).items[0]).toMatchObject({ kind: 'TEAM' });
    expect(() => teams.requestPlayer(member('spieler'), 't-u16', { note: 'x' })).toThrow(expect.objectContaining({ status: 404 }));
  });

  it('keeps match results and counts the season', () => {
    directory.confirm(member('admin'));
    const start = new Date(Date.now() - 2 * 86_400_000);
    const [match] = calendar.create(member('admin'), {
      teamId: 't-u16',
      type: 'MATCH',
      title: 'Heimspiel',
      description: null,
      location: null,
      locationId: null,
      cabinMen: null,
      cabinWomen: null,
      startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + 7_200_000).toISOString(),
      repeatUntil: null,
      intervalWeeks: null,
    });
    expect(calendar.setExtras(member('admin'), match.id, { opponent: 'SV Nord', home: true, sets: ['25:20', '22:25', '25:18'] })).toMatchObject({
      setsWon: 2,
      won: true,
    });
    expect(() => calendar.setExtras(member('admin'), match.id, { sets: ['25-20'] })).toThrow(
      expect.objectContaining({ code: 'appointment.extras-invalid' }),
    );
    const season = calendar.teamMatches(member('eltern'), 't-u16', new Date(Date.now() - 30 * 86_400_000).toISOString(), new Date().toISOString());
    expect(season.won).toBeGreaterThan(0);
  });
});
