<script lang="ts">
  import { ROLE_LABELS, type Role } from '../../lib/types';
  import Field from '../../ui/Field.svelte';
  import OptionList from '../../ui/OptionList.svelte';

  /** Checkbox group of club roles; roles outside `allowed` are shown but locked. */
  let { value = $bindable(), allowed, legend }: { value: Role[]; allowed: readonly Role[]; legend: string } = $props();

  // Why a role is locked, shown under it (server: offices give BOARD, tournaments create guests).
  const LOCKED: Partial<Record<Role, string>> = { BOARD: 'Kommt über eine Funktion', GUEST: 'Nur über Turniere' };

  const options = $derived(
    (Object.keys(ROLE_LABELS) as Role[]).map((role) => {
      const disabled = !allowed.includes(role);
      return { value: role, label: ROLE_LABELS[role], disabled, hint: disabled ? (LOCKED[role] ?? 'Nur Admins vergeben sie') : undefined };
    }),
  );
</script>

<Field group label={legend}>
  <OptionList label={legend} {options} bind:value />
</Field>
