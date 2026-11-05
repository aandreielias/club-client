<script lang="ts">
  import EditorForm from '../../ui/EditorForm.svelte';
  import { directory } from '../../lib/container';
  import type { Action } from '../../lib/state/Action.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import { ROLE_LABELS, type Role } from '../../lib/types';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import type { MailboxForm, MailboxOwner } from './MailboxForm.svelte';
  import { personalLocal } from './model';
  import { mailApi } from './services';

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
  const settings = new Resource(() => mailApi.settings());
  void settings.load();

  /** Picking a member fills in the usual address and the name, as long as they are still empty. */
  function pickMember(id: string) {
    form.memberId = id;
    const member = members.value?.find((m) => m.id === id);
    const domain = settings.value?.domain;
    if (!member) return;
    if (!form.name.trim()) form.name = `${member.firstName} ${member.lastName}`;
    if (!form.address.trim() && domain) form.address = `${personalLocal(member.firstName, member.lastName)}@${domain}`;
  }
  const memberOptions = $derived(
    (members.value ?? [])
      .filter((m) => m.active)
      .map((m) => ({ value: m.id, label: `${m.firstName} ${m.lastName}` }))
      .sort((a, b) => a.label.localeCompare(b.label, 'de')),
  );
</script>

<EditorForm {action} {submitLabel} {oncancel} {onsubmit} validate={form}>
  <ChoiceGroup name="mailbox-owner" label="Wer liest es" options={owners} bind:value={form.owner} />
  <Field label={form.owner === 'member' ? 'Mitglied' : 'Rolle'} error={form.error('owner')}>
    {#if form.owner === 'member'}
      {#if members.error}
        <ErrorNote error={members.error} />
      {:else}
        <Select
          options={memberOptions}
          placeholder={members.value ? 'Mitglied wählen' : 'Mitglieder werden geladen …'}
          disabled={!members.value}
          bind:value={() => form.memberId, pickMember}
        />
      {/if}
    {:else}
      <Select options={roles} placeholder="Rolle wählen" bind:value={form.role} />
    {/if}
  </Field>
  <Field
    label="Adresse"
    hint={settings.value?.domain ? `Endet auf @${settings.value.domain}.` : 'Zuerst die Mail-Domain des Vereins eintragen.'}
    error={form.error('address')}
  >
    <input type="email" autocomplete="off" bind:value={form.address} required />
  </Field>
  <Field label="Name" hint="Erscheint als Absender, etwa „Vorstand“ oder der Name des Mitglieds." error={form.error('name')}>
    <input bind:value={form.name} maxlength="100" required />
  </Field>
</EditorForm>
