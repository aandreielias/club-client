<script lang="ts">
  import { bus } from '../../lib/container';
  import { CONFIRM, TOAST } from '../../channels';
  import { Action } from '../../lib/state/Action.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import {
    ACTION_LABELS,
    FOLLOW_UP_KIND_LABELS,
    MAJORITY_LABELS,
    OWN_ACTION,
    QUORUM_LABELS,
    type ActionRule,
    type FollowUpRule,
    type Majority,
    type Quorum,
    type ResolutionAction,
    type ResolutionRules,
  } from './model';
  import { meetingsApi, resolutionRules } from './services';

  /**
   * Einstellungen › Beschlüsse (admin/board): per decision the majority it fixes and the tasks that follow when it passes.
   */
  const rules = new Resource(async () => structuredClone(await resolutionRules.load()));
  void rules.load();
  const action = new Action();

  const QUORUMS = (Object.keys(QUORUM_LABELS) as Quorum[]).map((q) => ({ value: q, label: `${QUORUM_LABELS[q]} des Vorstands` }));
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

  async function save(event: SubmitEvent, value: ResolutionRules) {
    event.preventDefault();
    if (await action.run(async () => (resolutionRules.value = await meetingsApi.saveResolutionRules(value)))) {
      bus.publish(TOAST, { text: 'Beschlussregeln gespeichert.' });
    }
  }

  /** Removing takes the decision out of every Sitzungsart at once, so it is saved right away (with the other changes of the form). */
  async function setEnabled(value: ResolutionRules, rule: ActionRule, enabled: boolean) {
    const label = ACTION_LABELS[rule.action];
    if (
      !enabled &&
      !(await bus.request(CONFIRM, {
        title: 'Beschlussart entfernen',
        confirmLabel: 'Entfernen',
        danger: true,
        message: `„${label}“ wird aus allen Sitzungsarten genommen und ist für neue Beschlüsse nicht mehr wählbar. Gefasste Beschlüsse bleiben.`,
      }))
    )
      return;
    rule.enabled = enabled;
    if (await action.run(async () => (resolutionRules.value = await meetingsApi.saveResolutionRules(value)))) {
      bus.publish(TOAST, { text: enabled ? `${label} wiederhergestellt. In den Sitzungsarten wieder auswählen.` : `${label} entfernt.` });
    } else {
      rule.enabled = !enabled;
    }
  }
</script>

<AsyncView resource={rules}>
  {#snippet children(value)}
    <form class="stack section" onsubmit={(e) => save(e, value)}>
      <section class="rule stack">
        <h3>Umlaufbeschlüsse des Vorstands</h3>
        <div class="row">
          <Field label="Abstimmen mindestens" hint="Stunden ab dem Öffnen">
            <input type="number" min="1" max="720" bind:value={value.circular.minHours} class="short" />
          </Field>
          <Field label="Gültig, wenn teilnehmen">
            <Select bind:value={value.circular.quorum} options={QUORUMS} aria-label="Nötige Beteiligung" />
          </Field>
        </div>
      </section>
      <p class="muted">
        Was ein Beschluss entscheidet, bringt seine Folgeaufgaben mit. Im Titel setzt {'{beschluss}'} den Beschluss, {'{mitglied}'} das betroffene Mitglied
        und {'{funktion}'} die Funktion ein. Ohne Fälligkeit hat die Aufgabe kein Datum.
      </p>
      {#each value.items.filter((r) => r.enabled) as rule (rule.action)}
        <section class="rule stack">
          <div class="row between">
            <h3>{ACTION_LABELS[rule.action]}</h3>
            <div class="row">
              <Select
                bind:value={() => rule.majority ?? 'FREE', (v) => (rule.majority = v === 'FREE' || !v ? null : (v as Majority))}
                options={MAJORITIES}
                aria-label="Mehrheit für {ACTION_LABELS[rule.action]}"
              />
              {#if rule.action !== 'GENERAL'}
                <Button
                  size="sm"
                  variant="ghost"
                  icon="delete"
                  tooltip="{ACTION_LABELS[rule.action]} entfernen"
                  onclick={() => setEnabled(value, rule, false)}
                />
              {/if}
            </div>
          </div>
          {#each rule.followUps as followUp, i (followUp.id ?? i)}
            <div class="follow">
              <Select bind:value={followUp.kind} options={kinds(rule.action)} aria-label="Art der Folgeaufgabe" />
              <input bind:value={followUp.title} maxlength="150" aria-label="Titel der Folgeaufgabe" required />
              <input
                type="number"
                min="0"
                max="365"
                placeholder="ohne"
                aria-label="Fällig nach Tagen"
                bind:value={() => followUp.dueDays ?? '', (v) => (followUp.dueDays = v === '' || v == null ? null : Math.round(Number(v)))}
              />
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
      {#if value.items.some((r) => !r.enabled)}
        <section class="stack">
          <h3>Entfernte Beschlussarten</h3>
          <p class="muted small">Wiederhergestellt ist eine Beschlussart wieder wählbar, aber in keiner Sitzungsart: dort jeweils neu auswählen.</p>
          {#each value.items.filter((r) => !r.enabled) as rule (rule.action)}
            <div class="row between removed">
              <span>{ACTION_LABELS[rule.action]}</span>
              <Button size="sm" variant="ghost" tooltip="{ACTION_LABELS[rule.action]} wieder anbieten" onclick={() => setEnabled(value, rule, true)}
                >Wiederherstellen</Button
              >
            </div>
          {/each}
        </section>
      {/if}
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
  .removed {
    color: var(--color-text-muted);
  }
  .short {
    width: 6rem;
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
