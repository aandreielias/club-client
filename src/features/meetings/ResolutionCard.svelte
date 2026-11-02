<script lang="ts">
  import { bus, session } from '../../lib/container';
  import { CONFIRM, TOAST } from '../../channels';
  import { Action } from '../../lib/state/Action.svelte';
  import Button from '../../ui/Button.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import DateTimeInput from '../../ui/DateTimeInput.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import RecordLink from '../../ui/RecordLink.svelte';
  import { activePeople } from './people';
  import LinkList from './LinkList.svelte';
  import MemberChips from './MemberChips.svelte';
  import { CHOICE_LABELS, MAJORITY_LABELS, RESULT_LABELS, RESULT_TONES, type Choice, type Resolution } from './model';
  import { meetingsApi } from './services';

  /**
   * One resolution: motion, required majority, secret vote (only the count of votes while open, the split after closing),
   * the room's sums for members without the app, written votes of a circular vote. Once passed, it links its task "umsetzen".
   */
  let {
    resolution: r,
    onchanged,
    ondeleted,
    meetingOpen = true,
  }: {
    resolution: Resolution;
    onchanged: (r: Resolution) => void;
    ondeleted?: () => void;
    /** Votes open only in the open meeting (circular votes always). */
    meetingOpen?: boolean;
  } = $props();

  const action = new Action();
  // Who may carry it out, for who runs it while it is not closed.
  const people = new Resource(activePeople);
  // svelte-ignore state_referenced_locally
  if (r.canManage && r.status !== 'CLOSED') void people.load();
  const TASK_STATUS = { OPEN: 'offen', IN_PROGRESS: 'in Arbeit', DONE: 'erledigt' } as const;
  const choices = (Object.keys(CHOICE_LABELS) as Choice[]).map((c) => ({ value: c, label: CHOICE_LABELS[c] }));

  let roomYes = $state(0);
  let roomNo = $state(0);
  let roomAbstain = $state(0);
  let writtenBy = $state('');
  let writtenChoice = $state<Choice | null>(null);
  const roomSum = $derived(roomYes + roomNo + roomAbstain);

  async function write(request: () => Promise<Resolution>, success?: string) {
    const updated = await action.attempt(request);
    if (!updated) return;
    onchanged(updated);
    if (success) bus.publish(TOAST, { text: success });
  }

  async function confirmThen(title: string, message: string, confirmLabel: string, request: () => Promise<Resolution>, success: string) {
    if (await bus.request(CONFIRM, { title, message, confirmLabel })) await write(request, success);
  }

  const open = () =>
    confirmThen(
      'Abstimmung öffnen',
      r.meetingId ? 'Stimmberechtigte in der App können jetzt abstimmen.' : 'Der Antrag geht per E-Mail und App an den ganzen Vorstand.',
      'Öffnen',
      () => meetingsApi.openResolution(r.id),
      'Abstimmung geöffnet.',
    );
  const close = () =>
    confirmThen(
      'Abstimmung schließen',
      `${r.ballots} von ${r.voters} haben in der App abgestimmt.${r.analogPresent && !r.analogEntered ? ' Die Stimmen im Raum sind noch nicht erfasst.' : ''}`,
      'Schließen',
      () => meetingsApi.closeResolution(r.id),
      'Abstimmung geschlossen.',
    );
  const vote = (choice: Choice) =>
    confirmThen(
      'Stimme abgeben',
      `Deine Stimme: ${CHOICE_LABELS[choice]}. Sie ist geheim und lässt sich nicht ändern.`,
      'Abstimmen',
      () => meetingsApi.vote(r.id, choice),
      'Stimme abgegeben.',
    );
  const enterRoom = () =>
    confirmThen(
      'Stimmen im Raum erfassen',
      `Ja ${roomYes}, Nein ${roomNo}, Enthaltung ${roomAbstain}. Das lässt sich nur einmal eintragen.`,
      'Erfassen',
      () => meetingsApi.analogVotes(r.id, roomYes, roomNo, roomAbstain),
      'Stimmen im Raum erfasst.',
    );

  async function recordWritten() {
    if (!writtenBy || !writtenChoice) return;
    await write(() => meetingsApi.recordVote(r.id, writtenBy, writtenChoice!), 'Schriftliche Stimme erfasst.');
    writtenBy = '';
    writtenChoice = null;
  }

  async function setAssignees(ids: string[]) {
    await write(() => meetingsApi.setResolutionAssignees(r.id, ids));
  }

  /** Circular votes only run longer; the deadline task follows on the server. */
  let extending = $state(false);
  let newDeadline = $state('');
  function startExtend() {
    newDeadline = session.clock.toLocal(r.deadline!).slice(0, 16);
    extending = true;
  }
  let editing = $state(false);
  let editTitle = $state('');
  let editText = $state('');

  function startEdit() {
    editTitle = r.title;
    editText = r.text ?? '';
    editing = true;
  }

  async function saveDraft(event: SubmitEvent) {
    event.preventDefault();
    if (!editTitle.trim()) return;
    if (await action.run(() => meetingsApi.updateResolution(r.id, { title: editTitle.trim(), text: editText.trim() }).then(onchanged)))
      editing = false;
  }

  async function extend() {
    await write(() => meetingsApi.extendDeadline(r.id, session.clock.toInstant(newDeadline)), 'Frist verlängert.');
    if (!action.error) extending = false;
  }

  async function remove() {
    if (!(await bus.request(CONFIRM, { title: 'Entwurf löschen', message: r.title, confirmLabel: 'Löschen', danger: true }))) return;
    if (await action.run(() => meetingsApi.deleteResolution(r.id))) ondeleted?.();
  }
</script>

<article class="resolution">
  <header>
    {#if editing}
      <form class="stack edit" onsubmit={saveDraft}>
        <Field label="Antrag"><input bind:value={editTitle} maxlength="200" required /></Field>
        <Field label="Text (optional)"><textarea bind:value={editText} rows="3" maxlength="4000"></textarea></Field>
        <div class="row">
          <Button type="submit" variant="primary" busy={action.busy} disabled={!editTitle.trim()}>Speichern</Button>
          <Button variant="ghost" onclick={() => (editing = false)}>Abbrechen</Button>
        </div>
      </form>
    {:else}
      <strong>{r.title}</strong>
    {/if}
    <span class="tags">
      <Tag>{MAJORITY_LABELS[r.majority]}</Tag>
      {#if r.result}<Tag tone={RESULT_TONES[r.result]}>{RESULT_LABELS[r.result]}</Tag>{:else if r.status === 'OPEN'}<Tag tone="green">Offen</Tag
        >{:else}<Tag tone="gray">Entwurf</Tag>{/if}
    </span>
  </header>
  {#if r.text}<p class="text">{r.text}</p>{/if}
  {#if r.canManage && r.status !== 'CLOSED'}
    <MemberChips
      value={r.assignees.map((a) => a.memberId)}
      candidates={people.value ?? []}
      known={r.assignees}
      label="Umsetzung durch"
      placeholder="Umsetzung durch (sonst Vorstand)"
      onchange={setAssignees}
    />
  {:else if r.assignees.length}
    <p class="muted small">Umsetzung durch: {r.assignees.map((a) => a.name).join(', ')}</p>
  {/if}
  {#if r.implementDue && !r.taskId}<p class="muted small">Umsetzen bis {session.format.date(r.implementDue)}</p>{/if}
  {#if r.taskId}
    <p class="small">
      Aufgabe: <RecordLink kind="task" id={r.taskId}>{r.title} umsetzen</RecordLink>{#if r.taskStatus}<span class="muted">
          · {TASK_STATUS[r.taskStatus]}</span
        >{/if}
    </p>
  {/if}
  {#if r.deadline && r.status !== 'CLOSED'}
    <div class="row">
      <p class="muted small">Abstimmen bis {session.format.dateTime(r.deadline)}</p>
      {#if r.canManage && r.status === 'OPEN' && !r.meetingId && !extending}
        <Button size="sm" variant="ghost" onclick={startExtend}>Frist verlängern</Button>
      {/if}
    </div>
    {#if extending}
      <div class="row">
        <DateTimeInput bind:value={newDeadline} min={session.clock.toLocal(r.deadline).slice(0, 16)} aria-label="Neue Frist" />
        <Button size="sm" variant="primary" busy={action.busy} onclick={extend}>Verlängern</Button>
        <Button size="sm" variant="ghost" onclick={() => (extending = false)}>Abbrechen</Button>
      </div>
    {/if}
  {/if}

  {#if r.status === 'OPEN'}
    <p class="muted small">
      {r.ballots} von {r.voters} abgestimmt{r.analogPresent ? ` · ${r.analogPresent} ohne App${r.analogEntered ? ' (erfasst)' : ''}` : ''}
    </p>
    {#if r.canVote}
      <div class="row">
        {#each choices as c (c.value)}<Button busy={action.busy} tooltip="Geheim mit „{c.label}“ abstimmen" onclick={() => vote(c.value)}
            >{c.label}</Button
          >{/each}
      </div>
    {:else if r.voted}
      <p class="small">Du hast abgestimmt.</p>
    {/if}
  {:else if r.status === 'CLOSED'}
    <p class="small">
      Ja {r.yes! + (r.analogYes ?? 0)} · Nein {r.no! + (r.analogNo ?? 0)} · Enthaltung {r.abstain! + (r.analogAbstain ?? 0)}
      {#if r.analogEntered}<span class="muted">(davon im Raum: {r.analogYes} · {r.analogNo} · {r.analogAbstain})</span>{/if}
    </p>
  {/if}

  {#if r.canManage && r.status === 'OPEN' && !r.meetingId && r.pending.length}
    <form
      class="inline"
      onsubmit={(e) => {
        e.preventDefault();
        void recordWritten();
      }}
    >
      <Field label="Schriftliche Stimme von">
        <Select bind:value={writtenBy} placeholder="Bitte wählen" options={r.pending.map((p) => ({ value: p.memberId, label: p.name }))} />
      </Field>
      <ChoiceGroup name="written-{r.id}" label="Stimme" size="sm" options={choices} bind:value={writtenChoice} />
      <Button type="submit" busy={action.busy} disabled={!writtenBy || !writtenChoice}>Stimme erfassen</Button>
    </form>
  {/if}

  {#if r.canManage && r.status === 'OPEN' && r.meetingId && r.analogPresent && !r.analogEntered}
    <form
      class="inline"
      onsubmit={(e) => {
        e.preventDefault();
        void enterRoom();
      }}
    >
      <Field label="Im Raum: Ja"><input type="number" min="0" bind:value={roomYes} /></Field>
      <Field label="Nein"><input type="number" min="0" bind:value={roomNo} /></Field>
      <Field label="Enthaltung"><input type="number" min="0" bind:value={roomAbstain} /></Field>
      <Button type="submit" busy={action.busy} disabled={roomSum > r.analogPresent}>Stimmen im Raum erfassen</Button>
    </form>
    <p class="muted small">
      Höchstens {r.analogPresent} Stimmen: so viele sind ohne App da. Vor dem Schließen eintragen (auch 0); bis dahin lässt es sich korrigieren.
    </p>
  {/if}

  {#if r.links.length || r.canManage}
    <LinkList
      links={r.links}
      canEdit={r.canManage}
      busy={action.busy}
      self={{ kind: 'resolution', id: r.id }}
      save={(refs) => action.run(() => meetingsApi.setResolutionLinks(r.id, refs).then(onchanged))}
    />
  {/if}

  {#if r.canManage && r.status !== 'CLOSED'}
    <div class="row">
      {#if r.status === 'DRAFT'}
        {#if !editing}<Button variant="ghost" icon="edit" onclick={startEdit}>Bearbeiten</Button>{/if}
        <Button variant="ghost" busy={action.busy} onclick={remove}>Entwurf löschen</Button>
        {#if meetingOpen}<Button variant="primary" busy={action.busy} onclick={open}>Abstimmung öffnen</Button>{/if}
      {:else}
        <Button busy={action.busy} onclick={close}>Abstimmung schließen</Button>
      {/if}
    </div>
  {/if}
  <ErrorNote error={action.error} />
</article>

<style>
  .resolution {
    display: grid;
    gap: var(--space-sm);
    padding: var(--space-md) var(--space-lg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
  }
  header {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--space-sm);
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
  }
  .text {
    margin: 0;
    white-space: pre-wrap;
  }
  p {
    margin: 0;
  }
  .inline {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: var(--space-md);
  }
  .inline input {
    width: 6rem;
  }
</style>
