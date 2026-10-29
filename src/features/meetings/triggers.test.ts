import { describe, expect, it } from 'vitest';
import { describeTrigger, newTrigger, startedTrigger, triggerMatches, triggerProblem, type Trigger } from './triggers';

const file: Trigger = { record: 'FILE', event: 'STORED', conditions: [{ field: 'folder', value: 'f1', label: 'Protokolle' }], window: null };

describe('follow-up triggers', () => {
  it('checks what is needed', () => {
    expect(triggerProblem(null)).toContain('Wählen');
    expect(triggerProblem(file)).toBeNull();
    expect(triggerProblem({ ...file, event: 'CLOSED' })).toContain('Ereignis');
    expect(triggerProblem({ ...file, conditions: [{ field: 'folder', value: ' ', label: null }] })).toContain('Wert');
    expect(triggerProblem({ ...file, window: { fromDays: 1, toDays: 2, fromDate: null, toDate: null } })).toContain('Termine');
    expect(
      triggerProblem({ ...newTrigger('APPOINTMENT', 'CREATED', true), window: { fromDays: 9, toDays: 2, fromDate: null, toDate: null } }),
    ).toContain('endet');
  });

  it('matches events, conditions and the window once started', () => {
    expect(triggerMatches(file, { record: 'FILE', event: 'VERSION', attrs: { folder: 'f1' }, date: null })).toBe(true);
    expect(triggerMatches(file, { record: 'FILE', event: 'UPLOADED', attrs: { folder: 'f2' }, date: null })).toBe(false);
    const training = startedTrigger(
      {
        ...newTrigger('APPOINTMENT', 'CREATED'),
        conditions: [{ field: 'type', value: 'TRAINING', label: null }],
        window: { fromDays: 5, toDays: 10, fromDate: null, toDate: null },
      },
      '2026-11-01',
    );
    expect(training?.window).toEqual({ fromDays: null, toDays: null, fromDate: '2026-11-06', toDate: '2026-11-11' });
    const at = (date: string, type = 'TRAINING') => triggerMatches(training, { record: 'APPOINTMENT', event: 'CREATED', attrs: { type }, date });
    expect(at('2026-11-08')).toBe(true);
    expect(at('2026-11-03')).toBe(false);
    expect(at('2026-11-08', 'MATCH')).toBe(false);
  });

  it('describes a trigger in words', () => {
    expect(describeTrigger(file)).toBe('eine Datei im Ordner „Protokolle“ gespeichert ist');
    expect(
      describeTrigger({
        record: 'MEETING',
        event: 'CLOSED',
        conditions: [{ field: 'type', value: 'BOARD', label: 'Vorstandssitzung' }],
        window: null,
      }),
    ).toBe('eine Sitzung „Vorstandssitzung“ abgehalten ist');
  });
});
