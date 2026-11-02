<script lang="ts">
  import MeetingDetailsEditor from './MeetingDetailsEditor.svelte';
  import MeetingDraftEditor from './MeetingDraftEditor.svelte';
  import AgendaEditor from './AgendaEditor.svelte';
  import { BrowserFile } from '../../lib/files/BrowserFile';
  import { Resource } from '../../lib/state/Resource.svelte';
  import { bus, commands, session } from '../../lib/container';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
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
    { value: 'APP', label: 'App', hint: 'Im Raum, stimmt in der App ab' },
    { value: 'ONLINE', label: 'Online', hint: 'Per Video dabei, stimmt in der App ab' },
    { value: 'ANALOG', label: 'Anwesend', hint: 'Im Raum ohne App, stimmt über die Schriftführung ab' },
  ];
  /** Online presence only where members may join online. */
  const attendanceFor = (m: Meeting) => ATTENDANCE.filter((a) => a.value !== 'ONLINE' || m.online);
  let editingPlace = $state(false);
  let editingDraft = $state(false);
  let editingAgenda = $state(false);
  let presenceFilter = $state('');
  // The meeting's motions, for linking agenda items.
  const motions = new Resource(() => meetingsApi.resolutions(id));
  const me = session.member.id;

  /** Present members without a mode yet are set present in the room at once. */
  async function allPresent(m: Meeting) {
    const missing = m.electorate.filter((p) => !m.present.some((x) => x.memberId === p.memberId)).map((p) => p.memberId);
    if (missing.length && (await model.setPresenceMany(missing, 'ANALOG'))) view.notify(`${missing.length} als anwesend eingetragen.`);
  }

  /** The attendance list (who was invited, how they were there) as a CSV file. */
  function attendanceCsv(m: Meeting) {
    const label = (id: string) => ATTENDANCE.find((a) => a.value === attendance(m, id))?.label ?? '';
    const rows = [['Name', 'Anwesenheit'], ...m.electorate.map((p) => [p.name, label(p.memberId)])];
    const csv = rows.map((r) => r.map((c) => `"${c.replaceAll('"', '""')}"`).join(';')).join('\r\n');
    BrowserFile.save(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }), `anwesenheit-${m.title}.csv`);
  }

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
    await view.confirm(
      {
        title: 'Einladung verschicken',
        message: `Die Einladung mit Tagesordnung geht per E-Mail und App an ${who}. Danach steht der Termin fest.`,
        confirmLabel: 'Einladen',
      },
      () => view.attempt(model.action, () => model.invite()),
      'Einladung verschickt.',
    );
  }

  useCommands(commands, {
    'meeting.invite': {
      run: () => model.meeting.value && void invite(model.meeting.value),
      when: () => {
        const m = model.meeting.value;
        return !!m && m.canManage && m.status === 'DRAFT' && !late(m) && !model.action.busy;
      },
    },
  });

  async function close() {
    await view.confirm(
      {
        title: 'Sitzung beenden',
        message:
          'Danach lassen sich Anwesenheit und Abstimmungen nicht mehr ändern. Das Protokoll lässt sich fertigschreiben, bis es abgeschlossen ist.',
        confirmLabel: 'Beenden',
      },
      () => view.attempt(model.action, () => model.close(protocol)),
      'Sitzung beendet.',
    );
  }

  async function cancel() {
    await view.confirm(
      {
        title: 'Sitzung absagen',
        message: 'Alle Eingeladenen erfahren, dass die Sitzung nicht stattfindet. Das lässt sich nicht rückgängig machen.',
        confirmLabel: 'Absagen',
        danger: true,
      },
      () => view.attempt(model.action, () => model.cancel()),
      'Sitzung abgesagt.',
    );
  }

  async function finalizeProtocol() {
    await view.confirm(
      { title: 'Protokoll abschließen', message: 'Danach lässt sich das Protokoll nicht mehr ändern.', confirmLabel: 'Abschließen' },
      () => view.attempt(model.action, async () => (await model.saveProtocol(protocol)) && model.finalizeProtocol()),
      'Protokoll abgeschlossen.',
    );
  }

  async function remove() {
    if (
      await view.confirm(
        { title: 'Entwurf löschen', message: 'Die Sitzung wurde noch nicht eingeladen.', confirmLabel: 'Löschen', danger: true },
        () => view.attempt(model.action, () => model.delete()),
        'Entwurf gelöscht.',
      )
    )
      view.leave();
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
          <Button variant="ghost" busy={model.action.busy} onclick={cancel}>Absagen</Button>
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
        {#if m.location}<dt>Ort</dt>
          <dd>{m.location}</dd>{/if}
        {#if m.online && m.videoUrl}<dt>Online</dt>
          <dd class="join">
            <Button
              size="sm"
              icon="page"
              tooltip="Videokonferenz in einem neuen Tab öffnen"
              onclick={() => window.open(m.videoUrl!, '_blank', 'noopener,noreferrer')}>Beitreten</Button
            >
            <a href={m.videoUrl} target="_blank" rel="noopener noreferrer" class="muted small">{m.videoUrl}</a>
          </dd>{/if}
        {#if m.status === 'DRAFT'}
          <dt>Einladen bis</dt>
          <dd class:late={late(m)}>{session.format.dateTime(m.latestInvite)}{late(m) ? ' (Frist vorbei, Termin verschieben)' : ''}</dd>
        {:else if m.invitedAt}
          <dt>Eingeladen</dt>
          <dd>{session.format.dateTime(m.invitedAt)}</dd>
        {/if}
        {#if m.urgency}<dt>Dringlichkeit</dt>
          <dd>{m.urgency}</dd>{/if}
      </dl>
      {#if m.canManage && m.status === 'DRAFT'}
        {#if editingDraft}
          <MeetingDraftEditor meeting={m} {model} onclose={() => (editingDraft = false)} />
        {:else}
          <div>
            <Button size="sm" icon="edit" tooltip="Titel, Zeit und Dringlichkeit des Entwurfs ändern" onclick={() => (editingDraft = true)}
              >Entwurf bearbeiten</Button
            >
          </div>
        {/if}
      {/if}
      {#if m.canManage && m.status !== 'CLOSED'}
        {#if editingPlace}
          <MeetingDetailsEditor meeting={m} {model} onclose={() => (editingPlace = false)} />
        {:else}
          <div>
            <Button size="sm" icon="edit" tooltip="Ort und Link zur Videokonferenz ändern" onclick={() => (editingPlace = true)}
              >Ort & Link bearbeiten</Button
            >
          </div>
        {/if}
      {/if}

      <h2>Tagesordnung</h2>
      {#if editingAgenda}
        <AgendaEditor meeting={m} {model} motions={motions.value ?? []} onclose={() => (editingAgenda = false)} />
      {:else}
        {#if m.agendaItems.length}
          <ol class="agenda">
            {#each m.agendaItems as item (item.id)}
              <li>
                <span>{item.title}</span>
                {#if item.resolutionId}<RecordLink kind="resolution" id={item.resolutionId}>Antrag</RecordLink>{/if}
                {#if item.note}<span class="muted small">{item.note}</span>{/if}
              </li>
            {/each}
          </ol>
        {:else if m.agenda}<p class="text">{m.agenda}</p>{:else}<p class="muted">Keine Tagesordnung eingetragen.</p>{/if}
        {#if m.canManage && m.status !== 'CLOSED' && m.status !== 'CANCELLED'}
          <div>
            <Button size="sm" icon="edit" onclick={() => (void motions.load(), (editingAgenda = true))}>Tagesordnung bearbeiten</Button>
          </div>
        {/if}
      {/if}

      <h2>Unterlagen und Verknüpfungen</h2>
      <MeetingLinks meeting={m} {model} />

      {#if m.status === 'OPEN' && meetingTypes.get(m.kind)?.selfCheckIn !== false && m.electorate.some((p) => p.memberId === me) && !m.present.some((p) => p.memberId === me)}
        <div class="row check-in">
          <span>Bist du dabei?</span>
          <Button variant="primary" busy={model.action.busy} onclick={() => void model.checkIn('APP')}>Ich bin da</Button>
          {#if m.online}<Button busy={model.action.busy} onclick={() => void model.checkIn('ONLINE')}>Online dabei</Button>{/if}
        </div>
      {/if}

      {#if m.status !== 'DRAFT' && m.status !== 'CANCELLED'}
        <h2>Anwesenheit</h2>
        <p>
          <Tag tone={m.quorate ? 'green' : 'red'}>{m.quorate ? 'Beschlussfähig' : 'Nicht beschlussfähig'}</Tag>
          <span class="muted small"
            >{presentVoters(m)} von {m.electorate.length} Stimmberechtigten da · nötig: {meetingTypes.get(m.kind)
              ? quorumText(meetingTypes.get(m.kind)!)
              : '…'}</span
          >
        </p>
        <div class="row">
          {#if m.electorate.length > 8}
            <input type="search" bind:value={presenceFilter} placeholder="Name suchen" aria-label="Stimmberechtigte durchsuchen" class="filter" />
          {/if}
          {#if m.canManage && m.status !== 'CLOSED'}
            <Button size="sm" busy={model.action.busy} tooltip="Alle ohne Eintrag als anwesend (ohne App) eintragen" onclick={() => allPresent(m)}
              >Alle übrigen anwesend</Button
            >
          {/if}
          <Button size="sm" variant="ghost" icon="download" tooltip="Anwesenheitsliste als CSV-Datei" onclick={() => attendanceCsv(m)}>Liste</Button>
        </div>
        <ul class="people">
          {#each m.electorate.filter((p) => !presenceFilter || p.name
                .toLocaleLowerCase()
                .includes(presenceFilter.toLocaleLowerCase())) as person (person.memberId)}
            <li>
              <RecordLink kind="member" id={person.memberId} allowed={permissions.canSeeMember(person.memberId)}>{person.name}</RecordLink>
              {#if m.canManage && m.status !== 'CLOSED'}
                <ChoiceGroup
                  name="presence-{person.memberId}"
                  label="Anwesenheit von {person.name}"
                  size="sm"
                  options={attendanceFor(m)}
                  disabled={model.action.busy}
                  bind:value={() => attendance(m, person.memberId), (v) => v && void model.setPresence(person.memberId, v === 'NONE' ? null : v)}
                />
              {:else}
                <span class="muted small">{ATTENDANCE.find((a) => a.value === attendance(m, person.memberId))?.label}</span>
              {/if}
            </li>
          {:else}
            <li class="muted">Niemand ist stimmberechtigt.</li>
          {/each}
        </ul>
      {/if}

      {#if m.status !== 'CANCELLED' && (m.status !== 'DRAFT' || m.canManage)}
        <h2>{m.status === 'DRAFT' ? 'Anträge (gehen mit der Einladung hinaus)' : 'Beschlüsse'}</h2>
        <ResolutionList meeting={m} />
      {/if}

      {#if m.status !== 'DRAFT' && (m.canManage || m.followUps.length)}
        <h2>Aufgaben</h2>
        <div class="stack">
          {#if m.canManage}
            <label class="check">
              <input
                type="checkbox"
                checked={m.autoTasks}
                disabled={model.action.busy}
                onchange={(e) => void model.setAutoTasks(e.currentTarget.checked)}
              />
              Angenommene Beschlüsse erzeugen automatisch Aufgaben
            </label>
          {/if}
          <FollowUpList followUps={m.followUps} canAdd={m.canManage} candidates={m.assignable} contextTitle={m.title} add={addFollowUp} />
        </div>
      {/if}

      {#if (m.status === 'OPEN' || (m.status === 'CLOSED' && !m.protocolFinalAt)) && m.canManage}
        <h2>Protokoll</h2>
        <div class="stack">
          {#if m.status === 'CLOSED'}<p class="muted small">
              Die Sitzung ist beendet; das Protokoll lässt sich fertigschreiben und dann abschließen.
            </p>{/if}
          <textarea bind:value={protocol} rows="10" maxlength="20000" aria-label="Protokoll"></textarea>
          <div class="row">
            <Button busy={model.action.busy} disabled={protocol === (m.protocol ?? '')} onclick={saveProtocol}>Protokoll speichern</Button>
            {#if m.status === 'CLOSED'}<Button variant="primary" busy={model.action.busy} onclick={finalizeProtocol}>Protokoll abschließen</Button
              >{/if}
          </div>
        </div>
      {:else if m.protocol}
        <h2>Protokoll</h2>
        <p class="text">{m.protocol}</p>
      {/if}
      {#if m.status === 'CLOSED'}
        <div class="row">
          {#if m.protocolFinalAt}
            {#each m.approvals as a (a.memberId)}
              <Tag tone="green">Genehmigt: {a.name}</Tag>
            {/each}
            {#if m.canManage && !m.approvals.some((a) => a.memberId === me)}
              <Button
                size="sm"
                busy={model.action.busy}
                tooltip="Als Vorsitz oder Schriftführung das Protokoll genehmigen"
                onclick={() => view.attempt(model.action, () => model.approveProtocol())}>Protokoll genehmigen</Button
              >
            {/if}
          {/if}
          {#if m.canManage}
            <Button size="sm" icon="document" busy={model.action.busy} onclick={() => view.attempt(model.action, () => model.generateProtocol())}
              >Protokoll als Dokument</Button
            >
          {/if}
        </div>
      {/if}
      <ErrorNote error={model.action.error} />
    </Detail>
  {/snippet}
</AsyncView>

<style>
  .join {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }
  .text {
    margin: 0;
    white-space: pre-wrap;
  }
  .late {
    color: var(--color-danger);
  }
  .agenda {
    display: grid;
    gap: var(--space-xs);
    margin: 0;
    padding-left: var(--space-lg);
  }
  .agenda li {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
    align-items: baseline;
  }
  .check-in {
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-md);
    background: var(--color-accent-soft);
  }
  .filter {
    max-width: 14rem;
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
