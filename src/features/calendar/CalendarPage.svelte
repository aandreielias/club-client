<script lang="ts">
  import { usePane } from '../../lib/split/usePane';
  import { untrack } from 'svelte';
  import { settings } from '../../settings';
  import { bus, calendarSources, commands, directory, permissions, preferences, session, store } from '../../lib/container';
  import { APP_ERROR, TOAST, WINDOW_OPEN } from '../../channels';
  import { BrowserFile } from '../../lib/files/BrowserFile';
  import { Action } from '../../lib/state/Action.svelte';
  import { CalendarExport } from './CalendarExport';
  import { CalendarDrag } from './CalendarDrag';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import Button from '../../ui/Button.svelte';
  import LinkButton from '../../ui/LinkButton.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';

  import Page from '../../ui/Page.svelte';
  import Select from '../../ui/Select.svelte';
  import Toolbar from '../../ui/Toolbar.svelte';
  import { openMenuAt } from '../../ui/contextMenu';
  import AsyncView from '../../ui/AsyncView.svelte';
  import { CALENDAR_VIEWS, CalendarModel, type CalendarView } from './CalendarModel.svelte';
  import { TASK_CHANGED } from '../tasks/events';
  import { MEETING_CHANGED, RESOLUTION_CHANGED } from '../meetings/events';
  import { TOURNAMENT_CHANGED } from '../tournaments/events';
  import { APPOINTMENTS_CHANGED } from './events';
  import FeedDialog from './FeedDialog.svelte';
  import MonthView from './MonthView.svelte';
  import { appointmentPolicy as policy, calendarExport } from './services';
  import WeekView from './WeekView.svelte';

  // Every live event that can touch the calendar (appointments, task due dates, meetings, votes, tournaments) reloads it.
  // Its own pane of the split view, or the main page.
  const pane = usePane();
  const RELOAD_ON = [APPOINTMENTS_CHANGED, TASK_CHANGED, MEETING_CHANGED, RESOLUTION_CHANGED, TOURNAMENT_CHANGED];

  const model = new CalendarModel(calendarSources, session.clock, store, {
    view: (pane.query.get('view') as CalendarView | null) ?? preferences.values.calendarView,
    date: pane.query.get('date') ?? undefined,
    teamId: pane.query.get('team'),
  });
  let subscribing = $state(false);
  const drag = new CalendarDrag(calendarSources, session.clock, settings.calendar.snapMinutes, bus);
  const exporting = new Action();

  /** Every upcoming appointment the member sees, as a file for any calendar app. */
  async function exportIcs() {
    let count = 0;
    const club = session.club?.name ?? '';
    const ok = await exporting.run(async () => {
      const appointments = await calendarExport.appointments();
      count = appointments.length;
      BrowserFile.save(new Blob([calendarExport.ics(appointments, club)], { type: 'text/calendar;charset=utf-8' }), CalendarExport.fileName(club));
    });
    if (ok) bus.publish(TOAST, { text: `${count} Termine exportiert.` });
    else bus.publish(APP_ERROR, exporting.error);
  }

  void model.load();
  directory.loadRosters();
  if (permissions.isManager) directory.loadTeams().catch(() => {});
  useBus(bus, RELOAD_ON, () => void model.load());

  // View, date and team live in the URL (other keys such as the open window stay).
  $effect(() => {
    const changes = {
      view: model.view === preferences.values.calendarView ? null : model.view,
      date: model.anchor === model.today ? null : model.anchor,
      team: model.teamId,
    };
    untrack(() => pane.updateQuery(changes, true));
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
  });

  function newAppointment() {
    const params = new URLSearchParams();
    if (model.teamId) params.set('team', model.teamId);
    bus.publish(WINDOW_OPEN, { kind: 'appointment-new', id: params.toString() || '-' });
  }
</script>

{#snippet filters()}
  {#each calendarSources.all as source (source.id)}
    <Button size="sm" pressed={model.isShown(source.id)} onclick={() => model.toggleSource(source.id)}
      tooltip="{source.label} im Kalender {model.isShown(source.id) ? 'ausblenden' : 'einblenden'}">{source.label}</Button>
  {/each}
  {#if teamOptions.length}
    <Select inline aria-label="Team" value={model.teamId ?? ''} options={[{ value: '', label: 'Alle Teams' }, ...teamOptions]}
      onchange={(team) => model.setTeam(team || null)} />
  {/if}
{/snippet}

{#snippet navigation()}
  <Button size="sm" icon="back" onclick={() => model.previous()} tooltip="Vorheriger Zeitraum" command="calendar.previous" />
  <Button size="sm" icon="calendar" onclick={() => model.goToday()} tooltip="Heute" command="calendar.today" />
  <Button size="sm" icon="next" onclick={() => model.next()} tooltip="Nächster Zeitraum" command="calendar.next" />
{/snippet}

<Page title="Kalender">
  {#snippet actions()}
    <ChoiceGroup name="calendar-view" label="Ansicht" options={CALENDAR_VIEWS}
      bind:value={() => model.view, (view) => view && model.setView(view)} />
    <LinkButton href="#/calendar/absences" tooltip="Urlaub oder Verletzung eintragen: Termine an diesen Tagen zählen als „Nein“">Abwesend melden</LinkButton>
    <Button icon="download" busy={exporting.busy} tooltip="Termine exportieren oder den Kalender in einer Kalender-App abonnieren"
      onclick={(e) => openMenuAt(e.currentTarget as Element, [
        { label: 'Kommende Termine herunterladen (.ics)', icon: 'download', run: () => void exportIcs() },
        { label: 'In Kalender-App abonnieren …', icon: 'link', run: () => (subscribing = true) },
      ])}>Exportieren</Button>
    {#if policy.canCreate()}<Button variant="primary" icon="add" onclick={newAppointment}>Neuer Termin</Button>{/if}
  {/snippet}
  {#snippet context()}
    <h2 class="period" aria-live="polite">{title}</h2>
  {/snippet}


  <div class="view" aria-busy={model.entries.loading}>
    <Toolbar start={filters} end={navigation} label="Filtern und blättern" />
    <AsyncView resource={model.entries}>
      {#snippet children()}
        <div class="grid-view">{#if model.view === 'month'}<MonthView {model} {drag} />{:else}<WeekView {model} {drag} />{/if}</div>
      {/snippet}
    </AsyncView>
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
</style>
