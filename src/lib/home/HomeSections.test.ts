import { describe, expect, it } from 'vitest';
import { HomeSections } from './HomeSections';

describe('HomeSections', () => {
  it('orders by preference, hides switched-off and role-restricted sections', () => {
    const sections = new HomeSections();
    const component = (() => {}) as never;
    sections.register({ id: 'agenda', label: 'Agenda', component });
    sections.register({ id: 'notifications', label: 'Benachrichtigungen', component });
    sections.register({ id: 'board', label: 'Vorstand', component, roles: ['BOARD'] });
    const player = () => false;
    expect(sections.ordered([], player).map((s) => s.id)).toEqual(['agenda', 'notifications']);
    expect(sections.shown(['notifications'], [], player).map((s) => s.id)).toEqual(['notifications', 'agenda']);
    expect(sections.shown([], ['agenda'], () => true).map((s) => s.id)).toEqual(['notifications', 'board']);
    expect(() => sections.register({ id: 'agenda', label: 'x', component })).toThrow();
  });
});
