<script lang="ts">
  import { bus, session } from '../../lib/container';
  import { DetailController } from '../../lib/detail/DetailController.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import Detail from '../../ui/Detail.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { MEETING_CHANGED } from './events';
  import { MeetingModel } from './MeetingModel.svelte';
  import ResolutionList from './ResolutionList.svelte';
  import MeetingLinks from './MeetingLinks.svelte';
  import FollowUpList from './FollowUpList.svelte';
  import type { NewFollowUp } from './model';
  import RecordLink from '../../ui/RecordLink.svelte';
  import { permissions } from '../../lib/container';
  import { isAssembly, quorumText, STATUS_LABELS, STATUS_TONES, type Meeting, type PresenceMode } from './model';
  import { meetingsApi, meetingTypes } from './services';

  /** One meeting: date, agenda, invitation, presence with the quorum, protocol. Window and page. */
  let { id, handle, onclosed }: { id: string; handle?: WindowHandle; onclosed?: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const view = new DetailController(bus, handle, onclosed);
  // svelte-ignore state_referenced_locally
  const model = new MeetingModel(meetingsApi, id);
  void model.load();

  view.title(() => model.meeting.value?.title);
  view.watch(MEETING_CHANGED, (data) => data.meetingId === id, {
    deleted: 'Diese Sitzung wurde gelöscht.',
    busy: () => model.action.busy,
    changed: () => void model.load(),
  });

  type Attendance = PresenceMode | 'NONE';
  const ATTENDANCE: { value: Attendance; label: string; hint: string }[] = [
    { value: 'NONE', label: 'Fehlt', hint: 'Nicht da' },
    { value: 'APP', label: 'App', hint: 'Da und stimmt in der App ab' },
    { value: 'ANALOG', label: 'Ohne App', hint: 'Da (im Raum oder per Video), stimmt über die Schriftführung ab' },
  ];

  let protocol = $state('');
  let protocolFor = $state<string | null>(null);
  // The draft follows the saved protocol until the minute taker starts typing.
  $effect(() => {
    const saved = model.meeting.value?.protocol ?? '';
    if (protocolFor !== saved) {
      protocol = saved;
      protocolFor = saved;
    }
  });

  const attendance = (m: Meeting, memberId: string): Attendance => m.present.find((p) => p.memberId === memberId)?.mode ?? 'NONE';
  const presentVoters = (m: Meeting) => m.present.filter((p) => m.electorate.some((e) => e.memberId === p.memberId)).length;
  const late = (m: Meeting) => m.latestInvite < new Date().toISOString();

  async function invite(m: Meeting) {
    const who = isAssembly(meetingTypes.get(m.kind)) ? 'alle stimmberechtigten Mitglieder' : 'den Vorstand';
    await view.confirm({
      title: 'Einladung verschicken',
      message: `Die Einladung mit Tagesordnung geht per E-Mail und App an ${who}. Danach steht der Termin fest.`,
      confirmLabel: 'Einladen',
    }, () => view.attempt(model.action, () => model.invite()), 'Einladung verschickt.');
  }

  async function close() {
    await view.confirm({
      title: 'Sitzung beenden',
      message: 'Danach lassen sich Protokoll und Anwesenheit nicht mehr ändern.',
      confirmLabel: 'Beenden',
    }, () => view.attempt(model.action, () => model.close(protocol)), 'Sitzung beendet.');
  }

  async function remove() {
    if (await view.confirm({ title: 'Entwurf löschen', message: 'Die Sitzung wurde noch nicht eingeladen.', confirmLabel: 'Löschen', danger: true },
      () => view.attempt(model.action, () => model.delete()), 'Entwurf gelöscht.')) view.leave();
  }

  async function addFollowUp(followUp: NewFollowUp): Promise<boolean> {
    if (!(await model.action.run(() => meetingsApi.addMeetingFollowUp(id, followUp)))) return false;
    await model.load();
    view.notify('Aufgabe angelegt.');
    return true;
  }

  async function saveProtocol() {
    if (await model.saveProtocol(protocol)) view.notify('Protokoll gespeichert.');
  }
</script>

<AsyncView resource={model.meeting}>
  {#snippet children(m)}
    <Detail title={m.title}>
      {#snippet actions()}
        {#if m.canManage && m.status === 'DRAFT'}
          <Button variant="ghost" busy={model.action.busy} onclick={remove}>Löschen</Button>
          <Button variant="primary" busy={model.action.busy} disabled={late(m)} onclick={() => invite(m)}>Einladen</Button>
        {:else if m.canManage && m.status === 'INVITED'}
          <Button variant="primary" busy={model.action.busy} onclick={() => view.attempt(model.action, () => model.open())}>Sitzung eröffnen</Button>
        {:else if m.canManage && m.status === 'OPEN'}
          <Button variant="primary" busy={model.action.busy} onclick={close}>Sitzung beenden</Button>
        {/if}
      {/snippet}
      {#snippet meta()}
        <Tag tone={STATUS_TONES[m.status]}>{STATUS_LABELS[m.status]}</Tag>
        <Tag tone={isAssembly(meetingTypes.get(m.kind)) ? 'blue' : 'purple'}>{meetingTypes.label(m.kind)}</Tag>
      {/snippet}

      <dl class="props">
        <dt>Wann</dt>
        <dd>{session.format.dateTime(m.startsAt)} – {session.format.time(m.endsAt)}</dd>
        {#if m.location}<dt>Ort</dt><dd>{m.location}</dd>{/if}
        {#if m.videoUrl}<dt>Videokonferenz</dt><dd><a href={m.videoUrl} target="_blank" rel="noopener noreferrer">{m.videoUrl}</a></dd>{/if}
        {#if m.status === 'DRAFT'}
          <dt>Einladen bis</dt>
          <dd class:late={late(m)}>{session.format.dateTime(m.latestInvite)}{late(m) ? ' (Frist vorbei, Termin verschieben)' : ''}</dd>
        {:else if m.invitedAt}
          <dt>Eingeladen</dt><dd>{session.format.dateTime(m.invitedAt)}</dd>
        {/if}
        {#if m.urgency}<dt>Dringlichkeit</dt><dd>{m.urgency}</dd>{/if}
      </dl>

      <h2>Tagesordnung</h2>
      {#if m.agenda}<p class="text">{m.agenda}</p>{:else}<p class="muted">Keine Tagesordnung eingetragen.</p>{/if}

      <h2>Unterlagen und Verknüpfungen</h2>
      <MeetingLinks meeting={m} {model} />

      {#if m.status !== 'DRAFT'}
        <h2>Anwesenheit</h2>
        <p>
          <Tag tone={m.quorate ? 'green' : 'red'}>{m.quorate ? 'Beschlussfähig' : 'Nicht beschlussfähig'}</Tag>
          <span class="muted small">{presentVoters(m)} von {m.electorate.length} Stimmberechtigten da · nötig: {meetingTypes.get(m.kind) ? quorumText(meetingTypes.get(m.kind)!) : '…'}</span>
        </p>
        <ul class="people">
          {#each m.electorate as person (person.memberId)}
            <li>
              <RecordLink kind="member" id={person.memberId} allowed={permissions.canSeeMember(person.memberId)}>{person.name}</RecordLink>
              {#if m.canManage && m.status !== 'CLOSED'}
                <ChoiceGroup name="presence-{person.memberId}" label="Anwesenheit von {person.name}" size="sm" options={ATTENDANCE}
                  disabled={model.action.busy}
                  bind:value={() => attendance(m, person.memberId), (v) => v && void model.setPresence(person.memberId, v === 'NONE' ? null : v)} />
              {:else}
                <span class="muted small">{ATTENDANCE.find((a) => a.value === attendance(m, person.memberId))?.label}</span>
              {/if}
            </li>
          {:else}
            <li class="muted">Niemand ist stimmberechtigt.</li>
          {/each}
        </ul>
      {/if}

      {#if m.status !== 'DRAFT'}
        <h2>Beschlüsse</h2>
        <ResolutionList meeting={m} />
      {/if}

      {#if m.status !== 'DRAFT' && (m.canManage || m.followUps.length)}
        <h2>Aufgaben</h2>
        <div class="stack">
          {#if m.canManage}
            <label class="check">
              <input type="checkbox" checked={m.autoTasks} disabled={model.action.busy} onchange={(e) => void model.setAutoTasks(e.currentTarget.checked)} />
              Angenommene Beschlüsse erzeugen automatisch Aufgaben
            </label>
          {/if}
          <FollowUpList followUps={m.followUps} canAdd={m.canManage} candidates={m.assignable} add={addFollowUp} />
        </div>
      {/if}

      {#if m.status === 'OPEN' && m.canManage}
        <h2>Protokoll</h2>
        <div class="stack">
          <textarea bind:value={protocol} rows="10" maxlength="20000" aria-label="Protokoll"></textarea>
          <div><Button busy={model.action.busy} disabled={protocol === (m.protocol ?? '')} onclick={saveProtocol}>Protokoll speichern</Button></div>
        </div>
      {:else if m.protocol}
        <h2>Protokoll</h2>
        <p class="text">{m.protocol}</p>
      {/if}
      <ErrorNote error={model.action.error} />
    </Detail>
  {/snippet}
</AsyncView>

<style>
  .text {
    margin: 0;
    white-space: pre-wrap;
  }
  .late {
    color: var(--color-danger);
  }
  .people {
    display: grid;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .people li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-sm);
    min-height: var(--control-height);
    border-bottom: 1px solid var(--color-border);
  }
</style>
