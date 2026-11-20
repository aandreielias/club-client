import { FormState } from '../../lib/state/FormState.svelte';
import { settings } from '../../settings';
import type { ZonedClock, LocalDateTime } from '../../lib/time/ZonedClock';
import { audienceEntries, audienceError, audienceOf, EVERYONE, hasAudience, NO_AUDIENCE, sameAudience, type Reach } from '../../lib/reach';
import { rhythmCode, rhythmOf, type NewTask, type Task, type TaskPatch } from './model';

export type TaskField = 'audience' | 'title' | 'description' | 'dueAt' | 'assignees' | 'checklist' | 'repeat';

export type TaskFormErrors = Partial<Record<TaskField, string>>;

/** One editable checklist line; `key` keeps list rendering stable while lines are added/removed. */
export interface ChecklistLine {
  key: number;
  text: string;
}

/** Select value for "Ganzer Verein": every member sees it. */
export const CLUB_WIDE = '';
/** Select value for chosen roles, offices, teams, kinds and members; exactly one team alone makes a team task. */
export const FOR_CHOSEN = '*';
/** Select value of an existing club task for the board alone (empty audience; also the tasks the app makes). */
export const BOARD_ONLY = '-';

const limits = settings.tasks;

/**
 * Editable state of a new or existing task. The due time is club-local; conversion to a UTC instant
 * happens in `toNew` / `toPatch`. Validation mirrors the server.
 */
export class TaskForm extends FormState<TaskFormErrors> {
  teamId = $state<string>(CLUB_WIDE);
  title = $state('');
  description = $state('');
  /** Empty = no due date. */
  due = $state<LocalDateTime>('');
  /** The rhythm as select value (`rhythmCode`, '' = once). */
  repeat = $state('');
  assignees = $state<string[]>([]);
  /** Audience entries (`lib/reach` audienceOf), only with `FOR_CHOSEN`. */
  audience = $state<string[]>([]);
  checklist = $state<ChecklistLine[]>([]);

  #nextKey = 0;

  private constructor(
    private readonly clock: ZonedClock,
    readonly original: Task | null,
  ) {
    super();
  }

  get isEdit(): boolean {
    return this.original !== null;
  }

  /** `teamId`: preselected as the only chip; else the whole club when `clubWide`, else an empty choice. */
  static blank(clock: ZonedClock, teamId: string | null, clubWide: boolean): TaskForm {
    const form = new TaskForm(clock, null);
    form.teamId = teamId || !clubWide ? FOR_CHOSEN : CLUB_WIDE;
    if (teamId) form.audience = [`team:${teamId}`];
    return form;
  }

  static edit(clock: ZonedClock, task: Task): TaskForm {
    const form = new TaskForm(clock, task);
    form.teamId = task.teamId ?? (task.audience.everyone ? CLUB_WIDE : hasAudience(task.audience) ? FOR_CHOSEN : BOARD_ONLY);
    form.audience = audienceEntries(task.audience);
    form.title = task.title;
    form.description = task.description ?? '';
    form.due = task.dueAt ? clock.toLocal(task.dueAt) : '';
    form.repeat = rhythmCode(task);
    form.assignees = [...task.assignees];
    form.checklist = task.checklist.map((item) => form.line(item.text));
    return form;
  }

  /** The team of a team task: the existing task's, or on creation the one team chosen alone. */
  get teamOrNull(): string | null {
    if (this.original) return this.original.teamId;
    const [only, ...rest] = this.audience;
    return this.forChosen && rest.length === 0 && only?.startsWith('team:') ? only.slice('team:'.length) : null;
  }

  /** Who the task is for besides team, creator and assignees. */
  get audienceValue(): Reach {
    if (this.teamOrNull) return NO_AUDIENCE;
    return this.forChosen ? audienceOf(this.audience) : this.teamId === CLUB_WIDE ? EVERYONE : NO_AUDIENCE;
  }

  get forChosen(): boolean {
    return this.teamId === FOR_CHOSEN;
  }

  isAssigned(memberId: string): boolean {
    return this.assignees.includes(memberId);
  }

  toggleAssignee(memberId: string): void {
    this.assignees = this.isAssigned(memberId) ? this.assignees.filter((id) => id !== memberId) : [...this.assignees, memberId];
  }

  /** Drops assignees that are not candidates any more (e.g. after switching the team). */
  retainAssignees(candidates: readonly string[]): void {
    const allowed = new Set(candidates);
    if (this.assignees.some((id) => !allowed.has(id))) this.assignees = this.assignees.filter((id) => allowed.has(id));
  }

  addLine(): void {
    if (this.checklist.length < limits.maxChecklistItems) this.checklist.push(this.line(''));
  }

  removeLine(key: number): void {
    this.checklist = this.checklist.filter((line) => line.key !== key);
  }

  /** True when saving would replace the checklist and so reset ticked items. */
  get resetsTicks(): boolean {
    return !!this.original?.checklist.some((i) => i.done) && this.checklistChanged();
  }

  toNew(): NewTask {
    return {
      teamId: this.teamOrNull,
      appointmentId: null,
      title: this.title.trim(),
      description: this.description.trim() || null,
      dueAt: this.due ? this.clock.toInstant(this.due) : null,
      assignees: [...this.assignees],
      checklist: this.texts(),
      ...rhythmOf(this.repeat),
      audience: this.audienceValue,
    };
  }

  /** Only changed fields; an emptied description is sent as '' to clear it. */
  toPatch(): TaskPatch {
    const original = this.original;
    if (!original) throw new Error('toPatch() needs an existing task');
    const next = this.toNew();
    const patch: TaskPatch = {};
    if (next.title !== original.title) patch.title = next.title;
    if ((next.description ?? '') !== (original.description ?? '')) patch.description = next.description ?? '';
    if (next.dueAt && next.dueAt !== original.dueAt) patch.dueAt = next.dueAt;
    if (!next.dueAt && original.dueAt) patch.clearDue = true;
    if (!TaskForm.sameSet(next.assignees, original.assignees)) patch.assignees = next.assignees;
    // Only a task for the whole club or chosen people changes whom it is for (server: TaskHandlers.update).
    if (hasAudience(original.audience) && hasAudience(next.audience) && !sameAudience(next.audience, original.audience))
      patch.audience = next.audience;
    if (this.checklistChanged()) patch.checklist = next.checklist;
    if (this.repeat !== rhythmCode(original)) {
      if (next.repeatWeeks) patch.repeatWeeks = next.repeatWeeks;
      else if (next.repeatMonths) Object.assign(patch, { repeatMonths: next.repeatMonths, repeatByWeekday: next.repeatByWeekday });
      else patch.clearRepeat = true;
    }
    return patch;
  }

  private checklistChanged(): boolean {
    const texts = this.texts();
    const before = this.original?.checklist.map((i) => i.text) ?? [];
    return texts.length !== before.length || texts.some((text, i) => text !== before[i]);
  }

  private texts(): string[] {
    return this.checklist.map((line) => line.text.trim()).filter(Boolean);
  }

  private line(text: string): ChecklistLine {
    return { key: this.#nextKey++, text };
  }

  protected validate(): TaskFormErrors {
    const errors: TaskFormErrors = {};
    const title = this.title.trim();
    if (!title || title.length > limits.titleMaxLength) errors.title = `Titel mit 1 bis ${limits.titleMaxLength} Zeichen angeben.`;
    if (this.description.length > limits.descriptionMaxLength) errors.description = `Höchstens ${limits.descriptionMaxLength} Zeichen.`;
    if (this.forChosen) {
      const audience = audienceError(this.audience);
      if (audience) errors.audience = audience;
    }
    if (this.assignees.length === 0 || this.assignees.length > limits.maxAssignees) {
      errors.assignees = `1 bis ${limits.maxAssignees} Personen zuweisen.`;
    }
    if (this.repeat && !this.due) errors.repeat = 'Wiederholen geht nur mit Fälligkeit.';
    const texts = this.texts();
    if (texts.length > limits.maxChecklistItems) errors.checklist = `Höchstens ${limits.maxChecklistItems} Punkte.`;
    else if (texts.some((t) => t.length > limits.checklistItemMaxLength)) {
      errors.checklist = `Jeder Punkt hat höchstens ${limits.checklistItemMaxLength} Zeichen.`;
    }
    return errors;
  }

  private static sameSet(a: readonly string[], b: readonly string[]): boolean {
    return a.length === b.length && a.every((id) => b.includes(id));
  }
}
