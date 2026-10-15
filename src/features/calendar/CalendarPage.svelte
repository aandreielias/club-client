<script lang="ts">
  import { untrack } from 'svelte';
  import { settings } from '../../settings';
  import { calendarSources, commands, directory, live, permissions, preferences, router, session, store, windows } from '../../lib/container';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import { onLive } from '../../lib/live/onLive.svelte';
  import Button from '../../ui/Button.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import DataTable from '../../ui/DataTable.svelte';
  import { windowMenu } from '../../lib/window/windowMenu';

  import Page from '../../ui/Page.svelte';
  import Select from '../../ui/Select.svelte';
  import Tag from '../../ui/Tag.svelte';
  import Toolbar from '../../ui/Toolbar.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import { CalendarListModel } from './CalendarListModel.svelte';
  import { CALENDAR_VIEWS, CalendarModel, type CalendarView } from './CalendarModel.svelte';
  import { APPOINTMENTS_CHANGED } from './events';
  import FeedDialog from './FeedDialog.svelte';
  import MonthView from './MonthView.svelte';
  import { appointmentPolicy as policy } from './services';
  import WeekView from './WeekView.svelte';

  // Other features' events (task changes) are not imported; every live event that can touch the calendar reloads it.
  const RELOAD_ON = [APPOINTMENTS_CHANGED, 'tasks.task-changed'];

  const model = new CalendarModel(calendarSources, session.clock, settings.calendar.agendaDays, store, {
    view: (router.query.get('view') as CalendarView | null) ?? preferences.values.calendarView,
    date: router.query.get('date') ?? undefined,
    teamId: router.query.get('team'),
  });
  const list = new CalendarListModel(() => model.visible, () => session.format, directory, store);
  let subscribing = $state(false);

  void model.load();
  directory.loadRosters();
  if (permissions.isManager) directory.loadTeams().catch(() => {});
  onLive(live, RELOAD_ON, () => void model.load());

  $effect(() => list.set(model.visible));

  // View, date and team live in the URL (other keys such as the open window stay).
  $effect(() => {
    const changes = {
      view: model.view === preferences.values.calendarView ? null : model.view,
      date: model.anchor === model.today ? null : model.anchor,
      team: model.teamId,
    };
    untrack(() => router.updateQuery(changes, true));
  });

  const title = $derived.by(() => {
    const { format } = session;
    if (model.view === 'month') return format.month(model.anchor);
    const last = model.days[model.days.length - 1];
    return `${format.shortDate(model.range.from)} – ${format.shortDate(last)} ${last.slice(0, 4)}`;
  });

  const teamOptions = $derived(policy.filterableTeams().map((t) => ({ value: t.id, label: t.name })));

  useCommands(commands, {
    'page.new': { run: () => newAppointment(), when: () => policy.canCreate() },
    'calendar.previous': { run: () => void model.previous() },
    'calendar.next': { run: () => void model.next() },
    'calendar.today': { run: () => void model.goToday() },
    'calendar.month': { run: () => void model.setView('month') },
    'calendar.week': { run: () => void model.setView('week') },
    'calendar.list': { run: () => void model.setView('list') },
  });

  function newAppointment() {
    const params = new URLSearchParams();
    if (model.teamId) params.set('team', model.teamId);
    windows.open('appointment-new', params.toString() || '-');
  }
</script>

{#snippet filters()}
  {#each calendarSources.all as source (source.id)}
    <Button size="sm" pressed={model.isShown(source.id)} onclick={() => model.toggleSource(source.id)}>{source.label}</Button>
  {/each}
  {#if teamOptions.length}
    <Select inline aria-label="Team" value={model.teamId ?? ''} options={[{ value: '', label: 'Alle Teams' }, ...teamOptions]}
      onchange={(team) => model.setTeam(team || null)} />
  {/if}
{/snippet}

<Page title="Kalender">
  {#snippet actions()}
    <ChoiceGroup name="calendar-view" label="Ansicht" options={CALENDAR_VIEWS}
      bind:value={() => model.view, (view) => view && model.setView(view)} />
    <Button onclick={() => (subscribing = true)}>Abonnieren</Button>
    {#if policy.canCreate()}<Button variant="primary" onclick={newAppointment}>Neuer Termin</Button>{/if}
  {/snippet}
  {#snippet context()}
    <h2 class="period" aria-live="polite">{title}</h2>
  {/snippet}
  {#snippet contextEnd()}
    <Button size="sm" onclick={() => model.previous()}>Zurück</Button>
    <Button size="sm" onclick={() => model.goToday()}>Heute</Button>
    <Button size="sm" onclick={() => model.next()}>Weiter</Button>
  {/snippet}


  <div class="view" aria-busy={model.entries.loading}>
    {#if model.view === 'list'}
      <DataTable model={list} rowKey={(e) => e.key} onopen={(e) => windows.open(e.window.kind, e.window.id)} menu={(e) => windowMenu(windows, router, e.window.kind, e.window.id)} leading={filters}
        emptyText="Keine Einträge in diesem Zeitraum.">
        {#snippet cell(entry, column)}
          {#if column.key === 'title'}
            <span class:inactive={entry.inactive}>{entry.title}</span>
          {:else if column.key === 'label'}
            <Tag tone={entry.hue}>{entry.label}</Tag>
          {:else}
            {list.display(entry, column)}
          {/if}
        {/snippet}
      </DataTable>
    {:else}
      <Toolbar start={filters} label="Filtern" />
      <AsyncView resource={model.entries}>
        {#snippet children()}
          <div class="grid-view">{#if model.view === 'month'}<MonthView {model} />{:else}<WeekView {model} />{/if}</div>
        {/snippet}
      </AsyncView>
    {/if}
  </div>
</Page>

{#if subscribing}<FeedDialog onclose={() => (subscribing = false)} />{/if}

<style>
  .period {
    margin: 0;
    font-size: var(--font-size-h2);
  }
  .view {
    display: grid;
    gap: var(--space-xs);
  }
  .view[aria-busy='true'] {
    opacity: 0.7;
  }
  .grid-view {
    margin-top: var(--space-sm);
  }
  .inactive {
    color: var(--color-text-muted);
    text-decoration: line-through;
  }
</style>
