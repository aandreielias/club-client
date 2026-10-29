<script lang="ts">
  import { backStack, bus } from '../../lib/container';
  import { DetailController, EditSession } from '../../lib/detail/DetailController.svelte';
  import { StoredRecord } from '../../lib/detail/StoredRecord.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Button from '../../ui/Button.svelte';
  import Detail from '../../ui/Detail.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { boardSettings } from '../members/services';
  import { ruleSummary, startText } from './followUpText';
  import { AUTOMATIC_FOLLOW_UPS, isOwnAction, MAJORITY_LABELS, plainFollowUp } from './model';
  import ResolutionRuleEditor from './ResolutionRuleEditor.svelte';
  import { ResolutionRuleForm } from './ResolutionRuleForm.svelte';
  import { saveRule, setRuleEnabled } from './ruleActions';
  import { meetingPolicy as policy, resolutionRules } from './services';

  /** One decision of the resolution rules: its majority and follow-up tasks; admin and board edit, remove or restore it. Window. */
  let { id, handle, onclosed }: { id: string; handle?: WindowHandle; onclosed?: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const view = new DetailController(bus, handle, onclosed);
  const edit = new EditSession<ResolutionRuleForm>(bus, backStack);
  // svelte-ignore state_referenced_locally
  const stored = new StoredRecord(
    view,
    resolutionRules,
    () => id,
    'Diese Beschlussart gibt es nicht mehr.',
    () => edit.save.busy,
  );
  const rule = $derived(stored.record);
  const name = $derived(rule ? resolutionRules.label(id) : '');
  view.title(() => name || undefined);

  async function submit() {
    await edit.submit((form) => saveRule(form.toRule(), form.statutes), 'Beschlussart gespeichert.');
  }
</script>

{#if rule}
  <Detail title={edit.form ? 'Beschlussart bearbeiten' : name}>
    {#snippet meta()}
      <Tag tone="gray">{isOwnAction(id) ? 'eigene' : 'eingebaut'}</Tag>
      {#if !rule.enabled}<Tag tone="gray">Entfernt</Tag>{/if}
    {/snippet}
    {#snippet actions()}
      {#if !edit.form && policy.canEditTypes()}
        <Button icon="edit" onclick={() => edit.edit(new ResolutionRuleForm(rule, resolutionRules.value.statutes))}>Bearbeiten</Button>
        {#if !rule.enabled}
          <Button tooltip="Wieder anbieten; in den Sitzungsarten neu auswählen" onclick={() => setRuleEnabled(bus, id, true)}>Wiederherstellen</Button
          >
        {:else if id !== 'GENERAL'}
          <Button variant="danger" icon="delete" tooltip="Aus allen Sitzungsarten nehmen" onclick={() => setRuleEnabled(bus, id, false)}
            >Entfernen</Button
          >
        {/if}
      {/if}
    {/snippet}

    {#if edit.form}
      <div class="editing" {@attach edit.track}>
        <ResolutionRuleEditor form={edit.form} {name} action={edit.save} submitLabel="Speichern" oncancel={() => edit.cancel()} onsubmit={submit} />
      </div>
    {:else}
      <dl class="props">
        <dt>Mehrheit</dt>
        <dd>{rule.majority ? MAJORITY_LABELS[rule.majority] : 'wählt, wer den Beschluss stellt'}</dd>
        {#if id === 'STATUTES_CHANGE'}
          {@const s = resolutionRules.value.statutes}
          <dt>Statuten liegen</dt>
          <dd>
            {s.fileId ? `„${s.fileName}“ in „${s.folderName}“` : s.folderId ? `im Ordner „${s.folderName}“` : 'nicht festgelegt'}
          </dd>
        {/if}
        <dt>Verfügbar</dt>
        <dd>{rule.enabled ? 'in den Sitzungsarten, die ihn erlauben' : 'nicht mehr; gefasste Beschlüsse bleiben'}</dd>
      </dl>
      <h2>Folgeaufgaben</h2>
      <ul class="follow">
        {#each rule.followUps as followUp, i (followUp.id ?? i)}
          <li>
            <span>{followUp.title}</span>
            <span class="muted small">
              {i + 1}. {ruleSummary(
                { ...plainFollowUp(followUp.kind, followUp.title, followUp.dueDays), ...followUp },
                AUTOMATIC_FOLLOW_UPS.includes(followUp.kind),
                (o) => boardSettings.label(o),
              )}{#if followUp.afterPrevious && i > 0}
                · {startText(followUp, i + 1)}{/if}
            </span>
          </li>
        {:else}
          <li class="muted">Keine.</li>
        {/each}
      </ul>
    {/if}
  </Detail>
{/if}

<style>
  .editing {
    display: contents;
  }
  h2 {
    margin: 0;
    font-size: var(--font-size-base);
  }
  .follow {
    display: grid;
    gap: var(--space-xs);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .follow li {
    display: grid;
    gap: 2px;
  }
</style>
