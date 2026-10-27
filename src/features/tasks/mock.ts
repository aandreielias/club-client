// Mock of the club-server tasks module (TaskHandlers): visibility, work and manage rights, validation.
import { activity, MockActivity } from '../../lib/mock/MockActivity';
import { settings } from '../../settings';
import { directory, type MockDirectory } from '../../lib/mock/core';
import { itemUseSources, MockLinks, type ItemUse } from '../../lib/mock/MockLinks';
import { MockServer, mockServer, type MockRequest } from '../../lib/mock/MockServer';
import { MockTable } from '../../lib/mock/MockTable';
import type { Member } from '../../lib/types';
import { ZonedClock } from '../../lib/time/ZonedClock';
import type { NewTask, Task, TaskComment, TaskPatch, TaskSource, TaskStatus } from './model';
import type { MockEvent } from '../../lib/mock/MockEventBus';
import { ADMIN_BOARD } from '../../lib/types';
import { CHANGE_FIELD_LABELS, type ChangeField } from '../members/MembersApi';

type StoredTask = Omit<Task, 'comments' | 'source'>;

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

  constructor(readonly member: Member, people: MockDirectory) {
    const own = people.teamRoles(member.id);
    this.board = people.isManager(member);
    this.teamIds = new Set(Object.keys(own));
    this.coachTeamIds = new Set(Object.keys(own).filter((team) => own[team] === 'COACH'));
    this.self = new Set([member.id, ...people.wardsOf(member.id)]);
  }

  assigned(task: StoredTask): boolean {
    return task.assignees.some((id) => this.self.has(id));
  }

  canSee(task: StoredTask): boolean {
    return this.board || task.createdBy === this.member.id || this.assigned(task) || (task.teamId !== null && this.teamIds.has(task.teamId));
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

  constructor(private readonly people: MockDirectory) {
    this.tasks = new MockTable('tasks', () => this.seedTasks());
    this.comments = new MockTable('task-comments', () => this.seedComments());
    mockServer.events.subscribe((event) => this.onEvent(event));
  }

  /** server: TaskHandlers.onChangeRequested / onChangeDecided */
  private onEvent(event: MockEvent): void {
    const data = event.data as Record<string, any>;
    if (event.type === 'members.change-requested') {
      const managers = this.people.audienceIds({ roles: ADMIN_BOARD }).sort().slice(0, limits.maxAssignees);
      if (!managers.length) return;
      const task: StoredTask = {
        id: crypto.randomUUID(), teamId: null, appointmentId: null,
        title: `Kontoänderung: ${data.memberName} – ${CHANGE_FIELD_LABELS[data.field as ChangeField]}`.slice(0, limits.titleMaxLength),
        description: `Neuer Wert: ${data.newValue}`, status: 'OPEN', dueAt: null, createdBy: managers[0], assignees: managers,
        checklist: [], createdAt: new Date().toISOString(), completedAt: null, repeatWeeks: null,
      };
      this.tasks.data.push(task);
      this.sources.data[task.id] = { kind: 'CHANGE_REQUEST', id: data.requestId };
      this.tasks.save();
      this.sources.save();
      this.changed(task, 'CREATED');
      this.assigned(task, []);
    } else if (event.type === 'members.change-decided') {
      this.finish('CHANGE_REQUEST', data.requestId);
    } else if (event.type === 'meetings.follow-up-created') {
      // server: TaskHandlers.onFollowUpCreated
      const assignees = (data.assignees as string[]).filter((id) => this.people.members.data.some((m) => m.id === id && m.active)).sort()
        .slice(0, limits.maxAssignees);
      if (!assignees.length) return;
      const task: StoredTask = {
        id: crypto.randomUUID(), teamId: null, appointmentId: null, title: String(data.title).slice(0, limits.titleMaxLength),
        description: data.description ?? null, status: 'OPEN', dueAt: data.dueAt ?? null, createdBy: data.createdBy ?? assignees[0], assignees,
        checklist: [], createdAt: new Date().toISOString(), completedAt: null, repeatWeeks: null,
      };
      this.tasks.data.push(task);
      this.sources.data[task.id] = { kind: 'MEETING_FOLLOW_UP', id: data.followUpId };
      this.tasks.save();
      this.sources.save();
      this.changed(task, 'CREATED');
      this.assigned(task, []);
    } else if (event.type === 'meetings.follow-up-done') {
      this.finish('MEETING_FOLLOW_UP', data.followUpId);
    }
  }

  private finish(kind: TaskSource['kind'], sourceId: string): void {
    const taskId = Object.entries(this.sources.data).find(([, s]) => s.kind === kind && s.id === sourceId)?.[0];
    const task = this.tasks.data.find((t) => t.id === taskId && t.status !== 'DONE');
    if (!task) return;
    task.status = 'DONE';
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
    const active = assignees.filter((id) => this.people.members.data.some((m) => m.id === id && m.active)).sort().slice(0, limits.maxAssignees);
    if (!active.length) return;
    const task: StoredTask = {
      id: crypto.randomUUID(), teamId: null, appointmentId: null, title: title.slice(0, limits.titleMaxLength), description, status: 'OPEN', dueAt,
      createdBy: active[0], assignees: active, checklist: [], createdAt: new Date().toISOString(), completedAt: null, repeatWeeks: null,
    };
    this.tasks.data.push(task);
    this.sources.data[task.id] = { kind: 'MEETING_REMINDER', id: key };
    this.tasks.save();
    this.sources.save();
    this.changed(task, 'CREATED');
  }

  /** server: REMINDER_DROPPED — the record behind an open deadline task is gone, so is the task. */
  deadlineDrop(key: string): void {
    const taskId = Object.entries(this.sources.data).find(([, s]) => s.kind === 'MEETING_REMINDER' && s.id === key)?.[0];
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
    't-3': { needs: [{ itemId: 'i-pump', name: 'Ballpumpe mit Manometer', quantity: 1 }, { itemId: 'i-training-balls', name: 'Trainingsbälle', quantity: 30 }], files: [] },
  }));

  getLinks(member: Member, id: string) {
    return this.links.get(member, this.visible(this.viewer(member), id).id);
  }

  /** server: TaskHandlers.itemUses */
  itemUses(member: Member, itemId: string): ItemUse[] {
    const viewer = this.viewer(member);
    return this.links.owners(itemId)
      .flatMap(([id, quantity]) => {
        const t = this.tasks.data.find((x) => x.id === id);
        return t && viewer.canSee(t) && t.status !== 'DONE' ? [{ kind: 'TASK' as const, id: t.id, title: t.title, at: t.dueAt, quantity }] : [];
      })
      .sort(MockTasks.compareAt);
  }

  setLinks(member: Member, id: string, body: Record<string, unknown>) {
    const viewer = this.viewer(member);
    const task = this.visible(viewer, id);
    this.requireMayManage(viewer, task.teamId);
    const links = this.links.set(member, task.id, body);
    this.changed(task, 'UPDATED');
    MockActivity.record('TASK', task.id, member, 'UPDATED', { title: task.title, teamIds: task.teamId ? [task.teamId] : [] });
    return links;
  }

  list(member: Member, mine: boolean, teamId: string | null, includeDone: boolean, dueFrom: string | null = null, dueTo: string | null = null): Task[] {
    const viewer = this.viewer(member);
    if (teamId && !viewer.board && !viewer.teamIds.has(teamId)) fail(404, 'team.not-found');
    const [from, to] = [dueFrom ? Date.parse(dueFrom) : null, dueTo ? Date.parse(dueTo) : null];
    if (Number.isNaN(from) || Number.isNaN(to)) fail(400, 'request.invalid');
    if (from !== null && to !== null && from >= to) fail(400, 'task.range-invalid');
    const inRange = (t: StoredTask) =>
      (from === null || (t.dueAt !== null && Date.parse(t.dueAt) >= from)) && (to === null || (t.dueAt !== null && Date.parse(t.dueAt) < to));
    return this.tasks.data
      .filter((t) => viewer.canSee(t) && (!mine || viewer.assigned(t)) && (!teamId || t.teamId === teamId) && (includeDone || t.status !== 'DONE') && inRange(t))
      .sort((a, b) => MockTasks.compareDue(a, b))
      .map((t) => ({ ...t, comments: [], source: null }));
  }

  get(member: Member, id: string): Task {
    return this.withComments(this.visible(this.viewer(member), id));
  }

  create(member: Member, body: NewTask): Task {
    const viewer = this.viewer(member);
    this.requireMayManage(viewer, body.teamId ?? null);
    this.requireValidAssignees(body.teamId ?? null, body.assignees);
    const now = new Date().toISOString();
    const task: StoredTask = MockTasks.validated({
      id: crypto.randomUUID(),
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
      repeatWeeks: body.repeatWeeks ?? null,
    });
    this.tasks.data.push(task);
    this.tasks.save();
    this.changed(task, 'CREATED');
    MockActivity.record('TASK', task.id, member, 'CREATED', { title: task.title, teamIds: task.teamId ? [task.teamId] : [] });
    this.assigned(task, []);
    return { ...task, comments: [], source: null };
  }

  /** Null fields stay unchanged; a given checklist replaces the old one. */
  update(member: Member, id: string, patch: TaskPatch): Task {
    const viewer = this.viewer(member);
    const current = this.visible(viewer, id);
    this.requireMayManage(viewer, current.teamId);
    if (patch.assignees) this.requireValidAssignees(current.teamId, patch.assignees);
    if (patch.clearDue && patch.dueAt) fail(400, 'task.due-conflict');
    const previousAssignees = [...current.assignees];
    const next = MockTasks.validated({
      ...current,
      title: patch.title ?? current.title,
      description: patch.description ?? current.description,
      dueAt: patch.clearDue ? null : (patch.dueAt ?? current.dueAt),
      assignees: patch.assignees ? [...new Set(patch.assignees)] : current.assignees,
      checklist: patch.checklist ? MockTasks.items(patch.checklist) : current.checklist,
      repeatWeeks: patch.clearRepeat ? null : (patch.repeatWeeks ?? current.repeatWeeks ?? null),
    });
    Object.assign(current, next);
    this.tasks.save();
    this.changed(current, 'UPDATED', previousAssignees);
    MockActivity.record('TASK', current.id, member, 'UPDATED', { title: current.title, teamIds: current.teamId ? [current.teamId] : [] });
    this.assigned(current, previousAssignees);
    return this.withComments(current);
  }

  setStatus(member: Member, id: string, status: unknown): Task {
    if (!STATUSES.includes(status as TaskStatus)) return fail(400, 'request.invalid');
    const task = this.workable(this.viewer(member), id);
    // server: finishing a repeating task creates the next one, same local time n weeks later.
    if (status === 'DONE' && task.status !== 'DONE' && task.repeatWeeks && task.dueAt) {
      const next: StoredTask = {
        ...task,
        id: crypto.randomUUID(),
        appointmentId: null,
        status: 'OPEN',
        dueAt: MockTasks.weeksLater(task.dueAt, task.repeatWeeks),
        checklist: MockTasks.items(task.checklist.map((i) => i.text)),
        createdAt: new Date().toISOString(),
        completedAt: null,
      };
      this.tasks.data.push(next);
      task.repeatWeeks = null;
      this.changed(next, 'CREATED');
      MockActivity.record('TASK', next.id, member, 'CREATED', { title: next.title, teamIds: next.teamId ? [next.teamId] : [] });
      this.assigned(next, []);
    }
    task.status = status as TaskStatus;
    task.completedAt = status === 'DONE' ? (task.completedAt ?? new Date().toISOString()) : null;
    this.tasks.save();
    this.changed(task, 'STATUS');
    MockActivity.record('TASK', task.id, member, 'STATUS', { title: task.title, teamIds: task.teamId ? [task.teamId] : [], detail: task.status });
    return this.withComments(task);
  }

  check(member: Member, id: string, itemId: string, done: boolean): Task {
    const task = this.workable(this.viewer(member), id);
    const item = task.checklist.find((i) => i.id === itemId);
    if (!item) return fail(404, 'task.checklist-item-not-found');
    item.done = !!done;
    this.tasks.save();
    this.changed(task, 'UPDATED');
    MockActivity.record('TASK', task.id, member, 'UPDATED', { title: task.title, teamIds: task.teamId ? [task.teamId] : [] });
    return this.withComments(task);
  }

  comment(member: Member, id: string, text: unknown): Task {
    const task = this.visible(this.viewer(member), id);
    if (typeof text !== 'string' || !text.trim() || text.length > limits.commentMaxLength) return fail(400, 'task.comment-invalid');
    (this.comments.data[id] ??= []).push({ id: crypto.randomUUID(), authorId: member.id, text, createdAt: new Date().toISOString() });
    this.comments.save();
    this.changed(task, 'COMMENTED');
    MockActivity.record('TASK', task.id, member, 'COMMENTED', { title: task.title, teamIds: task.teamId ? [task.teamId] : [] });
    return this.withComments(task);
  }

  delete(member: Member, id: string): void {
    const viewer = this.viewer(member);
    const task = this.visible(viewer, id);
    this.requireMayManage(viewer, task.teamId);
    this.changed(task, 'DELETED'); // audience computed before the task is gone
    MockActivity.record('TASK', task.id, member, 'DELETED', { title: task.title, teamIds: task.teamId ? [task.teamId] : [] });
    this.tasks.data.splice(this.tasks.data.indexOf(task), 1);
    delete this.comments.data[id];
    this.links.remove(id);
    this.tasks.save();
    this.comments.save();
  }

  /** server: TasksApi.TaskChanged, pushed to everyone who sees the task (and previous assignees) */
  private changed(task: StoredTask, change: string, previousAssignees: readonly string[] = []): void {
    const members = new Set([...task.assignees, ...previousAssignees, task.createdBy, ...this.people.guardiansOf(task.assignees)]);
    if (task.teamId) this.people.teamMembers(task.teamId).forEach((m) => members.add(m));
    mockServer.events.publish({
      type: 'tasks.task-changed',
      data: { taskId: task.id, teamId: task.teamId, change },
      audience: { members: [...members], roles: ['ADMIN', 'BOARD'] },
    });
  }

  /** server: TasksApi.TaskAssigned (internal, for notifications): only newly assigned members */
  private assigned(task: StoredTask, previousAssignees: readonly string[]): void {
    const added = task.assignees.filter((id) => !previousAssignees.includes(id));
    if (!added.length) return;
    mockServer.events.publish({ type: 'tasks.task-assigned', data: { taskId: task.id, title: task.title, dueAt: task.dueAt, memberIds: added } });
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

  /** server: TaskHandlers.requireMayManage */
  private requireMayManage(viewer: Viewer, teamId: string | null): void {
    if (teamId === null || viewer.board) {
      this.people.requirePrivileged(viewer.member, ['ADMIN', 'BOARD']);
      return;
    }
    if (!viewer.coachTeamIds.has(teamId)) fail(403, 'access.denied');
    this.people.requirePrivileged(viewer.member, ['COACH']);
  }

  /** server: TaskHandlers.requireValidAssignees */
  private requireValidAssignees(teamId: string | null, assignees: readonly string[] | undefined): void {
    if (!assignees?.length) return fail(400, 'task.assignees-invalid');
    if (assignees.some((id) => !this.people.name(id))) fail(400, 'task.assignee-unknown');
    if (teamId && assignees.some((id) => !(teamId in this.people.teamRoles(id)))) fail(400, 'task.assignee-not-in-team');
  }

  private withComments(task: StoredTask): Task {
    return { ...task, comments: [...(this.comments.data[task.id] ?? [])], source: this.sources.data[task.id] ?? null };
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
    if (task.repeatWeeks != null && (task.repeatWeeks < 1 || task.repeatWeeks > 12)) fail(400, 'task.repeat-invalid');
    if (task.repeatWeeks != null && task.dueAt === null) fail(400, 'task.repeat-needs-due');
    return { ...task, title: task.title.trim(), description: task.description || null };
  }

  /** Same local wall time (club zone) n weeks later. */
  private static weeksLater(dueAt: string, weeks: number): string {
    const clock = directory.clock;
    return clock.toInstant(ZonedClock.addMinutes(clock.toLocal(dueAt), weeks * 7 * 24 * 60));
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
    const base = { appointmentId: null, completedAt: null, createdAt: at(-5), repeatWeeks: null as number | null };
    const items = (...entries: [string, boolean][]) => entries.map(([text, done], i) => ({ id: `ci-${text.length}-${i}`, text, done }));
    return [
      { ...base, id: 't-1', teamId: 't-damen', title: 'Trikots waschen', description: 'Satz für das Heimspiel, bitte bis Freitag zurück in die Halle.',
        status: 'OPEN', dueAt: at(0.5), createdBy: 'trainer', assignees: ['spielerin'], checklist: [] },
      { ...base, id: 't-2', teamId: 't-damen', title: 'Fahrgemeinschaft Auswärtsspiel', description: null, status: 'IN_PROGRESS',
        dueAt: at(6), createdBy: 'trainer', assignees: ['spielerin', 'neu'],
        checklist: items(['Fahrer:innen fragen', true], ['Treffpunkt festlegen', false], ['Liste in die Gruppe schicken', false]) },
      { ...base, id: 't-3', teamId: 't-u16', title: 'Bälle aufpumpen', description: null, status: 'OPEN', dueAt: at(-1), repeatWeeks: 1,
        createdBy: 'trainer', assignees: ['spieler'], checklist: [] },
      { ...base, id: 't-4', teamId: null, title: 'Kassenbericht vorbereiten', description: 'Für die Mitgliederversammlung.',
        status: 'OPEN', dueAt: at(12), createdBy: 'admin', assignees: ['vorstand'],
        checklist: items(['Belege sammeln', false], ['Bericht schreiben', false]) },
      { ...base, id: 't-5', teamId: null, title: 'Hallenzeiten für die neue Saison anfragen', description: null, status: 'DONE',
        dueAt: at(-10), createdBy: 'vorstand', assignees: ['vorstand'], checklist: [], completedAt: at(-11) },
      { ...base, id: 't-6', teamId: 't-damen', title: 'Spielberichtsbogen besorgen', description: null, status: 'OPEN', dueAt: null,
        createdBy: 'admin', assignees: ['trainer'], checklist: [] },
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

itemUseSources.push((member, itemId) => tasks.itemUses(member, itemId));

const actor = (req: MockRequest) => directory.actor(req);
const flag = (req: MockRequest, name: string) => req.query.get(name) === 'true';

mockServer
  .on('GET', '/api/v1/tasks/:id/activity', (req) => activity.list(actor(req), 'TASK', tasks.get(actor(req), req.params.id).id))
  .on('GET', '/api/v1/tasks', (req) =>
    ({ items: tasks.list(actor(req), flag(req, 'mine'), req.query.get('teamId'), flag(req, 'includeDone'), req.query.get('dueFrom'), req.query.get('dueTo')) }))
  .on('POST', '/api/v1/tasks', (req) => tasks.create(actor(req), req.body ?? {}))
  .on('GET', '/api/v1/tasks/:id', (req) => tasks.get(actor(req), req.params.id))
  .on('PATCH', '/api/v1/tasks/:id', (req) => tasks.update(actor(req), req.params.id, req.body ?? {}))
  .on('PUT', '/api/v1/tasks/:id/status', (req) => tasks.setStatus(actor(req), req.params.id, req.body?.status))
  .on('PUT', '/api/v1/tasks/:id/checklist/:itemId', (req) =>
    tasks.check(actor(req), req.params.id, req.params.itemId, req.body?.done))
  .on('POST', '/api/v1/tasks/:id/comments', (req) => tasks.comment(actor(req), req.params.id, req.body?.text))
  .on('DELETE', '/api/v1/tasks/:id', (req) => tasks.delete(actor(req), req.params.id))
  .on('GET', '/api/v1/tasks/:id/links', (req) => tasks.getLinks(actor(req), req.params.id))
  .on('PUT', '/api/v1/tasks/:id/links', (req) => tasks.setLinks(actor(req), req.params.id, req.body ?? {}));
