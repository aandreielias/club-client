<script lang="ts">
  import { ROLE_LABELS, type Role } from '../../lib/types';
  import CheckList from '../../ui/CheckList.svelte';

  /** Checkbox group of club roles; roles outside `allowed` are shown but locked. */
  let {
    value = $bindable(),
    allowed,
    legend,
  }: { value: Role[]; allowed: readonly Role[]; legend: string } = $props();

  const options = $derived((Object.keys(ROLE_LABELS) as Role[]).map((role) => ({ value: role, label: ROLE_LABELS[role], disabled: !allowed.includes(role) })));
</script>

<CheckList bind:value {options} {legend} />
