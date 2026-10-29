<script lang="ts">
  import { bus } from '../../lib/container';
  import { TOAST } from '../../channels';
  import Button from '../../ui/Button.svelte';
  import Icon from '../../ui/Icon.svelte';
  import SortableList from '../../ui/SortableList.svelte';
  import { tooltip } from '../../ui/tooltip';
  import { boardSettings } from '../members/services';
  import FollowUpRuleDialog from './FollowUpRuleDialog.svelte';
  import { ruleSummary, startText } from './followUpText';
  import { AUTOMATIC_FOLLOW_UPS, type FollowUpRule } from './model';
  import { RULE_LIMITS, type ResolutionRuleForm } from './ResolutionRuleForm.svelte';

  /**
   * The follow-ups of a decision as a numbered workflow: one card each with who, when and what it brings; a card that waits hangs under
   * the one before it. A card opens its dialog; "Reihenfolge ändern" lets them be dragged.
   */
  let { form, name }: { form: ResolutionRuleForm; name: string } = $props();

  let open = $state<{ index: number | null; followUp: FollowUpRule } | null>(null);
  let sorting = $state(false);
  const kinds = $derived(form.kinds());
  const label = (o: NonNullable<FollowUpRule['office']>) => boardSettings.label(o);

  function apply(followUp: FollowUpRule) {
    form.put(open?.index ?? null, followUp);
    open = null;
  }

  /** Taken out at once; the toast puts it back. */
  function remove() {
    const index = open?.index;
    open = null;
    if (index == null) return;
    const removed = form.remove(index);
    bus.publish(TOAST, { text: `„${removed.title}“ entfernt.`, action: { label: 'Rückgängig', run: () => form.restore(index, removed) } });
  }
</script>

{#if sorting}
  <SortableList
    items={form.followUps.map((f, i) => ({ key: String(i), label: `${i + 1}. ${f.title}` }))}
    label="Reihenfolge der Folgeaufgaben"
    onreorder={(keys) => form.reorder(keys)}
  />
  <div class="row between">
    <span class="muted small">Ziehen oder mit Leertaste und Pfeiltasten verschieben. Die erste startet immer mit dem Beschluss.</span>
    <Button variant="primary" onclick={() => (sorting = false)}>Fertig</Button>
  </div>
{:else}
  {#if form.followUps.length}
    <ol class="flow">
      {#each form.followUps as followUp, i (followUp.id ?? `neu-${i}`)}
        {@const automatic = AUTOMATIC_FOLLOW_UPS.includes(followUp.kind)}
        <li class:chained={followUp.afterPrevious && i > 0}>
          {#if followUp.afterPrevious && i > 0}<span class="link muted small">{startText(followUp, i + 1)}</span>{/if}
          <button type="button" class="card" onclick={() => (open = { index: i, followUp })} {@attach tooltip('Folgeaufgabe bearbeiten')}>
            <span class="number" aria-hidden="true">{i + 1}</span>
            <span class="text">
              <span class="title">{followUp.title || 'Ohne Titel'}</span>
              <span class="muted small">{ruleSummary(followUp, automatic, label)}</span>
            </span>
            <span class="kind"><Icon name={automatic ? 'check' : 'tasks'} small label={automatic ? 'erledigt sich selbst' : 'von Hand'} /></span>
          </button>
        </li>
      {/each}
    </ol>
  {:else}
    <p class="muted small">Keine Folgeaufgaben: wenn der Beschluss angenommen ist, entsteht keine Aufgabe.</p>
  {/if}
  <div class="row">
    {#if form.followUps.length < RULE_LIMITS.followUps}
      <Button size="sm" icon="add" onclick={() => (open = { index: null, followUp: form.newFollowUp(`${name || 'Beschluss'}: {beschluss}`) })}
        >Folgeaufgabe</Button
      >
    {/if}
    {#if form.followUps.length > 1}
      <Button size="sm" variant="ghost" icon="sort" tooltip="Die Reihenfolge der Folgeaufgaben ändern" onclick={() => (sorting = true)}
        >Reihenfolge ändern</Button
      >
    {/if}
  </div>
{/if}

<FollowUpRuleDialog
  followUp={open?.followUp ?? null}
  position={open?.index == null ? form.followUps.length + 1 : open.index + 1}
  isNew={open?.index == null}
  {kinds}
  namesMember={form.namesMember}
  onapply={apply}
  onremove={remove}
  onclose={() => (open = null)}
/>

<style>
  p {
    margin: 0;
  }
  .flow {
    display: grid;
    gap: var(--space-xs);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: grid;
    gap: 2px;
  }
  li.chained {
    margin-top: calc(-1 * var(--space-xs));
    padding-left: var(--space-lg);
    border-left: 2px solid var(--color-border-strong);
    margin-left: var(--space-md);
  }
  .link {
    padding-top: var(--space-xs);
  }
  .card {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    width: 100%;
    padding: var(--space-sm);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .card:hover {
    background: var(--color-hover);
  }
  .number {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 1.6rem;
    height: 1.6rem;
    border-radius: 50%;
    background: var(--color-accent-soft);
    color: var(--color-accent);
    font-size: var(--font-size-small);
    font-weight: var(--font-weight-bold);
  }
  .text {
    display: grid;
    flex: 1;
    gap: 2px;
    min-width: 0;
  }
  .title {
    overflow: hidden;
    font-weight: var(--font-weight-medium);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .kind {
    color: var(--color-text-muted);
  }
  .between {
    justify-content: space-between;
  }
</style>
