<script lang="ts">
  import { bus, session } from '../../lib/container';
  import { TOAST } from '../../channels';
  import type { Member } from '../../lib/types';
  import Button from '../../ui/Button.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import DateInput from '../../ui/DateInput.svelte';
  import type { MemberDetailModel } from './MemberDetailModel.svelte';
  import type { MembershipChoice } from './MembershipKindsStore.svelte';
  import { membershipKinds } from './services';

  /** Membership: type, honorary membership, start date. Admin/board. */
  let { member, model }: { member: Member; model: MemberDetailModel } = $props();

  // svelte-ignore state_referenced_locally
  let type = $state<MembershipChoice>(member.membershipType ?? 'NONE');
  // svelte-ignore state_referenced_locally
  let honorary = $state(member.honorary);
  // svelte-ignore state_referenced_locally
  let since = $state(member.memberSince ?? '');
  const today = session.clock.today();

  const isMember = $derived(type !== 'NONE' || honorary);
  const changed = $derived(
    type !== (member.membershipType ?? 'NONE') || honorary !== member.honorary || (isMember && since !== (member.memberSince ?? '')),
  );

  async function save() {
    const membership = { membershipType: type === 'NONE' ? null : type, honorary, memberSince: isMember ? since || null : null };
    if (await model.setMembership(membership)) bus.publish(TOAST, { text: 'Mitgliedschaft gespeichert.' });
  }
</script>

<div class="stack">
  <ChoiceGroup name="membership-{member.id}" label="Art der Mitgliedschaft" options={membershipKinds.choices(member.membershipType)} bind:value={type} />
  <label class="check"><input type="checkbox" bind:checked={honorary} /> Ehrenmitglied (Beschluss der außerordentlichen Mitgliederversammlung)</label>
  {#if isMember}
    <Field label="Mitglied seit">
      <DateInput bind:value={since} max={today} />
    </Field>
  {/if}
  <p class="muted small">Stimmrecht und Wählbarkeit folgen der Mitgliedsart (Einstellungen › Mitgliedschaft).</p>
  <ErrorNote error={model.membershipAction.error} />
  <div><Button variant="primary" busy={model.membershipAction.busy} disabled={!changed} onclick={save}>Mitgliedschaft speichern</Button></div>
</div>
