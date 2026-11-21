<script lang="ts">
  import { useBus } from '../../lib/bus/useBus.svelte';
  import { MAIL_SETTINGS_CHANGED } from './events';
  import { settings as limits } from '../../settings';
  import EditorForm from '../../ui/EditorForm.svelte';
  import { bus, directory, store } from '../../lib/container';
  import { boardSettings } from '../members/services';
  import OptionList from '../../ui/OptionList.svelte';
  import PeoplePicker from '../../ui/PeoplePicker.svelte';
  import { PersonListModel } from '../../lib/directory/PersonListModel.svelte';
  import type { Action } from '../../lib/state/Action.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import { displayName, ROLE_LABELS, type Role } from '../../lib/types';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import type { MailboxForm, MailboxOwner } from './MailboxForm.svelte';
  import { personalLocal } from './model';
  import { mailApi } from './services';

  /** Form of a mailbox: address, sender name and who reads it (one member, or everyone with one of the roles, offices or coached teams, plus named members). */
  let {
    form,
    action,
    submitLabel,
    oncancel,
    onsubmit,
  }: { form: MailboxForm; action: Action; submitLabel: string; oncancel: () => void; onsubmit: () => void } = $props();

  const owners: { value: MailboxOwner; label: string }[] = [
    { value: 'member', label: 'Persönlich' },
    { value: 'shared', label: 'Geteilt' },
  ];
  const roles = (Object.keys(ROLE_LABELS) as Role[]).filter((r) => r !== 'GUEST').map((r) => ({ value: r, label: ROLE_LABELS[r] }));
  const members = new Resource(() => directory.allMembers());
  void members.load();
  const settings = new Resource(() => mailApi.settings());
  void settings.load();
  useBus(bus, MAIL_SETTINGS_CHANGED, () => void settings.load());
  void boardSettings.load();
  void directory.loadTeams();
  const offices = $derived(boardSettings.enabled.map((k) => ({ value: k, label: boardSettings.label(k) })));
  const people = new PersonListModel(
    () => directory.candidates(null),
    directory,
    (id) => form.memberIds.includes(id),
    store,
    'mailbox-members',
  );
  void people.load();
  const toggleMember = (id: string) =>
    (form.memberIds = form.memberIds.includes(id) ? form.memberIds.filter((m) => m !== id) : [...form.memberIds, id]);
  const teams = $derived(directory.teams.filter((t) => !t.archived || form.teamIds.includes(t.id)).map((t) => ({ value: t.id, label: t.name })));

  /** Picking a member fills in the usual address and the name, as long as they are still empty. */
  function pickMember(id: string) {
    form.memberId = id;
    const member = members.value?.find((m) => m.id === id);
    const domain = settings.value?.domain;
    if (!member) return;
    if (!form.name.trim()) form.name = displayName(member);
    if (!form.address.trim() && domain)
      form.address = `${personalLocal(member.firstName, member.lastName, settings.value?.addressPattern)}@${domain}`;
  }
  const memberOptions = $derived(
    (members.value ?? [])
      .filter((m) => m.active)
      .map((m) => ({ value: m.id, label: displayName(m) }))
      .sort((a, b) => a.label.localeCompare(b.label, 'de')),
  );
</script>

<EditorForm {action} {submitLabel} {oncancel} {onsubmit} validate={form}>
  <ChoiceGroup name="mailbox-owner" label="Wer liest es" options={owners} bind:value={form.owner} />
  {#if form.owner === 'member'}
    <Field label="Mitglied" error={form.error('owner')}>
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
    </Field>
  {:else}
    <Field
      group
      label="Rollen"
      hint="Gelesen von allen mit einer der Rollen, einem laufenden der Ämter, als Trainer:in einer der Mannschaften oder als gewähltes Mitglied."
      error={form.error('owner')}
    >
      <OptionList label="Rollen" options={roles} bind:value={form.roles} />
    </Field>
    <Field group label="Ämter">
      <OptionList label="Ämter" options={offices} bind:value={form.offices} />
    </Field>
    <Field group label="Mannschaften (Trainer:innen)">
      <OptionList label="Mannschaften" options={teams} bind:value={form.teamIds} />
    </Field>
    <Field group label="Mitglieder" hint="Einzelne Mitglieder, die das Postfach zusätzlich lesen.">
      <PeoplePicker list={people} chosen={form.memberIds} ontoggle={toggleMember} max={20} emptyText="Keine Mitglieder." />
    </Field>
  {/if}
  <Field
    label="Adresse"
    hint={settings.value?.domain ? `Endet auf @${settings.value.domain}.` : 'Zuerst die Mail-Domain des Vereins eintragen.'}
    error={form.error('address')}
  >
    <input type="email" autocomplete="off" bind:value={form.address} required />
  </Field>
  <Field label="Name" hint="Erscheint als Absender, etwa „Vorstand“ oder der Name des Mitglieds." error={form.error('name')}>
    <input bind:value={form.name} maxlength={limits.mail.mailboxNameMaxLength} required />
  </Field>
</EditorForm>
