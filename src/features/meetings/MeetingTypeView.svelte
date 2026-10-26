<script lang="ts">
  import { backStack, bus } from '../../lib/container';
  import { DetailController, EditSession } from '../../lib/detail/DetailController.svelte';
  import { StoredRecord } from '../../lib/detail/StoredRecord.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Button from '../../ui/Button.svelte';
  import Detail from '../../ui/Detail.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { boardSettings } from '../members/services';
  import MeetingTypeEditor from './MeetingTypeEditor.svelte';
  import { MeetingTypeForm } from './MeetingTypeForm.svelte';
  import {
    ACTION_KIND_LABELS, ACTION_LABELS, AUDIENCE_LABELS, MAJORITY_LABELS, majorities, noticeText, quorumText, SYSTEM_STEP_LABELS,
    type MeetingStep,
  } from './model';
  import { meetingPolicy as policy, meetingsApi, meetingTypes, resolutionRules } from './services';

  /** One meeting type with its rules and the steps around each meeting; admin and board edit it. Window and page. */
  let { id, handle, onclosed }: { id: string; handle?: WindowHandle; onclosed?: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const view = new DetailController(bus, handle, onclosed);
  const edit = new EditSession<MeetingTypeForm>(bus, backStack);
  // svelte-ignore state_referenced_locally
  const stored = new StoredRecord(view, meetingTypes, () => id, 'Diese Sitzungsart gibt es nicht mehr.', () => edit.save.busy);
  const type = $derived(stored.record);
  view.title(() => type?.label);

  const ANCHOR_TEXT: Readonly<Record<MeetingStep['anchor'], string>> = {
    BEFORE_INVITE: 'vor der Einladungsfrist',
    BEFORE_START: 'vor Beginn',
    AFTER_END: 'nach dem Ende',
  };

  async function submit() {
    await edit.submit((form) => stored.saved(() => meetingsApi.saveType(id, form.toInput())), 'Sitzungsart gespeichert.');
  }

  function remove(label: string) {
    void stored.remove(label, 'Sitzungsart löschen', 'Sitzungsart gelöscht.', edit.save, () => meetingsApi.deleteType(id));
  }
</script>

{#if type}
  <Detail title={edit.form ? 'Sitzungsart bearbeiten' : type.label}>
    {#snippet actions()}
      {#if !edit.form && policy.canEditTypes()}
        <Button icon="edit" onclick={() => edit.edit(new MeetingTypeForm(type, resolutionRules.value.items))}>Bearbeiten</Button>
        {#if !type.inUse}<Button variant="danger" icon="delete" onclick={() => remove(type.label)}>Löschen</Button>{/if}
      {/if}
    {/snippet}

    {#if edit.form}
      <div class="editing" {@attach edit.track}>
        <MeetingTypeEditor form={edit.form} action={edit.save} submitLabel="Speichern" canArchive oncancel={() => edit.cancel()} onsubmit={submit} />
      </div>
    {:else}
      {#if type.archived}<p><Tag tone="gray">Archiviert</Tag></p>{/if}
      <dl class="props">
        <dt>Eingeladen</dt><dd>{type.electorate === 'ASSEMBLY' ? 'Stimmberechtigte Mitglieder' : 'Vorstand'}</dd>
        <dt>Einladungsfrist</dt><dd>{noticeText(type.noticeHours)} vor Beginn</dd>
        <dt>Beschlussfähig</dt><dd>{quorumText(type)}</dd>
        <dt>Einberufen von</dt><dd>{type.conveners.map((o) => boardSettings.label(o)).join(', ')}</dd>
        <dt>Mehrheiten</dt><dd>{majorities(type).map((m) => MAJORITY_LABELS[m]).join(', ')}</dd>
        <dt>Beschlüsse</dt><dd>{type.actions.map((a) => ACTION_LABELS[a]).join(', ')}</dd>
        {#if type.dueBy}<dt>Jährlich</dt><dd>geplant bis {type.dueBy.split('-').reverse().join('.')}.</dd>{/if}
        {#if type.needsReason}<dt>Dringlichkeit</dt><dd>Die Einladung nennt den Grund.</dd>{/if}
      </dl>
      <h2>Ablauf rund um jede Sitzung</h2>
      <ul class="steps">
        {#each type.steps as step (step.id)}
          <li>
            <span>{noticeText(step.offsetHours)} {ANCHOR_TEXT[step.anchor]}</span>
            <span>{step.system ? SYSTEM_STEP_LABELS[step.system] : step.title}</span>
            <span class="muted small">{ACTION_KIND_LABELS[step.action]} an {AUDIENCE_LABELS[step.audience]}</span>
          </li>
        {:else}
          <li class="muted">Keine Erinnerungen oder Aufgaben.</li>
        {/each}
      </ul>
    {/if}
  </Detail>
{/if}

<style>
  .editing {
    display: contents;
  }
  p {
    margin: 0;
  }
  .steps {
    display: grid;
    gap: var(--space-xs);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .steps li {
    display: grid;
    grid-template-columns: 12rem minmax(0, 1fr) auto;
    gap: var(--space-sm);
    align-items: baseline;
  }
  :global(:root[data-layout='compact']) .steps li {
    grid-template-columns: minmax(0, 1fr);
  }
</style>
