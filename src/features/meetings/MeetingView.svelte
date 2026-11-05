<script lang="ts">
  import MeetingDetailsEditor from './MeetingDetailsEditor.svelte';
  import MeetingDraftEditor from './MeetingDraftEditor.svelte';
  import AgendaEditor from './AgendaEditor.svelte';
  import { BrowserFile } from '../../lib/files/BrowserFile';
  import { csvText } from '../../lib/files/csv';
  import { Resource } from '../../lib/state/Resource.svelte';
  import { bus, commands, session } from '../../lib/container';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import { DetailController } from '../../lib/detail/DetailController.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import Detail from '../../ui/Detail.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { MEETING_CHANGED } from './events';
  import { MeetingModel } from './MeetingModel.svelte';
  import AgendaView from './AgendaView.svelte';
  import MeetingLinks from './MeetingLinks.svelte';
  import RecordLink from '../../ui/RecordLink.svelte';
  import { permissions } from '../../lib/container';
  import { isAssembly, quorumText, STATUS_LABELS, STATUS_TONES, type Meeting } from './model';
  import { meetingsApi, meetingTypes } from './services';

  /** One meeting: date, Tagesordnung with its Beschlüsse (voted right there), invitation, presence with the quorum, protocol. Window and page. */
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

  let editingPlace = $state(false);
  let editingDraft = $state(false);
  let editingAgenda = $state(false);
  let presenceFilter = $state('');
  // The meeting's Beschlüsse: shown under their agenda items, edited with the agenda.
  const resolutions = new Resource(() => meetingsApi.resolutions(id));
  void resolutions.load();
  const me = session.member.id;

  /** Everyone not yet marked is set Anwesend at once (then untick who is missing). */
  async function allPresent(m: Meeting) {
    const missing = m.electorate.filter((p) => !isPresent(m, p.memberId)).map((p) => p.memberId);
    if (missing.length && (await model.setPresenceMany(missing, true))) view.notify(`${missing.length} als anwesend eingetragen.`);
  }

  /** The attendance list (who was invited, Anwesend or Fehlt) as a CSV file. */
  function attendanceCsv(m: Meeting) {
    const rows = [['Name', 'Anwesenheit'], ...m.electorate.map((p) => [p.name, isPresent(m, p.memberId) ? 'Anwesend' : 'Fehlt'])];
    BrowserFile.save(new Blob([csvText(rows)], { type: 'text/csv;charset=utf-8' }), `anwesenheit-${m.title}.csv`);
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

  const isPresent = (m: Meeting, memberId: string): boolean => m.present.some((p) => p.memberId === memberId);
  /** Vorsitz and Schriftführer:in are picked among those present, from the invitation until the protocol is final. */
  const rolesOpen = (m: Meeting) => m.canManage && (m.status === 'INVITED' || m.status === 'OPEN' || (m.status === 'CLOSED' && !m.protocolFinalAt));
  const presentOptions = (m: Meeting) => [{ value: '', label: 'Noch niemand' }, ...m.present.map((p) => ({ value: p.memberId, label: p.name }))];
  /** server: approveProtocol — the picked Vorsitz and Schriftführer:in; without a pick whoever runs the meeting may try (office holders). */
  const mayApprove = (m: Meeting) =>
    !m.approvals.some((a) => a.memberId === me) &&
    (m.chair?.memberId === me || m.secretary?.memberId === me || (m.canManage && (!m.chair || !m.secretary)));

  async function setRoles(m: Meeting, chairId: string | null, secretaryId: string | null) {
    if (chairId && chairId === secretaryId) {
      view.notify('Vorsitz und Schriftführung sind zwei verschiedene Personen.');
      return;
    }
    await model.setRoles(chairId, secretaryId);
  }
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
        <AgendaEditor meeting={m} {model} resolutions={resolutions.value ?? []} onclose={() => ((editingAgenda = false), void resolutions.load())} />
      {:else}
        <AgendaView meeting={m} {resolutions} />
        {#if m.canManage && m.status !== 'CLOSED' && m.status !== 'CANCELLED'}
          <div>
            <Button size="sm" icon="edit" onclick={() => (void resolutions.load(), (editingAgenda = true))}
              >Tagesordnung und Beschlüsse bearbeiten</Button
            >
          </div>
        {/if}
      {/if}

      <h2>Unterlagen und Verknüpfungen</h2>
      <MeetingLinks meeting={m} {model} />

      {#if m.status === 'OPEN' && meetingTypes.get(m.kind)?.selfCheckIn !== false && m.electorate.some((p) => p.memberId === me) && !m.present.some((p) => p.memberId === me)}
        <div class="row check-in">
          <span>Bist du dabei?</span>
          <Button variant="primary" busy={model.action.busy} onclick={() => void model.checkIn()}>Ich bin da</Button>
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
        {#if rolesOpen(m)}
          <div class="grid-2">
            <Field label="Vorsitz" hint="Leitet die Sitzung, genehmigt das Protokoll.">
              <Select
                options={presentOptions(m)}
                bind:value={() => m.chair?.memberId ?? '', (v) => void setRoles(m, v || null, m.secretary?.memberId ?? null)}
                aria-label="Vorsitz"
              />
            </Field>
            <Field label="Schriftführung" hint="Schreibt das Protokoll, genehmigt es.">
              <Select
                options={presentOptions(m)}
                bind:value={() => m.secretary?.memberId ?? '', (v) => void setRoles(m, m.chair?.memberId ?? null, v || null)}
                aria-label="Schriftführung"
              />
            </Field>
          </div>
          {#if !m.present.length}<p class="muted small">Zuerst die Anwesenden eintragen, dann Vorsitz und Schriftführung wählen.</p>{/if}
        {:else if m.chair || m.secretary}
          <p class="small">Vorsitz: {m.chair?.name ?? '–'} · Schriftführung: {m.secretary?.name ?? '–'}</p>
        {/if}
        <div class="row">
          {#if m.electorate.length > 8}
            <input type="search" bind:value={presenceFilter} placeholder="Name suchen" aria-label="Stimmberechtigte durchsuchen" class="filter" />
          {/if}
          {#if m.canManage && m.status !== 'CLOSED'}
            <Button size="sm" busy={model.action.busy} tooltip="Alle als anwesend eintragen; danach abhaken, wer fehlt" onclick={() => allPresent(m)}
              >Alle anwesend</Button
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
                <label class="check">
                  <input
                    type="checkbox"
                    checked={isPresent(m, person.memberId)}
                    disabled={model.action.busy}
                    onchange={(e) => void model.setPresence(person.memberId, e.currentTarget.checked)}
                  />
                  Anwesend
                </label>
              {:else}
                <span class="small" class:muted={!isPresent(m, person.memberId)}>{isPresent(m, person.memberId) ? 'Anwesend' : 'Fehlt'}</span>
              {/if}
            </li>
          {:else}
            <li class="muted">Niemand ist stimmberechtigt.</li>
          {/each}
        </ul>
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
            {#if mayApprove(m)}
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
