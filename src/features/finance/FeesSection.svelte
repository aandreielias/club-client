<script lang="ts">
  import { backStack, bus, directory, session } from '../../lib/container';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import { Action } from '../../lib/state/Action.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Button from '../../ui/Button.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import EditorForm from '../../ui/EditorForm.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Detail from '../../ui/Detail.svelte';
  import Tag from '../../ui/Tag.svelte';
  import { menu, recordMenu } from '../../ui/contextMenu';
  import { tooltip } from '../../ui/tooltip';
  import { membershipKinds } from '../members/services';
  import { FINANCE_CHANGED } from './events';
  import { chargeStatus, moneyInput, parseMoney } from './model';
  import { financeApi, financeMay, money } from './services';

  /** Mitgliedsbeiträge of one season: the rate per membership kind, generating the charges, and the charges (each opens in the window). */
  let { season, label, handle }: { season: number; label: string; handle: WindowHandle } = $props();
  const today = session.clock.today();

  // svelte-ignore state_referenced_locally
  const rates = new Resource(() => financeApi.feeRates(season));
  // svelte-ignore state_referenced_locally
  const charges = new Resource(() => financeApi.charges(season));
  void membershipKinds.load();
  $effect(() => {
    void season;
    void rates.load();
    void charges.load();
  });
  useBus(bus, FINANCE_CHANGED, () => {
    if (!plan) void rates.load();
    void charges.load();
  });
  const writer = $derived(financeMay('WRITE'));

  const save = new Action();
  /** kind → typed rate and minor rate while editing */
  let plan = $state<Record<string, { cents: string; minor: string }> | null>(null);
  backStack.while(
    () => !!plan,
    () => (plan = null),
  );
  const bad = (v: string) => v.trim() !== '' && parseMoney(v) === null;
  const invalid = $derived(plan ? Object.values(plan).some((r) => bad(r.cents) || bad(r.minor)) : false);
  const check = {
    submitted: false,
    get valid() {
      return !invalid;
    },
  };

  /** Without rates yet, the previous season's are the starting point. */
  async function start() {
    let base = rates.value?.items ?? [];
    if (!base.length && !(await save.run(async () => (base = (await financeApi.feeRates(season - 1)).items)))) return;
    const known = new Map(base.map((r) => [r.kind, r]));
    plan = Object.fromEntries(
      membershipKinds.items
        .filter((k) => !k.archived || known.has(k.key))
        .map((k) => {
          const r = known.get(k.key);
          return [k.key, { cents: r ? moneyInput(r.cents) : '', minor: r?.minorCents != null ? moneyInput(r.minorCents) : '' }];
        }),
    );
  }

  async function submit() {
    // An empty rate = no fee for that kind.
    const items = Object.entries(plan!)
      .filter(([, r]) => r.cents.trim() !== '')
      .map(([kind, r]) => ({ kind, cents: parseMoney(r.cents)!, minorCents: r.minor.trim() ? parseMoney(r.minor) : null }));
    if (await save.run(async () => rates.set(await financeApi.saveFeeRates(season, items)))) plan = null;
  }

  const FILTERS = [
    { value: 'all', label: 'Alle' },
    { value: 'open', label: 'Offen' },
    { value: 'overdue', label: 'Überfällig' },
  ] as const;
  let filter = $state<(typeof FILTERS)[number]['value']>('all');
  const shown = $derived(
    (charges.value?.items ?? []).filter(
      (c) => filter === 'all' || ((c.status === 'OPEN' || c.status === 'PARTIAL') && (filter === 'open' || c.dueOn < today)),
    ),
  );

  const generating = new Action();
  const generate = () => generating.run(async () => charges.set(await financeApi.generateCharges(season)));
</script>

<Detail title={`Mitgliedsbeiträge ${label}`}>
  {#snippet actions()}
    {#if writer && !plan}
      <Button icon="edit" tooltip="Beitrag je Mitgliedsart für diese Saison" onclick={start}>Beiträge festlegen</Button>
      {#if rates.value?.items.length}
        <Button
          icon="add"
          busy={generating.busy}
          tooltip="Jedem aktiven Mitglied mit Mitgliedsart den Beitrag vorschreiben; wer schon einen hat, behält ihn"
          onclick={generate}>Vorschreiben</Button
        >
      {/if}
    {/if}
  {/snippet}

  {#if plan}
    <EditorForm action={save} submitLabel="Speichern" oncancel={() => (plan = null)} onsubmit={submit} validate={check}>
      <div class="plan">
        {#each Object.keys(plan) as key (key)}
          <fieldset>
            <legend>{membershipKinds.label(key)}</legend>
            <label>
              <span class="small">Beitrag</span>
              <input bind:value={plan[key].cents} inputmode="decimal" placeholder="kein Beitrag" aria-invalid={bad(plan[key].cents)} />
            </label>
            <label>
              <span class="small">Minderjährige</span>
              <input bind:value={plan[key].minor} inputmode="decimal" placeholder="wie oben" aria-invalid={bad(plan[key].minor)} />
            </label>
          </fieldset>
        {/each}
      </div>
      {#if invalid}<p class="error small">Beträge wie 120,00 eingeben; leer = kein Beitrag bzw. derselbe für Minderjährige.</p>{/if}
    </EditorForm>
  {:else}
    {#if rates.value?.items.length}
      <p class="muted small">
        {rates.value.items
          .map((r) => `${membershipKinds.label(r.kind)} ${money(r.cents)}${r.minorCents != null ? ` (minderjährig ${money(r.minorCents)})` : ''}`)
          .join(' · ')}
      </p>
    {/if}
    {#if charges.value?.items.length}
      <ChoiceGroup name="fee-filter" label="Beiträge zeigen" options={FILTERS} bind:value={() => filter, (v) => v && (filter = v)} />
      <ul class="rows">
        {#each shown as charge (charge.id)}
          <li {@attach menu(() => recordMenu('fee-charge', charge.id))}>
            <button type="button" class="link-button" onclick={() => handle.open('fee-charge', charge.id)} {@attach tooltip('Beitrag öffnen')}
              >{directory.nameOf(charge.memberId)}</button
            >
            <span class="row">
              <span class="muted small">{money(charge.paidCents)} von {money(charge.amountCents)}</span>
              <Tag tone={chargeStatus(charge, today).tone}>{chargeStatus(charge, today).label}</Tag>
            </span>
          </li>
        {:else}
          <li class="muted">Keine Beiträge in dieser Auswahl.</li>
        {/each}
      </ul>
    {:else if charges.value}
      <p class="empty">{rates.value?.items.length ? 'Noch keine Beiträge vorgeschrieben.' : 'Für diese Saison sind keine Beiträge festgelegt.'}</p>
    {/if}
  {/if}
  <ErrorNote error={rates.error ?? charges.error ?? generating.error ?? (plan ? null : save.error)} />
</Detail>

<style>
  .plan {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
    gap: var(--space-sm);
  }
  fieldset {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-xs);
    margin: 0;
    padding: var(--space-xs) var(--space-sm);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }
  label {
    display: grid;
    gap: 2px;
  }
  .error {
    color: var(--color-danger);
  }
</style>
