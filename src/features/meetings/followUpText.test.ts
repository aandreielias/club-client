import { describe, expect, it } from 'vitest';
import { assigneeText, dueText, ruleSummary, startText, waitingText } from './followUpText';
import { plainFollowUp, type FollowUp } from './model';

const label = (o: string) => (o === 'TREASURER' ? 'Kassa' : o);

describe('follow-up texts', () => {
  it('names who does it', () => {
    expect(assigneeText({ assignTo: 'DEFAULT', office: null }, label)).toBe('wie im Beschluss gewählt');
    expect(assigneeText({ assignTo: 'OFFICE', office: 'TREASURER' }, label)).toBe('Kassa');
    expect(assigneeText({ assignTo: 'OFFICE', office: null }, label)).toBe('Funktion fehlt');
  });

  it('says when it starts and is due', () => {
    expect(startText({ afterPrevious: true }, 2)).toBe('startet, wenn 1 erledigt ist');
    expect(startText({ afterPrevious: true }, 1)).toBe('startet mit dem Beschluss');
    expect(dueText(null)).toBe('ohne Datum');
    expect(dueText(1)).toBe('fällig nach 1 Tag ab Beschluss');
    expect(dueText(14, true)).toBe('fällig nach 14 Tagen');
  });

  it('sums a template up in one line', () => {
    const f = { ...plainFollowUp('IMPLEMENT', 'x', 14), assignTo: 'OFFICE' as const, office: 'TREASURER' as const, checklist: ['a', ' ', 'b'] };
    expect(ruleSummary(f, false, label)).toBe('Kassa · fällig nach 14 Tagen ab Beschluss · 2 Punkte');
    expect(ruleSummary(plainFollowUp('UPLOAD_STATUTES', 'x', null), true, label)).toBe(
      'wie im Beschluss gewählt · ohne Datum · erledigt sich selbst',
    );
  });

  it('tells what a follow-up waits for', () => {
    const base: FollowUp = {
      id: 'a',
      resolutionId: null,
      kind: 'MANUAL',
      title: 'Saal reservieren',
      automatic: false,
      dueAt: null,
      taskId: 't',
      taskStatus: 'OPEN',
      waitsFor: null,
      waiting: false,
    };
    const b: FollowUp = { ...base, id: 'b', title: 'Saal schmücken', taskId: null, taskStatus: null, waitsFor: 'a', waiting: true };
    expect(waitingText(b, [base, b])).toBe('wartet auf „Saal reservieren“');
    expect(waitingText(base, [base, b])).toBeNull();
  });
});
