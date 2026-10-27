import { describe, expect, it } from 'vitest';
import type { Member } from '../types';
import { items, move } from './calendarItems';
import { directory } from './core';
import { calendar } from '../../features/calendar/mock';

const member = (id: string): Member => directory.members.data.find((m) => m.id === id)!;
const year = new Date().getFullYear();

describe('mock calendar items', () => {
  it('shows birthdays only to who sees the birth date', () => {
    const from = new Date(Date.UTC(year, 0, 1)).toISOString();
    const to = new Date(Date.UTC(year, 11, 31)).toISOString();
    const birthdays = (id: string) =>
      items(member(id), from, to)
        .filter((i) => i.category === 'BIRTHDAY')
        .map((i) => i.id)
        .sort();
    expect(birthdays('eltern')).toEqual(['eltern', 'spieler']); // her son David
    expect(birthdays('spielerin')).toEqual(['spielerin']);
    expect(birthdays('admin').length).toBeGreaterThan(10);
  });

  it('lists absences for the member, their coach and the board, and moves them for the member', () => {
    const start = directory.clock.today();
    const absence = calendar.addAbsence(member('spielerin'), { from: start, to: start, reason: 'Urlaub' });
    const day = new Date(Date.parse(directory.clock.startOfDay(start)));
    const range = [new Date(day.getTime() - 86_400_000).toISOString(), new Date(day.getTime() + 10 * 86_400_000).toISOString()] as const;
    const of = (id: string) => items(member(id), ...range).filter((i) => i.category === 'ABSENCE' && i.id === absence.id);
    expect(of('spielerin')[0]).toMatchObject({ detail: 'Urlaub', movable: true });
    expect(of('trainer')[0]).toMatchObject({ movable: false }); // her coach
    expect(of('vorstand')).toHaveLength(1);
    expect(of('neu')).toHaveLength(0);

    directory.confirm(member('vorstand'));
    const end = new Date(Date.parse(directory.clock.startOfDay(start)) + 3 * 86_400_000).toISOString();
    move(member('spielerin'), 'absence', absence.id, directory.clock.startOfDay(start), end);
    expect(calendar.absences.data.find((a) => a.id === absence.id)!.to).toBe(directory.clock.localDate(new Date(Date.parse(end) - 1)));
    expect(() => move(member('trainer'), 'absence', absence.id, directory.clock.startOfDay(start), end)).toThrow(
      expect.objectContaining({ code: 'absence.not-found' }),
    );
  });
});
