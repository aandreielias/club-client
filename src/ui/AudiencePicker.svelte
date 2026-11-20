<script lang="ts">
  import { directory } from '../lib/container';
  import { ROLE_LABELS, type Role } from '../lib/types';
  import ChipPicker from './ChipPicker.svelte';
  import Field from './Field.svelte';
  import { boardSettings, membershipKinds } from '../features/members/services';
  import { audienceLabel, loadAudienceLabels } from './audience';

  /** Who a record is for: roles, offices, teams, membership kinds and single members, mixed as chips (`lib/reach` entries). */
  let { value, onchange, error, hint }: { value: string[]; onchange: (v: string[]) => void; error: string | null; hint: string } = $props();

  loadAudienceLabels();

  const options = $derived([
    ...(Object.keys(ROLE_LABELS) as Role[]).filter((r) => r !== 'GUEST').map((r) => ({ value: `role:${r}`, label: ROLE_LABELS[r], detail: 'Rolle' })),
    ...boardSettings.enabled.map((k) => ({ value: `office:${k}`, label: boardSettings.label(k), detail: 'Funktion' })),
    ...directory.teams.filter((t) => !t.archived).map((t) => ({ value: `team:${t.id}`, label: t.name, detail: 'Team' })),
    ...membershipKinds.options().map((k) => ({ value: `kind:${k.value}`, label: k.label, detail: 'Mitgliedsart' })),
    ...directory.knownPeople().map((p) => ({ value: `member:${p.memberId}`, label: p.name, detail: 'Person' })),
  ]);
</script>

<Field label="Personen und Gruppen" {hint} {error} group>
  <ChipPicker
    label="Personen und Gruppen"
    {value}
    {options}
    {onchange}
    labelOf={audienceLabel}
    placeholder="Rolle, Funktion, Team, Mitgliedsart oder Person"
  />
</Field>
