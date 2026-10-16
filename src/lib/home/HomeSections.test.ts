import { describe, expect, it } from 'vitest';
import { HomeSections } from './HomeSections';

describe('HomeSections', () => {
  it('orders by preference and shows defaults unless the member switched them', () => {
    const sections = new HomeSections();
    const component = (() => {}) as never;
    sections.register({ id: 'agenda', label: 'Agenda', component, defaultShown: true });
    sections.register({ id: 'tasks', label: 'Aufgaben', component });
    sections.register({ id: 'board', label: 'Vorstand', component, roles: ['BOARD'] });
    const player = () => false;
    expect(sections.ordered([], player).map((s) => s.id)).toEqual(['agenda', 'tasks']);
    expect(sections.shown([], {}, player).map((s) => s.id)).toEqual(['agenda']);
    expect(sections.shown(['tasks'], { tasks: true }, player).map((s) => s.id)).toEqual(['tasks', 'agenda']);
    expect(sections.shown([], { agenda: false, board: true }, () => true).map((s) => s.id)).toEqual(['board']);
    expect(() => sections.register({ id: 'agenda', label: 'x', component })).toThrow();
  });
});
