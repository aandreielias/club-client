// Mock of the club-server tasks module (TaskHandlers): visibility, work and manage rights, validation.
import { activity, MockActivity } from '../../lib/mock/MockActivity';
import { settings } from '../../settings';
import { personalData, directory, MockDirectory } from '../../lib/mock/core';
import { EVERYONE, hasAudience, isChosen, NO_AUDIENCE, type Reach } from '../../lib/reach';
import { itemUseSources, MockLinks, type ItemUse } from '../../lib/mock/MockLinks';
import { MockServer, mockServer, type MockRequest } from '../../lib/mock/MockServer';
import { MockTable } from '../../lib/mock/MockTable';
import type { Member } from '../../lib/types';
import { repeatAt, type Rhythm } from '../../lib/time/repeat';
import {
  type NewTask,
  type Task,
  type TaskComment,
  type TaskLabel,
  type TaskLink,
  type TaskPatch,
  type TaskPriority,
  type TaskSettings,
  type TaskSource,
  type TaskStage,
  type TaskStatus,
} from './model';
import { HUES } from '../calendar/model';
import type { MockEvent } from '../../lib/mock/MockEventBus';
import { ADMIN_BOARD, coaches } from '../../lib/types';
import { CHANGE_FIELD_LABELS, type ChangeField } from '../members/MembersApi';

/** As tasks_task stores it: the club stage (null = the first of its phase), the parent and the tasks it waits for by id. */
type StoredTask = Omit<Task, 'comments' | 'source' | 'stage' | 'parent' | 'subtasks' | 'blockedBy'> & {
  stage: string | null;
  parentId: string | null;
  blockerIds: string[];
};
type StoredStage = Omit<TaskStage, 'inUse'>;
type StoredLabel = Omit<TaskLabel, 'inUse'>;

/** What tasks the app makes carry (server: Task.create). */
const UNPLANNED = { stage: null, priority: 'NORMAL' as TaskPriority, labels: [] as string[], parentId: null, blockerIds: [] as string[] };
const PRIORITIES: readonly TaskPriority[] = ['LOW', 'NORMAL', 'HIGH'];
/** server: Task.MAX_LABELS, TaskHandlers.MAX_BLOCKERS */
const MAX_LABELS = 10;
const MAX_BLOCKERS = 20;

const fail = MockServer.fail;
const limits = settings.tasks;
const STATUSES: readonly TaskStatus[] = ['OPEN', 'IN_PROGRESS', 'DONE'];

/** server: TaskHandlers.Viewer */
class Viewer {
  readonly board: boolean;
  readonly teamIds: Set<string>;
  readonly coachTeamIds: Set<string>;
  /** The member plus their minors. */
  readonly self: Set<string>;
  readonly offices: string[];

  constructor(
    readonly member: Member,
    private readonly people: MockDirectory,
  ) {
    const own = people.teamRoles(member.id);
    this.board = people.isManager(member);
    this.teamIds = new Set(Object.keys(own));
    this.coachTeamIds = new Set(Object.keys(own).filter((team) => coaches(own[team])));
    this.self = new Set([member.id, ...people.wardsOf(member.id)]);
    this.offices = people.officesOf(member.id);
  }

  /** server: Viewer.inAudience — the member's own roles, running offices, teams and kinds, or named. */
  inAudience(a: Reach): boolean {
    return this.people.reaches(a, this.member.id);
  }

  assigned(task: StoredTask): boolean {
    return task.assignees.some((id) => this.self.has(id));
  }

  canSee(task: StoredTask): boolean {
    return (
      this.board ||
      task.createdBy === this.member.id ||
      this.assigned(task) ||
      (task.teamId !== null && this.teamIds.has(task.teamId)) ||
      this.inAudience(task.audience)
    );
  }

  canWork(task: StoredTask): boolean {
    return this.board || task.createdBy === this.member.id || this.assigned(task) || (task.teamId !== null && this.coachTeamIds.has(task.teamId));
  }
}

export class MockTasks {
  readonly tasks: MockTable<StoredTask[]>;
  /** taskId → comments */
  readonly comments: MockTable<Record<string, TaskComment[]>>;

  /** taskId → source (server: tasks_source) */
  readonly sources = new MockTable<Record<string, TaskSource>>('task-sources', () => ({}));
  /** server: tasks_setting */
  readonly settings = new MockTable<TaskSettings>('task-settings', () => ({ remindHours: 24, overdueRepeatDays: 0, escalateAfterDays: 0 }));

  /** server: tasks_stage, seeded by V158 */
  readonly stages = new MockTable<StoredStage[]>('task-stages', () => [
    { key: 'OPEN', label: 'Offen', hue: 'red', phase: 'OPEN', sort: 10, archived: false },
    { key: 'IN_PROGRESS', label: 'In Arbeit', hue: 'yellow', phase: 'IN_PROGRESS', sort: 20, archived: false },
    { key: 'DONE', label: 'Erledigt', hue: 'green', phase: 'DONE', sort: 30, archived: false },
  ]);
  /** server: tasks_label */
  readonly labels = new MockTable<StoredLabel[]>('task-labels', () => []);

  constructor(private readonly people: MockDirectory) {
    this.tasks = new MockTable('tasks', () => this.seedTasks());
    this.comments = new MockTable('task-comments', () => this.seedComments());
    mockServer.events.subscribe((event) => this.onEvent(event));
  }

  /** server: every member reads it ("Bald fällig" uses the same lead). */
  taskSettings(): TaskSettings {
    return { ...this.settings.data };
  }

  /** server: TaskHandlers.saveSettings (the overdue repeat and escalation run on the server's schedule only) */
  saveTaskSettings(member: Member, body: Record<string, unknown>): TaskSettings {
    this.people.requirePrivileged(member, ADMIN_BOARD);
    const [remindHours, overdueRepeatDays, escalateAfterDays] = [body.remindHours, body.overdueRepeatDays, body.escalateAfterDays].map(Number);
    const within = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max;
    if (!within(remindHours, 1, 336) || !within(overdueRepeatDays, 0, 30) || !within(escalateAfterDays, 0, 90)) fail(400, 'task-settings.invalid');
    Object.assign(this.settings.data, { remindHours, overdueRepeatDays, escalateAfterDays });
    this.settings.save();
    return { ...this.settings.data };
  }

  /** server: TaskHandlers.onChangeRequested / onChangeDecided */
  private onEvent(event: MockEvent): void {
    const data = event.data as Record<string, any>;
    if (event.type === 'members.member-erased') this.onMemberErased(data.memberId, data.changeRequestIds);
    if (event.type === 'members.change-requested') {
      const managers = this.people.audienceIds({ roles: ADMIN_BOARD }).sort().slice(0, limits.maxAssignees);
      if (!managers.length) return;
      const task: StoredTask = {
        id: crypto.randomUUID(),
        teamId: null,
        appointmentId: null,
        title: `Kontoänderung: ${data.memberName} – ${CHANGE_FIELD_LABELS[data.field as ChangeField]}`.slice(0, limits.titleMaxLength),
        description: `Neuer Wert: ${data.newValue}`,
        status: 'OPEN',
        dueAt: null,
        createdBy: managers[0],
        assignees: managers,
        checklist: [],
        createdAt: new Date().toISOString(),
        completedAt: null,
        repeatWeeks: null,
        repeatMonths: null,
        repeatByWeekday: false,
        audience: NO_AUDIENCE,
        ...UNPLANNED,
      };
      this.tasks.data.push(task);
      this.sources.data[task.id] = { kind: 'CHANGE_REQUEST', id: data.requestId };
      this.tasks.save();
      this.sources.save();
      this.changed(task, 'CREATED');
      this.assigned(task, []);
    } else if (event.type === 'members.change-decided') {
      this.finish('CHANGE_REQUEST', data.requestId);
    } else if (event.type === 'finance.invoice-paid') {
      this.finish('FINANCE_INVOICE', data.invoiceId);
    } else if (event.type === 'finance.invoice-dropped') {
      this.deadlineDrop(data.invoiceId, 'FINANCE_INVOICE');
    } else if (event.type === 'meetings.resolution-passed' || event.type === 'finance.invoice-opened') {
      // server: SourcedTaskHandlers.createAssigned — once per resolution or invoice
      const kind = event.type === 'finance.invoice-opened' ? 'FINANCE_INVOICE' : 'RESOLUTION';
      const sourceId: string = data.resolutionId ?? data.invoiceId;
      const assignees = (data.assignees as string[])
        .filter((id) => this.people.members.data.some((m) => m.id === id && m.active))
        .sort()
        .slice(0, limits.maxAssignees);
      if (!assignees.length || Object.values(this.sources.data).some((x) => x.kind === kind && x.id === sourceId)) return;
      const task: StoredTask = {
        id: crypto.randomUUID(),
        teamId: null,
        appointmentId: null,
        title: String(data.title).slice(0, limits.titleMaxLength),
        description: data.description ?? null,
        status: 'OPEN',
        dueAt: data.dueAt ?? null,
        createdBy: data.createdBy ?? assignees[0],
        assignees,
        checklist: [],
        createdAt: new Date().toISOString(),
        completedAt: null,
        repeatWeeks: null,
        repeatMonths: null,
        repeatByWeekday: false,
        audience: NO_AUDIENCE,
        ...UNPLANNED,
      };
      this.tasks.data.push(task);
      this.sources.data[task.id] = { kind, id: sourceId };
      this.tasks.save();
      this.sources.save();
      this.changed(task, 'CREATED');
      this.assigned(task, []);
    }
  }

  private finish(kind: TaskSource['kind'], sourceId: string): void {
    const taskId = Object.entries(this.sources.data).find(([, s]) => s.kind === kind && s.id === sourceId)?.[0];
    const task = this.tasks.data.find((t) => t.id === taskId && t.status !== 'DONE');
    if (!task) return;
    task.status = 'DONE';
    task.stage = null;
    task.completedAt = new Date().toISOString();
    this.tasks.save();
    this.changed(task, 'STATUS');
  }

  /** server: Reminders.task / move — a deadline as a task once per key, its due date following the deadline while open. */
  deadline(key: string, title: string, description: string, dueAt: string, assignees: readonly string[]): void {
    const taskId = Object.entries(this.sources.data).find(([, s]) => s.kind === 'MEETING_REMINDER' && s.id === key)?.[0];
    const existing = this.tasks.data.find((t) => t.id === taskId);
    if (existing) {
      if (existing.status === 'DONE' || existing.dueAt === dueAt) return;
      existing.dueAt = dueAt;
      this.tasks.save();
      this.changed(existing, 'UPDATED');
      return;
    }
    const active = assignees
      .filter((id) => this.people.members.data.some((m) => m.id === id && m.active))
      .sort()
      .slice(0, limits.maxAssignees);
    if (!active.length) return;
    const task: StoredTask = {
      id: crypto.randomUUID(),
      teamId: null,
      appointmentId: null,
      title: title.slice(0, limits.titleMaxLength),
      description,
      status: 'OPEN',
      dueAt,
      createdBy: active[0],
      assignees: active,
      checklist: [],
      createdAt: new Date().toISOString(),
      completedAt: null,
      repeatWeeks: null,
      repeatMonths: null,
      repeatByWeekday: false,
      audience: NO_AUDIENCE,
      ...UNPLANNED,
    };
    this.tasks.data.push(task);
    this.sources.data[task.id] = { kind: 'MEETING_REMINDER', id: key };
    this.tasks.save();
    this.sources.save();
    this.changed(task, 'CREATED');
  }

  /** server: SourcedTaskHandlers.onMemberErased - change-request tasks go (done ones too), the member leaves every task. */
  private onMemberErased(memberId: string, changeRequestIds: string[]): void {
    for (const [taskId, source] of Object.entries(this.sources.data)) {
      if (source.kind !== 'CHANGE_REQUEST' || !changeRequestIds.includes(source.id)) continue;
      const task = this.tasks.data.find((t) => t.id === taskId);
      delete this.sources.data[taskId];
      if (!task) continue;
      this.changed(task, 'DELETED');
      this.tasks.data.splice(this.tasks.data.indexOf(task), 1);
      delete this.comments.data[taskId];
      mockServer.events.publish({ type: 'tasks.task-purged', data: { taskId } });
      mockServer.events.publish({ type: 'activity.purged', data: { kind: 'TASK', recordId: taskId } });
    }
    for (const task of this.tasks.data) {
      task.assignees = task.assignees.filter((id) => id !== memberId);
      task.audience = { ...task.audience, memberIds: task.audience.memberIds.filter((id) => id !== memberId) };
    }
    for (const table of [this.tasks, this.sources, this.comments]) table.save();
  }

  /** server: SourcedTaskHandlers.dropSourced — the record behind an open task is gone, so is the task. */
  deadlineDrop(key: string, kind: TaskSource['kind'] = 'MEETING_REMINDER'): void {
    const taskId = Object.entries(this.sources.data).find(([, s]) => s.kind === kind && s.id === key)?.[0];
    const index = this.tasks.data.findIndex((t) => t.id === taskId && t.status !== 'DONE');
    if (index < 0) return;
    const [task] = this.tasks.data.splice(index, 1);
    delete this.sources.data[task.id];
    this.tasks.save();
    this.sources.save();
    this.changed(task, 'DELETED');
  }

  /** server: REMINDER_DONE — the deadline is met. */
  deadlineDone(key: string): void {
    this.finish('MEETING_REMINDER', key);
  }

  /** server: TasksApi.MOVE_SOURCED — an open sourced task follows its record's due date. */
  moveSourced(kind: TaskSource['kind'], sourceId: string, dueAt: string): void {
    const taskId = Object.entries(this.sources.data).find(([, s]) => s.kind === kind && s.id === sourceId)?.[0];
    const task = this.tasks.data.find((t) => t.id === taskId && t.status !== 'DONE');
    if (!task || task.dueAt === dueAt) return;
    task.dueAt = dueAt;
    this.tasks.save();
    this.changed(task, 'UPDATED');
  }

  /** server: TasksApi.SOURCED — source id → task and its state. */
  sourced(kind: TaskSource['kind'], ids: readonly string[]): Record<string, { taskId: string; status: Task['status'] }> {
    const found: Record<string, { taskId: string; status: Task['status'] }> = {};
    for (const [taskId, source] of Object.entries(this.sources.data)) {
      const task = this.tasks.data.find((t) => t.id === taskId);
      if (task && source.kind === kind && ids.includes(source.id)) found[source.id] = { taskId, status: task.status };
    }
    return found;
  }

  /** "Benötigt" list and attachments (server: TaskHandlers.getLinks / setLinks). */
  readonly links = new MockLinks('task-links', () => ({
    't-3': {
      needs: [
        { itemId: 'i-pump', name: 'Ballpumpe mit Manometer', quantity: 1 },
        { itemId: 'i-training-balls', name: 'Trainingsbälle', quantity: 30 },
      ],
      files: [],
    },
  }));

  getLinks(member: Member, id: string) {
    return this.links.get(member, this.visible(this.viewer(member), id).id);
  }

  /** server: TaskHandlers.itemUses */
  itemUses(member: Member, itemId: string): ItemUse[] {
    const viewer = this.viewer(member);
    return this.links
      .owners(itemId)
      .flatMap(([id, quantity]) => {
        const t = this.tasks.data.find((x) => x.id === id);
        return t && viewer.canSee(t) && t.status !== 'DONE' ? [{ kind: 'TASK' as const, id: t.id, title: t.title, at: t.dueAt, quantity }] : [];
      })
      .sort(MockTasks.compareAt);
  }

  setLinks(member: Member, id: string, body: Record<string, unknown>) {
    const viewer = this.viewer(member);
    const task = this.visible(viewer, id);
    this.requireMayManage(viewer, task);
    const links = this.links.set(member, task.id, body);
    this.changed(task, 'UPDATED');
    MockActivity.record('TASK', task.id, member, 'UPDATED', { title: task.title, teamIds: task.teamId ? [task.teamId] : [] });
    return links;
  }

  list(
    member: Member,
    mine: boolean,
    teamId: string | null,
    includeDone: boolean,
    dueFrom: string | null = null,
    dueTo: string | null = null,
  ): Task[] {
    const viewer = this.viewer(member);
    if (teamId && !viewer.board && !viewer.teamIds.has(teamId)) fail(404, 'team.not-found');
    const [from, to] = [dueFrom ? Date.parse(dueFrom) : null, dueTo ? Date.parse(dueTo) : null];
    if (Number.isNaN(from) || Number.isNaN(to)) fail(400, 'request.invalid');
    if (from !== null && to !== null && from >= to) fail(400, 'task.range-invalid');
    const inRange = (t: StoredTask) =>
      (from === null || (t.dueAt !== null && Date.parse(t.dueAt) >= from)) && (to === null || (t.dueAt !== null && Date.parse(t.dueAt) < to));
    return this.tasks.data
      .filter(
        (t) =>
          viewer.canSee(t) && (!mine || viewer.assigned(t)) && (!teamId || t.teamId === teamId) && (includeDone || t.status !== 'DONE') && inRange(t),
      )
      .sort((a, b) => MockTasks.compareDue(a, b))
      .map((t) => this.dto(viewer, t, [], null));
  }

  get(member: Member, id: string): Task {
    const viewer = this.viewer(member);
    return this.withComments(viewer, this.visible(viewer, id));
  }

  create(member: Member, body: NewTask): Task {
    const viewer = this.viewer(member);
    const audience = MockTasks.audience(body.audience);
    if (body.teamId && hasAudience(audience)) fail(400, 'task.audience-invalid');
    this.requireMayManage(viewer, { teamId: body.teamId ?? null, audience, createdBy: member.id });
    this.requireValidAssignees(body.teamId ?? null, audience, body.assignees);
    const id = crypto.randomUUID();
    this.requireParent(viewer, id, body.parentId ?? null);
    const blockerIds = [...new Set(body.blockedBy ?? [])];
    this.requireBlockers(viewer, id, blockerIds);
    const now = new Date().toISOString();
    const task: StoredTask = MockTasks.validated({
      audience,
      id,
      teamId: body.teamId ?? null,
      appointmentId: body.appointmentId ?? null,
      title: body.title,
      description: body.description ?? null,
      status: 'OPEN',
      dueAt: body.dueAt ?? null,
      createdBy: member.id,
      assignees: [...new Set(body.assignees)],
      checklist: MockTasks.items(body.checklist ?? []),
      createdAt: now,
      completedAt: null,
      ...MockTasks.rhythm(body.repeatWeeks, body.repeatMonths, body.repeatByWeekday),
      stage: null,
      priority: body.priority ?? 'NORMAL',
      labels: this.requireLabels(body.labels ?? [], []),
      parentId: body.parentId ?? null,
      blockerIds,
    });
    this.tasks.data.push(task);
    this.tasks.save();
    this.changed(task, 'CREATED');
    MockActivity.record('TASK', task.id, member, 'CREATED', { title: task.title, teamIds: task.teamId ? [task.teamId] : [] });
    this.assigned(task, []);
    return this.withComments(viewer, task);
  }

  /** Null fields stay unchanged; a given checklist replaces the old one. */
  update(member: Member, id: string, patch: TaskPatch): Task {
    const viewer = this.viewer(member);
    const current = this.visible(viewer, id);
    this.requireMayManage(viewer, current);
    const audience = patch.audience ? MockTasks.audience(patch.audience) : current.audience;
    if (patch.audience && (!hasAudience(current.audience) || !hasAudience(audience))) fail(400, 'task.audience-invalid');
    if (patch.audience) this.requireMayManage(viewer, { teamId: null, audience, createdBy: current.createdBy });
    if (patch.assignees || patch.audience) this.requireValidAssignees(current.teamId, audience, patch.assignees ?? current.assignees);
    if (patch.clearDue && patch.dueAt) fail(400, 'task.due-conflict');
    if (!patch.clearParent) this.requireParent(viewer, current.id, patch.parentId ?? null);
    const labels = patch.labels ? this.requireLabels(patch.labels, current.labels) : current.labels;
    let blockerIds = current.blockerIds;
    if (patch.blockedBy) {
      this.requireBlockers(viewer, current.id, patch.blockedBy);
      // server: tasks the editor cannot see stay
      const hidden = current.blockerIds.filter((b) => !this.tasks.data.some((t) => t.id === b && viewer.canSee(t)));
      blockerIds = [...new Set([...patch.blockedBy, ...hidden])];
    }
    const previousAssignees = [...current.assignees];
    const next = MockTasks.validated({
      ...current,
      title: patch.title ?? current.title,
      description: patch.description ?? current.description,
      dueAt: patch.clearDue ? null : (patch.dueAt ?? current.dueAt),
      assignees: patch.assignees ? [...new Set(patch.assignees)] : current.assignees,
      audience,
      checklist: patch.checklist ? MockTasks.items(patch.checklist) : current.checklist,
      ...(patch.clearRepeat
        ? MockTasks.rhythm(null, null, false)
        : patch.repeatWeeks != null || patch.repeatMonths != null
          ? MockTasks.rhythm(patch.repeatWeeks, patch.repeatMonths, patch.repeatByWeekday)
          : {}),
      priority: patch.priority ?? current.priority,
      labels,
      parentId: patch.clearParent ? null : (patch.parentId ?? current.parentId),
      blockerIds,
    });
    Object.assign(current, next);
    this.tasks.save();
    this.changed(current, 'UPDATED', previousAssignees);
    MockActivity.record('TASK', current.id, member, 'UPDATED', { title: current.title, teamIds: current.teamId ? [current.teamId] : [] });
    this.assigned(current, previousAssignees);
    return this.withComments(viewer, current);
  }

  /** server: TaskHandlers.setStatus — a phase, or one of the club's stages (its phase follows). */
  setStatus(member: Member, id: string, body: { status?: unknown; stage?: unknown }): Task {
    const viewer = this.viewer(member);
    const task = this.workable(viewer, id);
    let status: TaskStatus;
    let stage: string | null;
    if (body.stage != null) {
      const found = this.stages.data.find((s) => s.key === body.stage && (!s.archived || s.key === task.stage));
      if (!found) return fail(400, 'task.stage-unknown');
      [status, stage] = [found.phase, found.key];
    } else if (STATUSES.includes(body.status as TaskStatus)) {
      status = body.status as TaskStatus;
      stage = status === task.status ? task.stage : null;
    } else return fail(400, 'task.stage-unknown');
    // server: finishing a repeating task creates the next one, same local time n weeks later.
    if (status === 'DONE' && task.status !== 'DONE' && (task.repeatWeeks || task.repeatMonths) && task.dueAt) {
      const next: StoredTask = {
        ...task,
        id: crypto.randomUUID(),
        appointmentId: null,
        status: 'OPEN',
        stage: null,
        blockerIds: [],
        dueAt: MockTasks.nextDue(task.dueAt, { weeks: task.repeatWeeks ?? 0, months: task.repeatMonths ?? 0, byWeekday: task.repeatByWeekday }),
        checklist: MockTasks.items(task.checklist.map((i) => i.text)),
        createdAt: new Date().toISOString(),
        completedAt: null,
      };
      this.tasks.data.push(next);
      // server: "Benötigt" and attachments come along
      const links = this.links.table.data[task.id];
      if (links) {
        this.links.table.data[next.id] = structuredClone(links);
        this.links.table.save();
      }
      Object.assign(task, MockTasks.rhythm(null, null, false));
      this.changed(next, 'CREATED');
      MockActivity.record('TASK', next.id, member, 'CREATED', { title: next.title, teamIds: next.teamId ? [next.teamId] : [] });
      this.assigned(next, []);
    }
    const finished = status === 'DONE' && task.status !== 'DONE';
    task.status = status;
    task.stage = stage;
    task.completedAt = status === 'DONE' ? (task.completedAt ?? new Date().toISOString()) : null;
    this.tasks.save();
    this.changed(task, 'STATUS');
    if (finished) this.notice('DONE', task, [task.createdBy], member);
    MockActivity.record('TASK', task.id, member, 'STATUS', { title: task.title, teamIds: task.teamId ? [task.teamId] : [], detail: task.status });
    return this.withComments(viewer, task);
  }

  check(member: Member, id: string, itemId: string, done: boolean): Task {
    const viewer = this.viewer(member);
    const task = this.workable(viewer, id);
    const item = task.checklist.find((i) => i.id === itemId);
    if (!item) return fail(404, 'task.checklist-item-not-found');
    item.done = !!done;
    this.tasks.save();
    this.changed(task, 'UPDATED');
    MockActivity.record('TASK', task.id, member, 'UPDATED', { title: task.title, teamIds: task.teamId ? [task.teamId] : [] });
    return this.withComments(viewer, task);
  }

  comment(member: Member, id: string, text: unknown): Task {
    const viewer = this.viewer(member);
    const task = this.visible(viewer, id);
    if (typeof text !== 'string' || !text.trim() || text.length > limits.commentMaxLength) return fail(400, 'task.comment-invalid');
    (this.comments.data[id] ??= []).push({ id: crypto.randomUUID(), authorId: member.id, text, createdAt: new Date().toISOString() });
    this.comments.save();
    this.changed(task, 'COMMENTED');
    this.notice('COMMENTED', task, [task.createdBy, ...task.assignees, ...this.people.guardiansOf(task.assignees)], member);
    MockActivity.record('TASK', task.id, member, 'COMMENTED', { title: task.title, teamIds: task.teamId ? [task.teamId] : [] });
    return this.withComments(viewer, task);
  }

  delete(member: Member, id: string): void {
    const viewer = this.viewer(member);
    const task = this.visible(viewer, id);
    this.requireMayManage(viewer, task);
    this.changed(task, 'DELETED'); // audience computed before the task is gone
    MockActivity.record('TASK', task.id, member, 'DELETED', { title: task.title, teamIds: task.teamId ? [task.teamId] : [] });
    this.tasks.data.splice(this.tasks.data.indexOf(task), 1);
    // server: parent_id ON DELETE SET NULL, tasks_dependency ON DELETE CASCADE
    for (const t of this.tasks.data) {
      if (t.parentId === id) t.parentId = null;
      t.blockerIds = t.blockerIds.filter((b) => b !== id);
    }
    delete this.comments.data[id];
    this.links.remove(id);
    this.tasks.save();
    this.comments.save();
  }

  /** server: TasksApi.TaskChanged, pushed to everyone who sees the task (and previous assignees) */
  private changed(task: StoredTask, change: string, previousAssignees: readonly string[] = []): void {
    const members = new Set([...task.assignees, ...previousAssignees, task.createdBy, ...this.people.guardiansOf(task.assignees)]);
    if (task.teamId) this.people.teamMembers(task.teamId).forEach((m) => members.add(m));
    this.pool(task.audience).forEach((m) => members.add(m));
    mockServer.events.publish({
      type: 'tasks.task-changed',
      data: { taskId: task.id, teamId: task.teamId, change },
      audience: task.audience.everyone ? { everyone: true } : { members: [...members], roles: ['ADMIN', 'BOARD'] },
    });
  }

  /** server: TasksApi.TaskAssigned (internal, for notifications): only newly assigned members */
  private assigned(task: StoredTask, previousAssignees: readonly string[]): void {
    const added = task.assignees.filter((id) => !previousAssignees.includes(id));
    if (!added.length) return;
    // server: guardians of minors among the new assignees hear too
    const memberIds = [...new Set([...added, ...this.people.guardiansOf(added)])];
    mockServer.events.publish({ type: 'tasks.task-assigned', data: { taskId: task.id, title: task.title, dueAt: task.dueAt, memberIds } });
  }

  /** server: TaskPublisher.notice — comments and completion to those involved, never to who did it. */
  private notice(kind: 'COMMENTED' | 'DONE', task: StoredTask, recipients: string[], actor: Member): void {
    const to = [...new Set(recipients)].filter((id) => id !== actor.id);
    if (!to.length) return;
    mockServer.events.publish({
      type: 'tasks.task-notice',
      data: { kind, taskId: task.id, title: task.title, dueAt: task.dueAt, recipients: to, name: `${actor.firstName} ${actor.lastName}` },
    });
  }

  private viewer(member: Member): Viewer {
    return new Viewer(member, this.people);
  }

  private visible(viewer: Viewer, id: string): StoredTask {
    const task = this.tasks.data.find((t) => t.id === id);
    if (!task || !viewer.canSee(task)) return fail(404, 'task.not-found');
    return task;
  }

  private workable(viewer: Viewer, id: string): StoredTask {
    const task = this.visible(viewer, id);
    if (!viewer.canWork(task)) fail(403, 'access.denied');
    return task;
  }

  /** server: TaskHandlers.mayManage — the board; coaches of the team; a coach their own task for chosen people. */
  private mayManage(viewer: Viewer, task: Pick<StoredTask, 'teamId' | 'audience' | 'createdBy'>): boolean {
    if (viewer.board) return true;
    if (task.teamId !== null) return viewer.coachTeamIds.has(task.teamId);
    return isChosen(task.audience) && viewer.member.roles.includes('COACH') && task.createdBy === viewer.member.id;
  }

  private requireMayManage(viewer: Viewer, task: Pick<StoredTask, 'teamId' | 'audience' | 'createdBy'>): void {
    if (viewer.board) this.people.requirePrivileged(viewer.member, ['ADMIN', 'BOARD']);
    else if (!this.mayManage(viewer, task)) fail(403, 'access.denied');
  }

  /** server: TaskHandlers.requireValidAssignees */
  private requireValidAssignees(teamId: string | null, audience: Reach, assignees: readonly string[] | undefined): void {
    if (!assignees?.length) return fail(400, 'task.assignees-invalid');
    if (assignees.some((id) => !this.people.name(id))) fail(400, 'task.assignee-unknown');
    if (teamId && assignees.some((id) => !(teamId in this.people.teamRoles(id)))) fail(400, 'task.assignee-not-in-team');
    if (hasAudience(audience)) {
      const pool = this.pool(audience);
      if (assignees.some((id) => !pool.has(id))) fail(400, 'task.assignee-not-in-audience');
    }
  }

  /** server: TaskPublisher.pool — active members (no guests) the audience reaches. */
  private pool(a: Reach): Set<string> {
    return new Set(this.people.reachPool(a));
  }

  /** server: TaskHandlers.audienceMembers — admin, board and coaches. */
  audienceMembers(member: Member, body: unknown): { memberIds: string[] } {
    if (!member.roles.some((r) => r === 'ADMIN' || r === 'BOARD' || r === 'COACH')) fail(403, 'access.denied');
    return { memberIds: [...this.pool(MockTasks.audience(body))] };
  }

  /** server: Reach (null lists = empty) and TaskHandlers.requireValidAudience. */
  private static audience(body: unknown): Reach {
    return MockDirectory.parseReach(body, 'task.audience-invalid');
  }

  private withComments(viewer: Viewer, task: StoredTask): Task {
    return this.dto(viewer, task, [...(this.comments.data[task.id] ?? [])], this.sources.data[task.id] ?? null);
  }

  /** server: TaskHandlers.toDto with Related — the effective stage and the related tasks the reader sees. */
  private dto(viewer: Viewer, task: StoredTask, comments: TaskComment[], source: TaskSource | null): Task {
    const { parentId, blockerIds, ...rest } = task;
    const seen = (id: string | null) => this.tasks.data.find((t) => t.id === id && viewer.canSee(t));
    const link = (t: StoredTask): TaskLink => ({ id: t.id, title: t.title, status: t.status });
    const parent = seen(parentId);
    return {
      ...rest,
      stage: this.stageOf(task),
      labels: [...task.labels].sort(),
      parent: parent ? link(parent) : null,
      subtasks: this.tasks.data.filter((t) => t.parentId === task.id && viewer.canSee(t)).map(link),
      blockedBy: blockerIds
        .flatMap((id) => seen(id) ?? [])
        .sort((a, b) => a.title.localeCompare(b.title))
        .map(link),
      comments,
      source,
    };
  }

  /** server: Related.stageOf — the stored stage, else the first of the phase (active ones first). */
  private stageOf(task: StoredTask): string {
    if (task.stage) return task.stage;
    const ofPhase = this.stages.data.filter((s) => s.phase === task.status);
    return (ofPhase.find((s) => !s.archived) ?? ofPhase[0])?.key ?? task.status;
  }

  /** server: TaskHandlers.requireLabels — known ones; archived ones only where the task carries them already. */
  private requireLabels(wanted: readonly string[], kept: readonly string[]): string[] {
    const allowed = this.labels.data.filter((l) => !l.archived || kept.includes(l.key)).map((l) => l.key);
    if (wanted.length > MAX_LABELS || wanted.some((k) => !allowed.includes(k))) fail(400, 'task.labels-invalid');
    return [...new Set(wanted)];
  }

  /** server: TaskHandlers.requireParent — a visible task that is no subtask itself; the task has no subtasks (one level). */
  private requireParent(viewer: Viewer, taskId: string, parentId: string | null): void {
    if (!parentId) return;
    const parent = this.tasks.data.find((t) => t.id === parentId && viewer.canSee(t));
    if (!parent || parent.parentId !== null || parent.id === taskId || this.tasks.data.some((t) => t.parentId === taskId)) {
      fail(400, 'task.parent-invalid');
    }
  }

  /** server: TaskHandlers.requireBlockers — visible, at most 20, not itself, no circle. */
  private requireBlockers(viewer: Viewer, taskId: string, blockedBy: readonly string[]): void {
    const found = blockedBy.filter((id) => this.tasks.data.some((t) => t.id === id && viewer.canSee(t)));
    if (blockedBy.length > MAX_BLOCKERS || blockedBy.includes(taskId) || found.length !== new Set(blockedBy).size) fail(400, 'task.blockers-invalid');
    const seen = new Set(blockedBy);
    let frontier = [...blockedBy];
    while (frontier.length) {
      const next = frontier.flatMap((id) => this.tasks.data.find((t) => t.id === id)?.blockerIds ?? []);
      if (next.includes(taskId)) fail(400, 'task.blockers-cycle');
      frontier = next.filter((id) => !seen.has(id) && seen.add(id));
    }
  }

  /** server: TaskCatalogHandlers — every member reads; admin and board change; used entries are archived, not deleted. */
  stageList(): TaskStage[] {
    return [...this.stages.data]
      .sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label))
      .map((s) => ({ ...s, inUse: this.tasks.data.some((t) => t.stage === s.key) }));
  }

  labelList(): TaskLabel[] {
    return [...this.labels.data]
      .sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label))
      .map((l) => ({ ...l, inUse: this.tasks.data.some((t) => t.labels.includes(l.key)) }));
  }

  saveStage(member: Member, key: string | null, body: Record<string, unknown>): TaskStage {
    this.people.requirePrivileged(member, ADMIN_BOARD);
    const stage = { key: key ?? MockTasks.generatedKey('STAGE'), ...MockTasks.catalogEntry(body, 'task-stage.invalid') } as StoredStage;
    if (!STATUSES.includes(body.phase as TaskStatus)) fail(400, 'request.invalid');
    stage.phase = body.phase as TaskStatus;
    const index = this.stages.data.findIndex((s) => s.key === key);
    if (key && index < 0) fail(404, 'task-stage.not-found');
    if (key && this.stages.data[index].phase !== stage.phase && this.tasks.data.some((t) => t.stage === key)) {
      fail(409, 'task-stage.phase-fixed');
    }
    const next = key ? this.stages.data.map((s, i) => (i === index ? stage : s)) : [...this.stages.data, stage];
    MockTasks.requireEveryPhase(next);
    this.stages.data.splice(0, this.stages.data.length, ...next);
    this.stages.save();
    this.catalogChanged();
    return { ...stage, inUse: this.tasks.data.some((t) => t.stage === stage.key) };
  }

  deleteStage(member: Member, key: string): void {
    this.people.requirePrivileged(member, ADMIN_BOARD);
    if (!this.stages.data.some((s) => s.key === key)) fail(404, 'task-stage.not-found');
    if (this.tasks.data.some((t) => t.stage === key)) fail(409, 'task-stage.in-use');
    const next = this.stages.data.filter((s) => s.key !== key);
    MockTasks.requireEveryPhase(next);
    this.stages.data.splice(0, this.stages.data.length, ...next);
    this.stages.save();
    this.catalogChanged();
  }

  saveLabel(member: Member, key: string | null, body: Record<string, unknown>): TaskLabel {
    this.people.requirePrivileged(member, ADMIN_BOARD);
    const label = { key: key ?? MockTasks.generatedKey('LABEL'), ...MockTasks.catalogEntry(body, 'task-label.invalid') } as StoredLabel;
    const index = this.labels.data.findIndex((l) => l.key === key);
    if (key && index < 0) fail(404, 'task-label.not-found');
    if (key) this.labels.data[index] = label;
    else this.labels.data.push(label);
    this.labels.save();
    this.catalogChanged();
    return { ...label, inUse: this.tasks.data.some((t) => t.labels.includes(label.key)) };
  }

  deleteLabel(member: Member, key: string): void {
    this.people.requirePrivileged(member, ADMIN_BOARD);
    const index = this.labels.data.findIndex((l) => l.key === key);
    if (index < 0) fail(404, 'task-label.not-found');
    if (this.tasks.data.some((t) => t.labels.includes(key))) fail(409, 'task-label.in-use');
    this.labels.data.splice(index, 1);
    this.labels.save();
    this.catalogChanged();
  }

  private catalogChanged(): void {
    mockServer.events.publish({ type: 'tasks.catalog-changed', data: {}, audience: { everyone: true } });
  }

  /** server: TaskStage.requireEveryPhase — each phase keeps an active stage. */
  private static requireEveryPhase(stages: readonly StoredStage[]): void {
    if (STATUSES.some((phase) => !stages.some((s) => s.phase === phase && !s.archived))) fail(400, 'task-stage.phase-empty');
  }

  /** server: TaskLabel.requireCatalogEntry */
  private static catalogEntry(body: Record<string, unknown>, code: string) {
    const label = typeof body.label === 'string' ? body.label.trim() : '';
    const sort = Number(body.sort);
    if (!label || label.length > 40 || !HUES.includes(body.hue as never) || !Number.isInteger(sort) || sort < 0 || sort > 1000) fail(400, code);
    return { label, hue: body.hue, sort, archived: body.archived === true };
  }

  /** server: Keys.generated */
  private static generatedKey(prefix: string): string {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
  }

  /** server: Task constructor checks */
  private static items(texts: readonly string[]) {
    return texts.map((text) => ({ id: crypto.randomUUID(), text, done: false }));
  }

  private static validated(task: StoredTask): StoredTask {
    if (!task.title?.trim() || task.title.length > limits.titleMaxLength) fail(400, 'task.title-invalid');
    if ((task.description?.length ?? 0) > limits.descriptionMaxLength) fail(400, 'task.description-too-long');
    if (task.assignees.length === 0 || task.assignees.length > limits.maxAssignees) fail(400, 'task.assignees-invalid');
    if (task.checklist.length > limits.maxChecklistItems) fail(400, 'task.checklist-too-long');
    if (task.checklist.some((i) => !i.text.trim() || i.text.length > limits.checklistItemMaxLength)) fail(400, 'task.checklist-item-invalid');
    if (task.dueAt !== null && isNaN(Date.parse(task.dueAt))) fail(400, 'request.invalid');
    const { repeatWeeks: weeks, repeatMonths: months } = task;
    if (weeks != null && (weeks < 1 || weeks > 12 || task.repeatByWeekday)) fail(400, 'task.repeat-invalid');
    if (months != null && (months < 1 || months > 12)) fail(400, 'task.repeat-invalid');
    if ((weeks ?? months) != null && task.dueAt === null) fail(400, 'task.repeat-needs-due');
    if (!PRIORITIES.includes(task.priority)) fail(400, 'request.invalid');
    if (task.parentId === task.id) fail(400, 'task.parent-invalid');
    return { ...task, title: task.title.trim(), description: task.description || null };
  }

  /** server: Task.repeat — weeks or months, not both. */
  private static rhythm(weeks: unknown, months: unknown, byWeekday: unknown): Pick<Task, 'repeatWeeks' | 'repeatMonths' | 'repeatByWeekday'> {
    if (weeks != null && months != null) fail(400, 'task.repeat-invalid');
    return {
      repeatWeeks: (weeks as number) ?? null,
      repeatMonths: (months as number) ?? null,
      repeatByWeekday: months != null && byWeekday === true,
    };
  }

  /** server: Task.nextOccurrence — the first due date in the rhythm still ahead (done late: not an overdue one), same local time. */
  private static nextDue(dueAt: string, rhythm: Rhythm): string {
    const clock = directory.clock;
    const anchor = clock.toLocal(dueAt);
    for (let i = 1; ; i++) {
      const next = clock.toInstant(repeatAt(anchor, rhythm, i));
      if (Date.parse(next) > Date.now()) return next;
    }
  }

  /** By date, undated last. */
  static compareAt(a: { at: string | null }, b: { at: string | null }): number {
    if (a.at === b.at) return 0;
    if (a.at === null) return 1;
    if (b.at === null) return -1;
    return a.at.localeCompare(b.at);
  }

  /** ORDER BY due_at NULLS LAST, created_at */
  private static compareDue(a: StoredTask, b: StoredTask): number {
    if (a.dueAt !== b.dueAt) {
      if (a.dueAt === null) return 1;
      if (b.dueAt === null) return -1;
      return a.dueAt.localeCompare(b.dueAt);
    }
    return a.createdAt.localeCompare(b.createdAt);
  }

  private seedTasks(): StoredTask[] {
    const day = 86_400_000;
    const at = (days: number) => new Date(Date.now() + days * day).toISOString();
    const base = {
      appointmentId: null,
      completedAt: null,
      createdAt: at(-5),
      repeatWeeks: null as number | null,
      repeatMonths: null as number | null,
      repeatByWeekday: false,
      audience: NO_AUDIENCE,
      ...UNPLANNED,
    };
    const items = (...entries: [string, boolean][]) => entries.map(([text, done], i) => ({ id: `ci-${text.length}-${i}`, text, done }));
    return [
      {
        ...base,
        id: 't-1',
        teamId: 't-damen',
        title: 'Trikots waschen',
        description: 'Satz für das Heimspiel, bitte bis Freitag zurück in die Halle.',
        status: 'OPEN',
        dueAt: at(0.5),
        createdBy: 'trainer',
        assignees: ['spielerin'],
        checklist: [],
      },
      {
        ...base,
        id: 't-2',
        teamId: 't-damen',
        title: 'Fahrgemeinschaft Auswärtsspiel',
        description: null,
        status: 'IN_PROGRESS',
        dueAt: at(6),
        createdBy: 'trainer',
        assignees: ['spielerin', 'neu'],
        checklist: items(['Fahrer:innen fragen', true], ['Treffpunkt festlegen', false], ['Liste in die Gruppe schicken', false]),
      },
      {
        ...base,
        id: 't-3',
        teamId: 't-u16',
        title: 'Bälle aufpumpen',
        description: null,
        status: 'OPEN',
        dueAt: at(-1),
        repeatWeeks: 1,
        createdBy: 'trainer',
        assignees: ['spieler'],
        checklist: [],
      },
      {
        ...base,
        id: 't-4',
        teamId: null,
        title: 'Kassenbericht vorbereiten',
        description: 'Für die Mitgliederversammlung.',
        status: 'OPEN',
        dueAt: at(12),
        createdBy: 'admin',
        assignees: ['vorstand'],
        checklist: items(['Belege sammeln', false], ['Bericht schreiben', false]),
      },
      {
        ...base,
        id: 't-5',
        teamId: null,
        title: 'Hallenzeiten für die neue Saison anfragen',
        description: null,
        status: 'DONE',
        dueAt: at(-10),
        createdBy: 'vorstand',
        assignees: ['vorstand'],
        checklist: [],
        completedAt: at(-11),
        audience: EVERYONE,
      },
      {
        ...base,
        id: 't-6',
        teamId: 't-damen',
        title: 'Spielberichtsbogen besorgen',
        description: null,
        status: 'OPEN',
        dueAt: null,
        createdBy: 'admin',
        assignees: ['trainer'],
        checklist: [],
      },
      {
        ...base,
        id: 't-7',
        teamId: null,
        title: 'Termine für die Trainer:innen-Fortbildung sammeln',
        description: null,
        status: 'OPEN',
        dueAt: at(9),
        createdBy: 'vorstand',
        assignees: ['trainer'],
        checklist: [],
        audience: { ...NO_AUDIENCE, roles: ['COACH'] },
      },
    ];
  }

  private seedComments(): Record<string, TaskComment[]> {
    const at = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
    return {
      't-2': [
        { id: 'c-1', authorId: 'trainer', text: 'Wer kann am Samstag fahren?', createdAt: at(30) },
        { id: 'c-2', authorId: 'spielerin', text: 'Ich habe Platz für drei Personen.', createdAt: at(5) },
      ],
    };
  }
}

export const tasks = new MockTasks(directory);
// server: TaskRepository.personalData
personalData.set('tasks', (memberId) => ({
  assigned: tasks.tasks.data
    .filter((t) => t.assignees.includes(memberId))
    .map(({ id, title, description, status, dueAt }) => ({ id, title, description, status, dueAt })),
  created: tasks.tasks.data.filter((t) => t.createdBy === memberId).map(({ id, title, status }) => ({ id, title, status })),
}));

itemUseSources.push((member, itemId) => tasks.itemUses(member, itemId));

const actor = (req: MockRequest) => directory.actor(req);
const flag = (req: MockRequest, name: string) => req.query.get(name) === 'true';

mockServer
  .on('GET', '/api/v1/tasks/settings', (req) => (actor(req), tasks.taskSettings()))
  .on('PUT', '/api/v1/tasks/settings', (req) => {
    const result = tasks.saveTaskSettings(actor(req), req.body ?? {});
    mockServer.events.publish({ type: 'tasks.settings-changed', data: {}, audience: { everyone: true } });
    return result;
  })
  .on('GET', '/api/v1/tasks/stages', (req) => (actor(req), { items: tasks.stageList() }))
  .on('POST', '/api/v1/tasks/stages', (req) => tasks.saveStage(actor(req), null, req.body ?? {}))
  .on('PUT', '/api/v1/tasks/stages/:key', (req) => tasks.saveStage(actor(req), req.params.key, req.body ?? {}))
  .on('DELETE', '/api/v1/tasks/stages/:key', (req) => tasks.deleteStage(actor(req), req.params.key))
  .on('GET', '/api/v1/tasks/labels', (req) => (actor(req), { items: tasks.labelList() }))
  .on('POST', '/api/v1/tasks/labels', (req) => tasks.saveLabel(actor(req), null, req.body ?? {}))
  .on('PUT', '/api/v1/tasks/labels/:key', (req) => tasks.saveLabel(actor(req), req.params.key, req.body ?? {}))
  .on('DELETE', '/api/v1/tasks/labels/:key', (req) => tasks.deleteLabel(actor(req), req.params.key))
  .on('GET', '/api/v1/tasks/:id/activity', (req) => activity.list(actor(req), 'TASK', tasks.get(actor(req), req.params.id).id))
  .on('GET', '/api/v1/tasks', (req) => {
    const found = tasks.list(
      actor(req),
      flag(req, 'mine'),
      req.query.get('teamId'),
      flag(req, 'includeDone'),
      req.query.get('dueFrom'),
      req.query.get('dueTo'),
    );
    return { items: found.slice(0, 1000), truncated: found.length > 1000 }; // server: TaskRepository.MAX_LIST
  })
  .on('POST', '/api/v1/tasks', (req) => tasks.create(actor(req), req.body ?? {}))
  .on('POST', '/api/v1/tasks/audience-members', (req) => tasks.audienceMembers(actor(req), req.body))
  .on('GET', '/api/v1/tasks/:id', (req) => tasks.get(actor(req), req.params.id))
  .on('PATCH', '/api/v1/tasks/:id', (req) => tasks.update(actor(req), req.params.id, req.body ?? {}))
  .on('PUT', '/api/v1/tasks/:id/status', (req) => tasks.setStatus(actor(req), req.params.id, req.body ?? {}))
  .on('PUT', '/api/v1/tasks/:id/checklist/:itemId', (req) => tasks.check(actor(req), req.params.id, req.params.itemId, req.body?.done))
  .on('POST', '/api/v1/tasks/:id/comments', (req) => tasks.comment(actor(req), req.params.id, req.body?.text))
  .on('DELETE', '/api/v1/tasks/:id', (req) => tasks.delete(actor(req), req.params.id))
  .on('GET', '/api/v1/tasks/:id/links', (req) => tasks.getLinks(actor(req), req.params.id))
  .on('PUT', '/api/v1/tasks/:id/links', (req) => tasks.setLinks(actor(req), req.params.id, req.body ?? {}));
