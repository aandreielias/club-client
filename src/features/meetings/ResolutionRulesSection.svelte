<script lang="ts">
  import { bus } from '../../lib/container';
  import { TOAST } from '../../channels';
  import { Action } from '../../lib/state/Action.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Select from '../../ui/Select.svelte';
  import {
    ACTION_LABELS, FOLLOW_UP_KIND_LABELS, MAJORITY_LABELS, OWN_ACTION, type ActionRule, type FollowUpRule, type Majority, type ResolutionAction,
  } from './model';
  import { meetingsApi, meetingTypes } from './services';

  /**
   * Einstellungen › Beschlüsse (admin/board): per decision the majority it fixes and the tasks that follow when it passes; seeded with
   * the statutes' (§8 Abs 9) and the Vereinsgesetz's (§14 Abs 2: report to the authority within four weeks).
   */
  const rules = new Resource(async () => structuredClone(await meetingTypes.loadRules()));
  void rules.load();
  const action = new Action();

  const MAJORITIES = [
    { value: 'FREE', label: 'Wählt der Beschluss' },
    ...(Object.keys(MAJORITY_LABELS) as Majority[]).map((m) => ({ value: m, label: MAJORITY_LABELS[m] })),
  ];

  /** Follow-up kinds a decision may have: its own automatic one, and those every decision may have. */
  function kinds(decision: ResolutionAction) {
    return (Object.keys(FOLLOW_UP_KIND_LABELS) as FollowUpRule['kind'][])
      .filter((k) => !OWN_ACTION[k] || OWN_ACTION[k] === decision)
      .map((k) => ({ value: k, label: FOLLOW_UP_KIND_LABELS[k] }));
  }

  function add(rule: ActionRule) {
    rule.followUps.push({ id: null, kind: 'IMPLEMENT', title: `${ACTION_LABELS[rule.action]}: {beschluss}`, dueDays: 7 });
  }

  async function save(event: SubmitEvent, items: ActionRule[]) {
    event.preventDefault();
    if (await action.run(async () => (meetingTypes.rules = await meetingsApi.saveResolutionRules(items)))) {
      bus.publish(TOAST, { text: 'Beschlussregeln gespeichert.' });
    }
  }
</script>

<AsyncView resource={rules}>
  {#snippet children(items)}
    <form class="stack section" onsubmit={(e) => save(e, items)}>
      <p class="muted">
        Was ein Beschluss entscheidet, bringt seine Folgeaufgaben mit. Im Titel setzt {'{beschluss}'} den Beschluss, {'{mitglied}'} das
        betroffene Mitglied und {'{funktion}'} die Funktion ein. Ohne Fälligkeit hat die Aufgabe kein Datum.
      </p>
      {#each items as rule (rule.action)}
        <section class="rule stack">
          <div class="row between">
            <h3>{ACTION_LABELS[rule.action]}</h3>
            <Select bind:value={() => rule.majority ?? 'FREE', (v) => (rule.majority = v === 'FREE' || !v ? null : (v as Majority))}
              options={MAJORITIES} aria-label="Mehrheit für {ACTION_LABELS[rule.action]}" />
          </div>
          {#each rule.followUps as followUp, i (followUp.id ?? i)}
            <div class="follow">
              <Select bind:value={followUp.kind} options={kinds(rule.action)} aria-label="Art der Folgeaufgabe" />
              <input bind:value={followUp.title} maxlength="150" aria-label="Titel der Folgeaufgabe" required />
              <input type="number" min="0" max="365" placeholder="ohne" aria-label="Fällig nach Tagen"
                bind:value={() => followUp.dueDays ?? '', (v) => (followUp.dueDays = v === '' || v == null ? null : Math.round(Number(v)))} />
              <span class="muted small">Tage</span>
              <Button size="sm" variant="ghost" onclick={() => rule.followUps.splice(i, 1)}>Entfernen</Button>
            </div>
          {:else}
            <p class="muted small">Keine Folgeaufgaben.</p>
          {/each}
          {#if rule.followUps.length < 10}
            <div><Button size="sm" onclick={() => add(rule)}>Folgeaufgabe hinzufügen</Button></div>
          {/if}
        </section>
      {/each}
      <ErrorNote error={action.error} />
      <div><Button type="submit" variant="primary" busy={action.busy}>Speichern</Button></div>
    </form>
  {/snippet}
</AsyncView>

<style>
  p,
  h3 {
    margin: 0;
  }
  .rule {
    padding: var(--space-md);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
  }
  .between {
    justify-content: space-between;
  }
  .follow {
    display: grid;
    grid-template-columns: 14rem minmax(10rem, 1fr) 5rem auto auto;
    gap: var(--space-sm);
    align-items: center;
  }
  :global([data-layout='compact']) .follow {
    grid-template-columns: 1fr;
  }
</style>
