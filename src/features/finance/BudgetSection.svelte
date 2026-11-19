<script lang="ts">
  import { backStack, bus } from '../../lib/container';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import { Action } from '../../lib/state/Action.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import Button from '../../ui/Button.svelte';
  import EditorForm from '../../ui/EditorForm.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Detail from '../../ui/Detail.svelte';
  import { FINANCE_CHANGED } from './events';
  import { moneyInput, parseMoney } from './model';
  import { categories, financeApi, financeMay, money } from './services';

  /** Planned against booked per category for one fiscal year; WRITE holders plan. */
  let { year, label }: { year: number; label: string } = $props();

  // svelte-ignore state_referenced_locally
  const budget = new Resource(() => financeApi.budget(year));
  $effect(() => {
    void year;
    void budget.load();
  });
  useBus(bus, FINANCE_CHANGED, () => {
    if (!plan) void budget.load();
  });

  const save = new Action();
  /** category → typed amount while planning */
  let plan = $state<Record<string, string> | null>(null);
  backStack.while(
    () => !!plan,
    () => (plan = null),
  );
  const invalid = $derived(plan ? Object.values(plan).some((v) => v.trim() !== '' && parseMoney(v) === null) : false);
  const check = {
    submitted: false,
    get valid() {
      return !invalid;
    },
  };

  function start() {
    const planned = new Map(budget.value?.items.map((l) => [l.category, l.plannedCents]));
    plan = Object.fromEntries(
      categories.items
        .filter((c) => !c.archived || planned.has(c.key))
        .map((c) => [c.key, planned.get(c.key) ? moneyInput(planned.get(c.key)!) : '']),
    );
  }

  async function submit() {
    const items = Object.entries(plan!).map(([category, v]) => ({ category, plannedCents: parseMoney(v) ?? 0 }));
    if (await save.run(async () => budget.set(await financeApi.saveBudget(year, items)))) plan = null;
  }
</script>

<Detail title={`Budget ${label}`}>
  {#snippet actions()}
    {#if financeMay('WRITE') && !plan}
      <Button icon="edit" tooltip="Geplante Beträge je Kategorie für diese Saison" onclick={start}>Planen</Button>
    {/if}
  {/snippet}

  {#if plan}
    <EditorForm action={save} submitLabel="Speichern" oncancel={() => (plan = null)} onsubmit={submit} validate={check}>
      <div class="plan">
        {#each Object.keys(plan) as key (key)}
          <label>
            <span>{categories.label(key)}</span>
            <input
              bind:value={plan[key]}
              inputmode="decimal"
              placeholder="0,00"
              aria-invalid={plan[key].trim() !== '' && parseMoney(plan[key]) === null}
            />
          </label>
        {/each}
      </div>
      {#if invalid}<p class="error small">Beträge wie 1.200,50 eingeben; leer = nicht geplant.</p>{/if}
    </EditorForm>
  {:else if budget.value?.items.length}
    <table class="budget">
      <thead><tr><th>Kategorie</th><th>Geplant</th><th>Gebucht</th><th>Rest</th></tr></thead>
      <tbody>
        {#each budget.value.items as line (line.category)}
          {@const rest = line.plannedCents - line.actualCents}
          <tr>
            <td>
              {categories.label(line.category)}
              <span class="muted small">{categories.get(line.category)?.direction === 'IN' ? 'Einnahme' : 'Ausgabe'}</span>
            </td>
            <td>{line.plannedCents ? money(line.plannedCents) : '–'}</td>
            <td>{money(line.actualCents)}</td>
            <td class:negative={!!line.plannedCents && rest < 0}>{line.plannedCents ? money(rest) : '–'}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {:else if budget.value}
    <p class="empty">Für diese Saison ist nichts geplant oder gebucht.</p>
  {/if}
  <ErrorNote error={budget.error} />
</Detail>

<style>
  .budget {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: var(--space-md);
  }
  .budget th,
  .budget td {
    padding: var(--space-xs) var(--space-sm);
    border-bottom: 1px solid var(--color-border);
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .budget th:first-child,
  .budget td:first-child {
    text-align: left;
  }
  .plan {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
    gap: var(--space-sm);
  }
  .plan label {
    display: grid;
    gap: 2px;
  }
  .negative,
  .error {
    color: var(--color-danger);
  }
</style>
