<script lang="ts" module>
  export class TournamentView {
    /** Where a tournament opens: teams while planning, the running phase afterwards. */
    static firstTab(t: Tournament | undefined): 'overview' | 'groups' | 'ko' | 'teams' {
      if (!t || t.status === 'DRAFT') return 'teams';
      return t.status === 'GROUPS' ? 'groups' : 'ko';
    }
  }
</script>

<script lang="ts">
  import { bus, pendingDeletes, session } from '../../lib/container';
  import { DetailController } from '../../lib/detail/DetailController.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import Detail from '../../ui/Detail.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Icon from '../../ui/Icon.svelte';
  import RecordLink from '../../ui/RecordLink.svelte';
  import Tag from '../../ui/Tag.svelte';
  import BracketTab from './BracketTab.svelte';
  import { TOURNAMENT_CHANGED } from './events';
  import GroupsTab from './GroupsTab.svelte';
  import { FORMAT_LABELS, matchPlace, STATUS_LABELS, STATUS_TONES, type Tournament } from './model';
  import TeamsTab from './TeamsTab.svelte';
  import TournamentEditDialog from './TournamentEditDialog.svelte';
  import { TournamentModel } from './TournamentModel.svelte';
  import { tournamentPolicy as policy, tournamentsApi } from './services';

  /** One tournament: overview, group tables, knockout tree and teams. Window and page. */
  let { id, handle, onclosed }: { id: string; handle?: WindowHandle; onclosed?: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const view = new DetailController(bus, handle, onclosed);
  // svelte-ignore state_referenced_locally
  const model = new TournamentModel(tournamentsApi, id);
  void model.load().then(() => (tab = TournamentView.firstTab(model.tournament.value)));

  type Tab = 'overview' | 'groups' | 'ko' | 'teams';
  let tab = $state<Tab>('overview');
  const tabs: { value: Tab; label: string }[] = [
    { value: 'overview', label: 'Übersicht' },
    { value: 'groups', label: 'Gruppen' },
    { value: 'ko', label: 'KO-Runde' },
    { value: 'teams', label: 'Teams' },
  ];

  view.title(() => model.tournament.value?.name);
  view.watch(TOURNAMENT_CHANGED, (data) => data.tournamentId === id, {
    deleted: 'Dieses Turnier wurde gelöscht.',
    busy: () => model.action.busy,
    changed: () => void model.load(),
  });

  const days = (t: Tournament) =>
    t.startsOn === t.endsOn ? session.format.date(t.startsOn) : `${session.format.date(t.startsOn)} – ${session.format.date(t.endsOn)}`;
  const rules = (t: Tournament) =>
    t.format === 'SIMPLE'
      ? 'Sieg 3 Punkte, Unentschieden 1, Niederlage 0'
      : t.format === 'BEACH'
        ? 'Zwei Gewinnsätze bis 21 (dritter bis 15); Sieg 2 Punkte, Niederlage 1'
        : `${t.setsToWin === 3 ? 'Drei' : 'Zwei'} Gewinnsätze bis 25; Sieg ${t.setsToWin}:${t.setsToWin - 1} gibt 2:1 Punkte, sonst 3:0`;
  // In plan order: the next Durchgang first, then by field.
  const upcoming = (t: Tournament) =>
    t.matches
      .filter((m) => m.homeId && m.awayId && m.homeScore === null)
      .sort((a, b) => (a.wave ?? Infinity) - (b.wave ?? Infinity) || (a.field ?? '').localeCompare(b.field ?? '', 'de', { numeric: true }))
      .slice(0, 6);

  function remove(name: string) {
    // The prop is gone once the view closed, before the undo time ends: keep the id itself.
    const target = id;
    pendingDeletes.schedule({ ids: [target], text: `„${name}“ gelöscht.`, commit: () => tournamentsApi.delete(target) });
    view.leave();
  }
  let editing = $state(false);
</script>

<AsyncView resource={model.tournament}>
  {#snippet children(t)}
    <Detail title={t.name}>
      {#snippet actions()}
        {#if policy.canManage()}
          {#if t.status === 'DRAFT'}
            <Button
              variant="primary"
              busy={model.action.busy}
              disabled={t.teams.length < 2}
              onclick={() => model.draw().then((ok) => ok && (tab = 'groups'))}>Auslosen</Button
            >
          {:else if t.status === 'GROUPS'}
            <Button
              variant="primary"
              busy={model.action.busy}
              disabled={model.openGroupMatches > 0}
              tooltip={model.openGroupMatches ? `Noch ${model.openGroupMatches} Gruppenspiele ohne Ergebnis` : undefined}
              onclick={() => model.startKnockout().then((ok) => ok && (tab = 'ko'))}>KO-Runde starten</Button
            >
          {/if}
        {/if}
        {#if policy.canManage()}<Button icon="edit" onclick={() => (editing = true)}>Bearbeiten</Button>{/if}
        {#if policy.canDelete()}<Button variant="danger" icon="delete" onclick={() => remove(t.name)}>Löschen</Button>{/if}
      {/snippet}
      {#snippet meta()}
        <Tag tone={STATUS_TONES[t.status]}>{STATUS_LABELS[t.status]}</Tag>
        <span class="muted">{days(t)}</span>
      {/snippet}

      <ErrorNote error={model.action.error} />
      <div class="tabs"><ChoiceGroup name="tournament-tab-{t.id}" label="Ansicht" options={tabs} bind:value={tab} /></div>

      {#if tab === 'overview'}
        {#if model.champion}
          <div class="champion"><Icon name="trophy" /> <span>Turniersieger: <strong>{model.champion}</strong></span></div>
        {/if}
        <dl class="props">
          <dt>Wann</dt>
          <dd>{days(t)}</dd>
          {#if t.locationId}
            <dt>Ort</dt>
            <dd><RecordLink kind="location" id={t.locationId}>Ort öffnen</RecordLink></dd>
          {/if}
          <dt>Modus</dt>
          <dd>
            {t.groupCount}
            {t.groupCount === 1 ? 'Gruppe' : 'Gruppen'}, je {t.advancePerGroup} weiter in die KO-Runde, {t.fieldCount}
            {t.fieldCount === 1 ? 'Feld' : 'Felder'}
          </dd>
          <dt>Spielart</dt>
          <dd>{FORMAT_LABELS[t.format]}{t.teamSize ? `, Teams zu ${t.teamSize}` : ''}</dd>
          <dt>Wertung</dt>
          <dd>{rules(t)}</dd>
          <dt>Teams</dt>
          <dd>{t.teams.length}</dd>
        </dl>
        {#if upcoming(t).length}
          <h2>Nächste Spiele</h2>
          <ul class="next">
            {#each upcoming(t) as m (m.id)}
              <li>
                <span class="muted">{m.stage === 'GROUP' ? `Gruppe ${m.group}` : 'KO-Runde'}</span>
                <span>{model.teamName(m.homeId)} – {model.teamName(m.awayId)}</span>
                <span class="muted">{matchPlace(m)}</span>
              </li>
            {/each}
          </ul>
        {/if}
      {:else if tab === 'groups'}
        <GroupsTab tournament={t} {model} />
      {:else if tab === 'ko'}
        <BracketTab tournament={t} {model} />
      {:else}
        <TeamsTab tournament={t} {model} />
      {/if}
    </Detail>
    {#if editing}<TournamentEditDialog tournament={t} {model} onclose={() => (editing = false)} />{/if}
  {/snippet}
</AsyncView>

<style>
  .tabs {
    margin-bottom: var(--space-lg);
  }
  .champion {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin-bottom: var(--space-lg);
    padding: var(--space-md) var(--space-lg);
    border: 1px solid var(--color-accent);
    border-radius: var(--radius-lg);
    background: var(--color-accent-soft);
    color: var(--color-accent);
  }
  .next {
    display: grid;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .next li {
    display: grid;
    grid-template-columns: 7rem minmax(0, 1fr) auto;
    gap: var(--space-md);
    min-height: var(--control-height);
    align-items: center;
    border-bottom: 1px solid var(--color-border);
  }
</style>
