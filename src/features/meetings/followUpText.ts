import type { FollowUp, FollowUpRule } from './model';
import { describeTrigger } from './triggers';

/** Who does a follow-up, for its card; `officeLabel` names the office of OFFICE. */
export function assigneeText(
  f: Pick<FollowUpRule, 'assignTo' | 'office'>,
  officeLabel: (office: NonNullable<FollowUpRule['office']>) => string,
): string {
  switch (f.assignTo) {
    case 'BOARD':
      return 'Vorstand';
    case 'OFFICE':
      return f.office ? officeLabel(f.office) : 'Funktion fehlt';
    case 'MANAGER':
      return 'wer die Sitzung leitet';
    case 'MEMBER':
      return 'das betroffene Mitglied';
    default:
      return 'wie im Beschluss gewählt';
  }
}

/** "sofort" or "startet, wenn 1 erledigt ist" (`position`: 1-based number of this follow-up). */
export function startText(f: Pick<FollowUpRule, 'afterPrevious'>, position: number): string {
  return f.afterPrevious && position > 1 ? `startet, wenn ${position - 1} erledigt ist` : 'startet mit dem Beschluss';
}

export function dueText(dueDays: number | null, afterPrevious = false): string {
  if (dueDays == null) return 'ohne Datum';
  const days = `${dueDays} ${dueDays === 1 ? 'Tag' : 'Tagen'}`;
  return `fällig nach ${days}${afterPrevious ? '' : ' ab Beschluss'}`;
}

/** How it gets done, short: by hand (null), "erledigt sich selbst", or what it waits for. */
export function doneText(f: Pick<FollowUpRule, 'kind' | 'trigger'>, automatic: boolean): string | null {
  if (f.kind === 'TRIGGER') return `erledigt, sobald ${describeTrigger(f.trigger)}`;
  return automatic ? 'erledigt sich selbst' : null;
}

/** The one-line summary of a follow-up template: who · when due · how it gets done · checklist. */
export function ruleSummary(f: FollowUpRule, automatic: boolean, officeLabel: (office: NonNullable<FollowUpRule['office']>) => string): string {
  const items = f.checklist.filter((t) => t.trim()).length;
  return [
    assigneeText(f, officeLabel),
    dueText(f.dueDays, f.afterPrevious),
    doneText(f, automatic),
    items && `${items} ${items === 1 ? 'Punkt' : 'Punkte'}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** "wartet auf „Saal reservieren“" for a follow-up that has no task yet. */
export function waitingText(f: FollowUp, all: readonly FollowUp[]): string | null {
  if (!f.waiting) return null;
  const before = all.find((x) => x.id === f.waitsFor);
  return before ? `wartet auf „${before.title}“` : 'wartet auf die vorige Aufgabe';
}
