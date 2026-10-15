<script lang="ts">
  import { ROLE_LABELS, type Role } from '../../lib/types';

  /** Checkbox group of club roles; roles outside `allowed` are shown but locked. */
  let {
    value = $bindable(),
    allowed,
    legend,
  }: { value: Role[]; allowed: readonly Role[]; legend: string } = $props();

  const all = Object.keys(ROLE_LABELS) as Role[];

  function toggle(role: Role, on: boolean) {
    value = on ? [...value, role] : value.filter((r) => r !== role);
  }
</script>

<fieldset>
  <legend>{legend}</legend>
  <div class="roles">
    {#each all as role (role)}
      <label>
        <input type="checkbox" checked={value.includes(role)} disabled={!allowed.includes(role)}
          onchange={(e) => toggle(role, e.currentTarget.checked)} />
        {ROLE_LABELS[role]}
      </label>
    {/each}
  </div>
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
  .roles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
    gap: var(--space-xs) var(--space-md);
  }
  label {
    display: flex;
    align-items: baseline;
    gap: var(--space-sm);
  }
</style>
