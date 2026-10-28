<script lang="ts">
  import { directory } from '../../lib/container';
  import type { Action } from '../../lib/state/Action.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import { ROLE_LABELS, type Role } from '../../lib/types';
  import { autofocus } from '../../ui/autofocus';
  import Button from '../../ui/Button.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import type { MailboxForm, MailboxOwner } from './MailboxForm.svelte';

  /** Form of a mailbox: address, sender name and who reads it (one member, or everyone with a role). */
  let {
    form,
    action,
    submitLabel,
    oncancel,
    onsubmit,
  }: { form: MailboxForm; action: Action; submitLabel: string; oncancel: () => void; onsubmit: () => void } = $props();

  const owners: { value: MailboxOwner; label: string }[] = [
    { value: 'member', label: 'Persönlich' },
    { value: 'role', label: 'Geteilt (Rolle)' },
  ];
  const roles = (Object.keys(ROLE_LABELS) as Role[]).filter((r) => r !== 'GUEST').map((r) => ({ value: r, label: ROLE_LABELS[r] }));
  const members = new Resource(() => directory.allMembers());
  void members.load();
  const memberOptions = $derived(
    (members.value ?? [])
      .filter((m) => m.active)
      .map((m) => ({ value: m.id, label: `${m.firstName} ${m.lastName}` }))
      .sort((a, b) => a.label.localeCompare(b.label, 'de')),
  );

  function submit(event: SubmitEvent) {
    event.preventDefault();
    form.submitted = true;
    if (form.valid) onsubmit();
  }
</script>

<form class="stack" onsubmit={submit} novalidate {@attach autofocus}>
  <Field label="Adresse" error={form.error('address')}>
    <input type="email" autocomplete="off" bind:value={form.address} required />
  </Field>
  <Field label="Name" hint="Erscheint als Absender, etwa „Vorstand“ oder der Name des Mitglieds." error={form.error('name')}>
    <input bind:value={form.name} maxlength="100" required />
  </Field>
  <ChoiceGroup name="mailbox-owner" label="Wer liest es" options={owners} bind:value={form.owner} />
  <Field label={form.owner === 'member' ? 'Mitglied' : 'Rolle'} error={form.error('owner')}>
    {#if form.owner === 'member'}
      <Select options={memberOptions} placeholder="Mitglied wählen" bind:value={form.memberId} />
    {:else}
      <Select options={roles} placeholder="Rolle wählen" bind:value={form.role} />
    {/if}
  </Field>
  <ErrorNote error={action.error} />
  <div class="row">
    <Button type="submit" variant="primary" busy={action.busy}>{submitLabel}</Button>
    <Button variant="ghost" onclick={oncancel}>Abbrechen</Button>
  </div>
</form>
