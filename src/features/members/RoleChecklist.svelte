<script lang="ts">
  import { ROLE_LABELS, type Role } from '../../lib/types';
  import Field from '../../ui/Field.svelte';
  import OptionList from '../../ui/OptionList.svelte';

  /** Checkbox group of club roles; roles outside `allowed` are shown but locked. */
  let { value = $bindable(), allowed, legend }: { value: Role[]; allowed: readonly Role[]; legend: string } = $props();

  const options = $derived(
    (Object.keys(ROLE_LABELS) as Role[]).map((role) => ({ value: role, label: ROLE_LABELS[role], disabled: !allowed.includes(role) })),
  );
</script>

<Field label={legend}>
  <OptionList label={legend} {options} bind:value />
</Field>
