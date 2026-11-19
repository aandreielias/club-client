<script lang="ts">
  import { backStack, bus, commands, session } from '../../lib/container';
  import { useCommands } from '../../lib/keyboard/useCommands.svelte';
  import { useRecordActions } from '../../lib/actions/useRecordActions.svelte';
  import RecordActionButtons from '../../ui/RecordActionButtons.svelte';
  import { meetingTypeActions } from './actions';
  import { DetailController, EditSession } from '../../lib/detail/DetailController.svelte';
  import { StoredRecord } from '../../lib/detail/StoredRecord.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Detail from '../../ui/Detail.svelte';
  import DetailSkeleton from '../../ui/DetailSkeleton.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { boardSettings } from '../members/services';
  import MeetingTypeEditor from './MeetingTypeEditor.svelte';
  import { MeetingTypeForm } from './MeetingTypeForm.svelte';
  import {
    ACTION_KIND_LABELS,
    AUDIENCE_LABELS,
    INVITEES_LABELS,
    MAJORITY_BASE_LABELS,
    MAJORITY_LABELS,
    PROTOCOL_READERS_LABELS,
    majorities,
    noticeText,
    quorumText,
    stepAnchorText,
    SYSTEM_STEP_LABELS,
    VOTING_LABELS,
  } from './model';
  import { meetingsApi, meetingTypes } from './services';

  /** One meeting type with its rules and the steps around each meeting; admin and board edit it. Window and page. */
  let { id, handle, onclosed }: { id: string; handle?: WindowHandle; onclosed?: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const view = new DetailController(bus, handle, onclosed);
  const edit = new EditSession<MeetingTypeForm>(bus, backStack);
  // svelte-ignore state_referenced_locally
  const stored = new StoredRecord(
    view,
    meetingTypes,
    () => id,
    'Diese Sitzungsart gibt es nicht mehr.',
    () => edit.save.busy,
  );
  const type = $derived(stored.record);
  view.title(() => type?.label);

  async function submit() {
    await edit.submit((form) => stored.saved(() => meetingsApi.saveType(id, form.toInput())), 'Sitzungsart gespeichert.');
  }

  const act = useRecordActions(
    commands,
    meetingTypeActions,
    () => (edit.form ? null : type),
    () => view.leave(),
  );
  useCommands(commands, {
    'record.edit': { run: () => type && edit.edit(new MeetingTypeForm(type)), when: () => act.has('record.edit') },
  });
</script>

{#if type}
  <Detail title={edit.form ? 'Sitzungsart bearbeiten' : type.label}>
    {#snippet meta()}
      {#if type.archived}<Tag tone="gray">Archiviert</Tag>{/if}
    {/snippet}
    {#snippet actions()}
      <RecordActionButtons actions={act} />
    {/snippet}

    {#if edit.form}
      <div class="editing" {@attach edit.track}>
        <MeetingTypeEditor form={edit.form} action={edit.save} submitLabel="Speichern" oncancel={() => edit.cancel()} onsubmit={submit} />
      </div>
    {:else}
      <dl class="props">
        <dt>Eingeladen</dt>
        <dd>
          {INVITEES_LABELS[type.invitees]}{#if type.invitees === 'CHOSEN' && (type.minInvitees || type.maxInvitees)}
            {type.minInvitees === type.maxInvitees
              ? ` (genau ${type.minInvitees})`
              : ` (${type.minInvitees ?? 1} bis ${type.maxInvitees ?? 'beliebig viele'})`}{/if}
        </dd>
        <dt>Stimmrecht</dt>
        <dd>{VOTING_LABELS[type.voting]}</dd>
        <dt>Einladungsfrist</dt>
        <dd>{noticeText(type.noticeHours)} vor Beginn</dd>
        <dt>Beschlussfähig</dt>
        <dd>{quorumText(type)}</dd>
        <dt>Einberufen von</dt>
        <dd>{type.conveners.map((o) => boardSettings.label(o)).join(', ')}</dd>
        <dt>Mehrheiten</dt>
        <dd>
          {majorities(type.majorities)
            .map((m) => MAJORITY_LABELS[m])
            .join(', ')}
          {MAJORITY_BASE_LABELS[type.majorityBase]}
        </dd>
        <dt>Protokoll</dt>
        <dd>
          {type.protocol.approvalsNeeded
            ? `${type.protocol.approvalsNeeded} Genehmigung(en) von ${type.protocol.approvers.map((a) => (a === 'CHAIR' ? 'Vorsitz' : 'Schriftführung')).join(' oder ')}`
            : 'ohne Genehmigung'}; lesen: {PROTOCOL_READERS_LABELS[type.protocol.readers]}
        </dd>
        {#if type.maxDays > 1}<dt>Dauer</dt>
          <dd>bis {type.maxDays} Tage</dd>{/if}
        {#if !type.boardSeesDrafts}<dt>Entwürfe</dt>
          <dd>nur für Einberufende und Admins</dd>{/if}
        {#if type.dueBy}<dt>Jährlich</dt>
          <dd>geplant bis {session.format.shortDate(`2000-${type.dueBy}`)}</dd>{/if}
        {#if type.needsReason}<dt>Dringlichkeit</dt>
          <dd>Die Einladung nennt den Grund.</dd>{/if}
      </dl>
      <h2>Ablauf rund um jede Sitzung</h2>
      {#if type.steps.length}
        <ul class="rows steps">
          {#each type.steps as step (step.id)}
            <li>
              <span>{noticeText(step.offsetHours)} {stepAnchorText(step, type.steps)}</span>
              <span>{step.system ? SYSTEM_STEP_LABELS[step.system] : step.title}</span>
              <span class="muted small"
                >{ACTION_KIND_LABELS[step.action]}: {step.audience === 'OFFICE' && step.office
                  ? boardSettings.label(step.office)
                  : AUDIENCE_LABELS[step.audience]}</span
              >
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty">Keine Erinnerungen oder Aufgaben.</p>
      {/if}
    {/if}
  </Detail>
{:else}
  <DetailSkeleton />
{/if}

<style>
  .editing {
    display: contents;
  }
  .steps li {
    display: grid;
    grid-template-columns: 12rem minmax(0, 1fr) auto;
  }
  :global(:root[data-layout='compact']) .steps li {
    grid-template-columns: minmax(0, 1fr);
  }
</style>
