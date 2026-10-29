<script lang="ts">
  import { bus } from '../../lib/container';
  import { CONFIRM, TOAST } from '../../channels';
  import { Action } from '../../lib/state/Action.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import {
    actionLabel,
    FOLLOW_UP_KIND_LABELS,
    isOwnAction,
    MAJORITY_LABELS,
    OWN_ACTION,
    QUORUM_LABELS,
    type ActionRule,
    type FollowUpRule,
    type Majority,
    type Quorum,
    type ResolutionRules,
  } from './model';
  import { meetingsApi, resolutionRules } from './services';

  /**
   * Einstellungen › Beschlüsse (admin/board): per decision the majority it fixes and the tasks that follow when it passes; the club adds
   * decisions of its own. The form edits a deep copy in `$state`, so added and removed rows show at once.
   */
  let value = $state<ResolutionRules | null>(null);
  const load = new Action();
  void load.run(async () => (value = structuredClone(await resolutionRules.load())));
  const action = new Action();
  const MAX_LABEL = 60;
  let newLabel = $state('');

  const QUORUMS = (Object.keys(QUORUM_LABELS) as Quorum[]).map((q) => ({ value: q, label: `${QUORUM_LABELS[q]} des Vorstands` }));
  const MAJORITIES = [
    { value: 'FREE', label: 'Wählt der Beschluss' },
    ...(Object.keys(MAJORITY_LABELS) as Majority[]).map((m) => ({ value: m, label: MAJORITY_LABELS[m] })),
  ];

  const own = (rule: ActionRule) => !rule.action || isOwnAction(rule.action);
  const name = (rule: ActionRule) => (own(rule) ? rule.label || 'Neue Beschlussart' : actionLabel(rule.action!));

  /** Follow-up kinds a decision may have: its own automatic one, and those every decision may have; the club's own only IMPLEMENT. */
  function kinds(rule: ActionRule) {
    return (Object.keys(FOLLOW_UP_KIND_LABELS) as FollowUpRule['kind'][])
      .filter((k) => (own(rule) ? k === 'IMPLEMENT' : !OWN_ACTION[k] || OWN_ACTION[k] === rule.action))
      .map((k) => ({ value: k, label: FOLLOW_UP_KIND_LABELS[k] }));
  }

  function add(rule: ActionRule) {
    rule.followUps.push({ id: null, kind: 'IMPLEMENT', title: `${name(rule)}: {beschluss}`, dueDays: 7 });
  }

  /** A decision of the club's own; it is saved with the form and then offered in the Sitzungsarten. */
  function addOwn() {
    const label = newLabel.trim();
    if (!value || !label) return;
    value.items.push({
      action: null,
      label,
      majority: null,
      enabled: true,
      followUps: [{ id: null, kind: 'IMPLEMENT', title: `${label}: {beschluss}`, dueDays: 14 }],
    });
    newLabel = '';
  }

  async function persist(): Promise<boolean> {
    return action.run(async () => {
      const saved = await meetingsApi.saveResolutionRules(value!);
      resolutionRules.value = saved;
      value = structuredClone(saved);
    });
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (await persist()) bus.publish(TOAST, { text: 'Beschlussregeln gespeichert.' });
  }

  /** Removing takes the decision out of every Sitzungsart at once, so it is saved right away (with the other changes of the form). */
  async function setEnabled(rule: ActionRule, enabled: boolean) {
    const label = name(rule);
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
    if (await persist()) {
      bus.publish(TOAST, { text: enabled ? `${label} wiederhergestellt. In den Sitzungsarten wieder auswählen.` : `${label} entfernt.` });
    } else {
      rule.enabled = !enabled;
    }
  }
</script>

<ErrorNote error={load.error} />
{#if value}
  <form class="stack section" onsubmit={save}>
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
    {#each value.items.filter((r) => r.enabled) as rule, index (rule.action ?? `neu-${index}`)}
      <section class="rule stack">
        <div class="row between">
          {#if own(rule)}
            <input class="name" bind:value={rule.label} maxlength={MAX_LABEL} required aria-label="Name der Beschlussart" />
          {:else}
            <h3>{name(rule)}</h3>
          {/if}
          <div class="row">
            <Select
              bind:value={() => rule.majority ?? 'FREE', (v) => (rule.majority = v === 'FREE' || !v ? null : (v as Majority))}
              options={MAJORITIES}
              aria-label="Mehrheit für {name(rule)}"
            />
            {#if rule.action !== 'GENERAL' && rule.action}
              <Button size="sm" variant="ghost" icon="delete" tooltip="{name(rule)} entfernen" onclick={() => setEnabled(rule, false)} />
            {:else if !rule.action}
              <Button
                size="sm"
                variant="ghost"
                icon="delete"
                tooltip="Neue Beschlussart verwerfen"
                onclick={() => value!.items.splice(value!.items.indexOf(rule), 1)}
              />
            {/if}
          </div>
        </div>
        {#each rule.followUps as followUp, i (followUp.id ?? i)}
          <div class="follow">
            <Select bind:value={followUp.kind} options={kinds(rule)} aria-label="Art der Folgeaufgabe" />
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
    <section class="rule stack">
      <h3>Eigene Beschlussart</h3>
      <p class="muted small">
        Etwa „Budget“ oder „Beitragshöhe“: wird wie ein sonstiger Beschluss gefasst, mit eigener Mehrheit und eigenen Folgeaufgaben, und ist danach in
        den Sitzungsarten auswählbar.
      </p>
      <div class="row">
        <input bind:value={newLabel} maxlength={MAX_LABEL} placeholder="Name der Beschlussart" aria-label="Name der neuen Beschlussart" />
        <Button icon="add" disabled={!newLabel.trim()} onclick={addOwn}>Neue Beschlussart</Button>
      </div>
    </section>
    {#if value.items.some((r) => !r.enabled)}
      <section class="stack">
        <h3>Entfernte Beschlussarten</h3>
        <p class="muted small">Wiederhergestellt ist eine Beschlussart wieder wählbar, aber in keiner Sitzungsart: dort jeweils neu auswählen.</p>
        {#each value.items.filter((r) => !r.enabled) as rule (rule.action)}
          <div class="row between removed">
            <span>{name(rule)}</span>
            <Button size="sm" variant="ghost" tooltip="{name(rule)} wieder anbieten" onclick={() => setEnabled(rule, true)}>Wiederherstellen</Button>
          </div>
        {/each}
      </section>
    {/if}
    <ErrorNote error={action.error} />
    <div><Button type="submit" variant="primary" busy={action.busy}>Speichern</Button></div>
  </form>
{/if}

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
  .name {
    max-width: 20rem;
    font-weight: var(--font-weight-medium);
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
