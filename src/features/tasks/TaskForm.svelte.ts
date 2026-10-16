import { settings } from '../../settings';
import type { ZonedClock, LocalDateTime } from '../../lib/time/ZonedClock';
import type { NewTask, Task, TaskPatch } from './model';

export type TaskField = 'title' | 'description' | 'dueAt' | 'assignees' | 'checklist' | 'repeat';

export type TaskFormErrors = Partial<Record<TaskField, string>>;

/** One editable checklist line; `key` keeps list rendering stable while lines are added/removed. */
export interface ChecklistLine {
  key: number;
  text: string;
}

/** Select value for "club-wide" (no team). */
export const CLUB_WIDE = '';

const limits = settings.tasks;

/**
 * Editable state of a new or existing task. The due time is club-local; conversion to a UTC instant
 * happens in `toNew` / `toPatch`. Validation mirrors the server.
 */
export class TaskForm {
  teamId = $state<string>(CLUB_WIDE);
  title = $state('');
  description = $state('');
  /** Empty = no due date. */
  due = $state<LocalDateTime>('');
  /** Weeks between repeats as text ('' = once), for the select. */
  repeat = $state('');
  assignees = $state<string[]>([]);
  checklist = $state<ChecklistLine[]>([]);
  submitted = $state(false);

  readonly errors: TaskFormErrors;
  readonly valid: boolean;

  #nextKey = 0;

  private constructor(
    private readonly clock: ZonedClock,
    readonly original: Task | null,
  ) {
    this.errors = $derived(this.validate());
    this.valid = $derived(Object.keys(this.errors).length === 0);
  }

  get isEdit(): boolean {
    return this.original !== null;
  }

  static blank(clock: ZonedClock, teamId: string | null): TaskForm {
    const form = new TaskForm(clock, null);
    form.teamId = teamId ?? CLUB_WIDE;
    return form;
  }

  static edit(clock: ZonedClock, task: Task): TaskForm {
    const form = new TaskForm(clock, task);
    form.teamId = task.teamId ?? CLUB_WIDE;
    form.title = task.title;
    form.description = task.description ?? '';
    form.due = task.dueAt ? clock.toLocal(task.dueAt) : '';
    form.repeat = task.repeatWeeks ? String(task.repeatWeeks) : '';
    form.assignees = [...task.assignees];
    form.checklist = task.checklist.map((item) => form.line(item.text));
    return form;
  }

  get teamOrNull(): string | null {
    return this.teamId === CLUB_WIDE ? null : this.teamId;
  }

  error(field: TaskField): string | null {
    return this.submitted ? (this.errors[field] ?? null) : null;
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
      repeatWeeks: this.repeat ? Number(this.repeat) : null,
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
    if (this.checklistChanged()) patch.checklist = next.checklist;
    if (next.repeatWeeks !== original.repeatWeeks) {
      if (next.repeatWeeks) patch.repeatWeeks = next.repeatWeeks;
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

  private validate(): TaskFormErrors {
    const errors: TaskFormErrors = {};
    const title = this.title.trim();
    if (!title || title.length > limits.titleMaxLength) errors.title = `Titel mit 1 bis ${limits.titleMaxLength} Zeichen angeben.`;
    if (this.description.length > limits.descriptionMaxLength) errors.description = `Höchstens ${limits.descriptionMaxLength} Zeichen.`;
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
