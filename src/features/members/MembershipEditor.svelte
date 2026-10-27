<script lang="ts">
  import { bus, session } from '../../lib/container';
  import { TOAST } from '../../channels';
  import type { Member, MembershipType } from '../../lib/types';
  import Button from '../../ui/Button.svelte';
  import ChipToggle from '../../ui/ChipToggle.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import DateInput from '../../ui/DateInput.svelte';
  import type { MemberDetailModel } from './MemberDetailModel.svelte';
  import { HONORARY } from './MembersApi';
  import type { MembershipChoice } from './MembershipKindsStore.svelte';
  import { boardSettings, membershipKinds } from './services';

  /** Membership: the kinds (one, or several when the club allows it) and the start date. Admin/board. */
  let { member, model }: { member: Member; model: MemberDetailModel } = $props();

  const multiple = $derived(boardSettings.value?.multipleKinds ?? false);
  // svelte-ignore state_referenced_locally
  let types = $state<MembershipType[]>([...member.membershipTypes]);
  // svelte-ignore state_referenced_locally
  let since = $state(member.memberSince ?? '');
  const today = session.clock.today();

  const isMember = $derived(types.length > 0);
  const changed = $derived(
    [...types].sort().join() !== [...member.membershipTypes].sort().join() || (isMember && since !== (member.memberSince ?? '')),
  );
  /** With one kind per member: an honorary member's former kind, offered back on revoke. */
  const previous = $derived(!multiple && member.membershipTypes.includes(HONORARY) ? member.previousType : null);

  async function save(next: MembershipType[] = types) {
    const membership = { membershipTypes: next, memberSince: next.length ? since || null : null };
    if (await model.setMembership(membership)) bus.publish(TOAST, { text: 'Mitgliedschaft gespeichert.' });
  }
</script>

<div class="stack">
  {#if multiple}
    <ChipToggle label="Arten der Mitgliedschaft" options={membershipKinds.options(member.membershipTypes)} bind:value={types} />
  {:else}
    <ChoiceGroup
      name="membership-{member.id}"
      label="Art der Mitgliedschaft"
      options={membershipKinds.choices(member.membershipTypes)}
      bind:value={() => (types[0] ?? 'NONE') as MembershipChoice, (v) => (types = !v || v === 'NONE' ? [] : [v])}
    />
  {/if}
  {#if previous}
    <div class="row">
      <Button
        busy={model.membershipAction.busy}
        onclick={() => save([previous])}
        tooltip="Ehrenmitgliedschaft aberkennen und wieder {membershipKinds.label(previous)} eintragen">Ehrenmitgliedschaft aberkennen</Button
      >
      <span class="muted small">zurück zu {membershipKinds.label(previous)}</span>
    </div>
  {/if}
  {#if isMember}
    <Field label="Mitglied seit">
      <DateInput bind:value={since} max={today} />
    </Field>
  {/if}
  <p class="muted small">Stimmrecht und Wählbarkeit folgen der Mitgliedsart (Einstellungen › Mitgliedschaft).</p>
  <ErrorNote error={model.membershipAction.error} />
  <div><Button variant="primary" busy={model.membershipAction.busy} disabled={!changed} onclick={() => save()}>Mitgliedschaft speichern</Button></div>
</div>
