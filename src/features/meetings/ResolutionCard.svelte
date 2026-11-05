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

  /** Show of hands: opens at once, the counts row appears. */
  const openByHand = () => write(() => meetingsApi.openResolution(r.id, 'HAND'));
  /** Secretly in the app: every present voter gets the vote buttons. */
  const openInApp = () =>
    confirmThen(
      'Geheim in der App abstimmen',
      r.meetingId
        ? 'Alle Anwesenden stimmen jetzt auf ihrem Handy ab; du schließt die Abstimmung.'
        : 'Der Antrag geht per E-Mail und App an den ganzen Vorstand.',
      'Öffnen',
      () => meetingsApi.openResolution(r.id, r.meetingId ? 'APP' : null),
      'Abstimmung geöffnet.',
    );
  const close = () =>
    confirmThen(
      'Abstimmung schließen',
      `${r.ballots} von ${r.meetingId ? r.presentVoters : r.voters} haben abgestimmt.`,
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
  /** Show of hands: counts and closing in one step. */
  const handResult = (yes: number, no: number, abstain: number) =>
    write(() => meetingsApi.handResult(r.id, yes, no, abstain), 'Ergebnis eingetragen.');
  /** Show of hands: counts so far, still open (corrected until closing). */
  const handCounts = () => write(() => meetingsApi.analogVotes(r.id, roomYes, roomNo, roomAbstain), 'Zwischenstand gespeichert.');

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

  {#if r.status === 'OPEN' && r.voteMode === 'HAND'}
    <p class="muted small">Abstimmung per Handzeichen · {r.presentVoters} Stimmberechtigte anwesend</p>
  {:else if r.status === 'OPEN'}
    <p class="muted small">
      {r.meetingId ? `Geheim in der App: ${r.ballots} von ${r.presentVoters} Anwesenden haben abgestimmt` : `${r.ballots} von ${r.voters} abgestimmt`}
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
      <span class="muted">· {r.voteMode === 'HAND' ? 'per Handzeichen' : 'geheim in der App'}</span>
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

  {#if r.canManage && r.status === 'OPEN' && r.voteMode === 'HAND'}
    <form
      class="hands"
      onsubmit={(e) => {
        e.preventDefault();
        void handResult(roomYes, roomNo, roomAbstain);
      }}
    >
      <label>Ja <input type="number" min="0" max={r.presentVoters} bind:value={roomYes} /></label>
      <label>Nein <input type="number" min="0" max={r.presentVoters} bind:value={roomNo} /></label>
      <label>Enthaltung <input type="number" min="0" max={r.presentVoters} bind:value={roomAbstain} /></label>
      <Button type="submit" variant="primary" busy={action.busy} disabled={roomSum > r.presentVoters}>Ergebnis eintragen</Button>
      <Button busy={action.busy} onclick={() => handResult(r.presentVoters, 0, 0)}>Einstimmig</Button>
      <Button
        busy={action.busy}
        disabled={roomSum > r.presentVoters}
        tooltip="Die Zahlen speichern, ohne die Abstimmung zu schließen"
        onclick={handCounts}>Zwischenstand speichern</Button
      >
    </form>
    {#if r.analogEntered}<p class="muted small">Ein Zwischenstand ist gespeichert; das Ergebnis zeigt sich nach dem Schließen.</p>{/if}
    {#if roomSum > r.presentVoters}<p class="error small" role="alert">Mehr Stimmen als Anwesende ({r.presentVoters}).</p>{/if}
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
        {#if r.meetingId && meetingOpen}
          <Button variant="primary" busy={action.busy} onclick={openByHand}>Per Handzeichen</Button>
          <Button busy={action.busy} onclick={openInApp}>Geheim in der App</Button>
        {:else if !r.meetingId}
          <Button variant="primary" busy={action.busy} onclick={openInApp}>An den Vorstand schicken</Button>
        {/if}
      {:else if r.voteMode !== 'HAND'}
        <Button busy={action.busy} onclick={close}>Abstimmung schließen</Button>
      {/if}
    </div>
  {/if}
  <ErrorNote error={action.error} />
</article>

<style>
  .hands {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: var(--space-sm);
  }
  .hands label {
    display: grid;
    gap: var(--space-xxs);
    font-size: var(--font-size-sm);
  }
  .hands input {
    width: 5rem;
  }
  .error {
    margin: 0;
    color: var(--color-danger);
  }
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
</style>
