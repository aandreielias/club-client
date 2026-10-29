<script lang="ts">
  import FollowUpFlow from './FollowUpFlow.svelte';
  import { NAMES_MEMBER, type FollowUpRule, type ResolutionAction } from './model';
  import { resolutionRules } from './services';

  /**
   * The follow-ups of a motion: those its kind of decision brings (Einstellungen › Beschlüsse, read-only here), then tasks of its own,
   * created after them once it passes.
   */
  let { action, followUps = $bindable() }: { action: ResolutionAction; followUps: FollowUpRule[] } = $props();

  const fromRule = $derived(resolutionRules.get(action)?.followUps ?? []);
  const KINDS = [{ value: 'IMPLEMENT' as const, label: 'Umsetzen' }];
</script>

<fieldset class="stack">
  <legend>Folgeaufgaben bei Annahme</legend>
  {#if fromRule.length}
    <p class="muted small">
      Von der Beschlussart: {fromRule.map((f, i) => `${i + 1}. ${f.title}`).join(' · ')}. Eigene kommen danach dazu.
    </p>
  {:else}
    <p class="muted small">Die Beschlussart bringt keine Folgeaufgaben mit.</p>
  {/if}
  <FollowUpFlow
    bind:followUps
    kinds={KINDS}
    namesMember={NAMES_MEMBER.includes(action)}
    newTitle={'{beschluss}: '}
    firstMayWait={fromRule.length > 0}
  />
</fieldset>

<style>
  fieldset {
    margin: 0;
    padding: 0;
    border: 0;
  }
  legend {
    margin-bottom: var(--space-xs);
    font-size: var(--font-size-small);
    font-weight: var(--font-weight-medium);
  }
  p {
    margin: 0;
  }
</style>
