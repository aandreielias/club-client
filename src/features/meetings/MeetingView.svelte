<script lang="ts">
  import { untrack } from 'svelte';
  import { settings } from '../../settings';
  import MeetingDetailsEditor from './MeetingDetailsEditor.svelte';
  import MeetingCall from './MeetingCall.svelte';
  import MeetingDraftEditor from './MeetingDraftEditor.svelte';
  import AgendaEditor from './AgendaEditor.svelte';
  import MotionAdd from './MotionAdd.svelte';
  import { BrowserFile } from '../../lib/files/BrowserFile';
  import { csvText } from '../../lib/files/csv';
  import { Resource } from '../../lib/state/Resource.svelte';
  import { bus, commands, session } from '../../lib/container';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import { useRecordActions } from '../../lib/actions/useRecordActions.svelte';
  import RecordActionButtons from '../../ui/RecordActionButtons.svelte';
  import { lateToInvite as late, meetingActions } from './actions';
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
  import InviteesSection from './InviteesSection.svelte';
  import RecordLink from '../../ui/RecordLink.svelte';
  import { permissions } from '../../lib/container';
  import { DEFAULT_PROTOCOL, invitesVoters, quorumText, STATUS_LABELS, STATUS_TONES, type Meeting } from './model';
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
  let addingMotion = $state(false);
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

  // The drafts (per agenda item and the further notes) follow the saved protocol; a reload keeps what was typed.
  let protocol = $state('');
  let minutes = $state<Record<string, string>>({});
  let savedProtocol = $state('');
  let savedMinutes = $state<Record<string, string>>({});
  $effect(() => {
    const m = model.meeting.value;
    if (!m) return;
    const nextProtocol = m.protocol ?? '';
    const nextMinutes = Object.fromEntries(m.agendaItems.filter((i) => i.id).map((i) => [i.id!, i.minutes ?? '']));
    untrack(() => {
      if (protocol === savedProtocol) protocol = nextProtocol;
      minutes = Object.fromEntries(
        Object.entries(nextMinutes).map(([id, text]) => [id, (minutes[id] ?? '') === (savedMinutes[id] ?? '') ? text : minutes[id]]),
      );
      savedProtocol = nextProtocol;
      savedMinutes = nextMinutes;
    });
  });
  const protocolChanged = $derived(protocol !== savedProtocol || Object.entries(minutes).some(([id, text]) => text !== (savedMinutes[id] ?? '')));
  const minutesList = () => Object.entries(minutes).map(([agendaItemId, text]) => ({ agendaItemId, text }));

  const isPresent = (m: Meeting, memberId: string): boolean => m.present.some((p) => p.memberId === memberId);
  /** Vorsitz and Schriftführer:in are picked among those present, from the invitation until the protocol is final. */
  const rolesOpen = (m: Meeting) => m.canManage && (m.status === 'INVITED' || m.status === 'OPEN' || (m.status === 'CLOSED' && !m.protocolFinalAt));
  const presentOptions = (m: Meeting) => [{ value: '', label: 'Noch niemand' }, ...m.present.map((p) => ({ value: p.memberId, label: p.name }))];
  const protocolRules = (m: Meeting) => meetingTypes.get(m.kind)?.protocol ?? DEFAULT_PROTOCOL;
  /** server: approveProtocol — the type's approvers: the picked Vorsitz/Schriftführer:in; without a pick whoever runs it may try (office holders). */
  const mayApprove = (m: Meeting) => {
    const approvers = protocolRules(m).approvers;
    const role = (r: 'CHAIR' | 'SECRETARY', picked: Meeting['chair']) =>
      approvers.includes(r) && (picked?.memberId === me || (!picked && m.canManage));
    return !m.approvals.some((a) => a.memberId === me) && (role('CHAIR', m.chair) || role('SECRETARY', m.secretary));
  };
  const approved = (m: Meeting) => protocolRules(m).approvalsNeeded > 0 && m.approvals.length >= protocolRules(m).approvalsNeeded;

  async function setRoles(m: Meeting, chairId: string | null, secretaryId: string | null) {
    if (chairId && chairId === secretaryId) {
      view.notify('Vorsitz und Schriftführung sind zwei verschiedene Personen.');
      return;
    }
    await model.setRoles(chairId, secretaryId);
  }
  const presentVoters = (m: Meeting) => m.present.filter((p) => m.electorate.some((e) => e.memberId === p.memberId)).length;

  const act = useRecordActions(
    commands,
    meetingActions,
    () => (editingDraft ? null : model.meeting.value),
    () => view.leave(),
    () => model.load(),
  );
  useCommands(commands, {
    'record.edit': { run: () => (editingDraft = true), when: () => act.has('record.edit') },
    'meeting.close': { run: () => void close(), when: () => act.has('meeting.close') && !model.action.busy },
  });

  async function close() {
    await view.confirm(
      {
        title: 'Sitzung beenden',
        message:
          'Danach lassen sich Anwesenheit und Abstimmungen nicht mehr ändern. Das Protokoll lässt sich fertigschreiben, bis es abgeschlossen ist.',
        confirmLabel: 'Beenden',
      },
      () => view.attempt(model.action, async () => (await model.saveProtocol(protocol, minutesList())) && model.close(protocol)),
      'Sitzung beendet.',
    );
  }

  async function finalizeProtocol() {
    await view.confirm(
      { title: 'Protokoll abschließen', message: 'Danach lässt sich das Protokoll nicht mehr ändern.', confirmLabel: 'Abschließen' },
      () => view.attempt(model.action, async () => (await model.saveProtocol(protocol, minutesList())) && model.finalizeProtocol()),
      'Protokoll abgeschlossen.',
    );
  }

  async function saveProtocol() {
    if (await model.saveProtocol(protocol, minutesList())) view.notify('Protokoll gespeichert.');
  }
</script>

<AsyncView resource={model.meeting}>
  {#snippet children(m)}
    <Detail title={m.title}>
      {#snippet actions()}
        <RecordActionButtons actions={act} />
      {/snippet}
      {#snippet meta()}
        <Tag tone={STATUS_TONES[m.status]}>{STATUS_LABELS[m.status]}</Tag>
        <Tag tone={invitesVoters(meetingTypes.get(m.kind)) ? 'blue' : 'purple'}>{meetingTypes.label(m.kind)}</Tag>
      {/snippet}

      <dl class="props">
        <dt>Wann</dt>
        <dd>{session.format.dateTime(m.startsAt)} – {session.format.time(m.endsAt)}</dd>
        {#if m.location}<dt>Ort</dt>
          <dd>{m.location}</dd>{/if}
        {#if m.online && (m.status === 'INVITED' || m.status === 'OPEN')}<dt>Online</dt>
          <dd>
            {#if m.status === 'OPEN' || Date.parse(m.startsAt) - Date.now() <= settings.meetings.callOpensBeforeMs}
              <MeetingCall meeting={{ id: m.id, title: m.title }} />
            {:else}
              <span class="muted">Videokonferenz in der App, ab einer Stunde vor Beginn</span>
            {/if}
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
        {/if}
      {/if}
      {#if m.canManage && m.status !== 'CLOSED'}
        {#if editingPlace}
          <MeetingDetailsEditor meeting={m} {model} onclose={() => (editingPlace = false)} />
        {:else}
          <div>
            <Button size="sm" icon="edit" tooltip="Ort und Link zur Videokonferenz ändern" onclick={() => (editingPlace = true)}
              >Ort und Link bearbeiten</Button
            >
          </div>
        {/if}
      {/if}

      {#if m.chosen}
        <InviteesSection meeting={m} chosen={m.chosen} type={meetingTypes.get(m.kind)} {model} />
      {/if}

      <h2>Tagesordnung</h2>
      {#if editingAgenda}
        <AgendaEditor meeting={m} {model} resolutions={resolutions.value ?? []} onclose={() => ((editingAgenda = false), void resolutions.load())} />
      {:else}
        <AgendaView meeting={m} {resolutions} />
        {#if addingMotion}
          <MotionAdd
            meetingId={m.id}
            onclose={(added) => {
              addingMotion = false;
              if (added) void (model.load(), resolutions.load(), view.notify('Antrag hinzugefügt.'));
            }}
          />
        {:else if m.canManage && m.status !== 'CLOSED' && m.status !== 'CANCELLED'}
          <div class="row">
            <Button size="sm" icon="edit" onclick={() => (void resolutions.load(), (editingAgenda = true))}
              >Tagesordnung und Beschlüsse bearbeiten</Button
            >
            {#if m.status === 'INVITED' || m.status === 'OPEN'}
              <Button size="sm" icon="add" tooltip="Einen Beschluss ans Ende der Tagesordnung stellen" onclick={() => (addingMotion = true)}
                >Antrag hinzufügen</Button
              >
            {/if}
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
        <ul class="rows people">
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
          {#each m.agendaItems as item, index (item.id)}
            {#if item.id && item.id in minutes}
              <Field label="{index + 1}. {item.title}">
                <textarea bind:value={minutes[item.id]} rows="3" maxlength={settings.meetings.minutesMaxLength}></textarea>
              </Field>
            {/if}
          {/each}
          <Field label="Weitere Notizen" hint="Allfälliges und was zu keinem Tagesordnungspunkt gehört.">
            <textarea bind:value={protocol} rows="4" maxlength={settings.meetings.protocolMaxLength}></textarea>
          </Field>
          <div class="row">
            <Button busy={model.action.busy} disabled={!protocolChanged} onclick={saveProtocol}>Protokoll speichern</Button>
            {#if m.status === 'CLOSED'}<Button variant="primary" busy={model.action.busy} onclick={finalizeProtocol}>Protokoll abschließen</Button
              >{/if}
          </div>
        </div>
      {:else if m.protocol || m.agendaItems.some((i) => i.minutes)}
        <h2>Protokoll</h2>
        {#each m.agendaItems as item, index (item.id)}
          {#if item.minutes}<h3>{index + 1}. {item.title}</h3>
            <p class="text">{item.minutes}</p>{/if}
        {/each}
        {#if m.protocol}<h3>Weitere Notizen</h3>
          <p class="text">{m.protocol}</p>{/if}
      {/if}
      {#if m.status === 'CLOSED'}
        <div class="row">
          {#if m.protocolFinalAt}
            {#if approved(m)}<Tag tone="green">Protokoll genehmigt</Tag>{/if}
            {#each m.approvals as a (a.memberId)}
              <Tag tone={approved(m) ? 'neutral' : 'green'}>Genehmigt: {a.name}</Tag>
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
</style>
