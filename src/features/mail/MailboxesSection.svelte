<script lang="ts">
  import { confirmation, directory } from '../../lib/container';
  import { Action } from '../../lib/state/Action.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import { ROLE_LABELS, type Role } from '../../lib/types';
  import AsyncView from '../../ui/AsyncView.svelte';
  import Button from '../../ui/Button.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import { MailboxForm, type MailboxOwner } from './MailboxForm.svelte';
  import type { MailboxAdmin } from './model';
  import { mailApi, mailCenter } from './services';

  /** Einstellungen › Postfächer (admin/board): which club address each member reads, and the shared ones per role. */
  const mailboxes = new Resource(() => mailApi.allMailboxes());
  void mailboxes.load();
  const members = new Resource(() => directory.allMembers());
  void members.load();

  let form = $state<MailboxForm | null>(null);
  const save = new Action();
  const remove = new Action();

  const owners: { value: MailboxOwner; label: string }[] = [
    { value: 'member', label: 'Persönlich' },
    { value: 'role', label: 'Geteilt (Rolle)' },
  ];
  const roles = (Object.keys(ROLE_LABELS) as Role[]).filter((r) => r !== 'GUEST').map((r) => ({ value: r, label: ROLE_LABELS[r] }));
  const memberOptions = $derived(
    (members.value ?? [])
      .filter((m) => m.active)
      .map((m) => ({ value: m.id, label: `${m.firstName} ${m.lastName}` }))
      .sort((a, b) => a.label.localeCompare(b.label, 'de')),
  );

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!form) return;
    form.submitted = true;
    if (!form.valid) return;
    const f = form;
    if (await save.run(() => mailApi.saveMailbox(f.id, f.toInput()))) {
      form = null;
      await Promise.all([mailboxes.load(), mailCenter.mailboxes.load()]);
    }
  }

  async function destroy(mailbox: MailboxAdmin) {
    const ok = await confirmation.ask({
      title: `Postfach ${mailbox.address} entfernen?`,
      message: 'Niemand liest die Adresse dann mehr in der App. Die E-Mails selbst bleiben beim Mail-Anbieter.',
      confirmLabel: 'Entfernen',
      danger: true,
    });
    if (ok && (await remove.run(() => mailApi.deleteMailbox(mailbox.id)))) await Promise.all([mailboxes.load(), mailCenter.mailboxes.load()]);
  }
</script>

<div class="stack section">
  <p class="muted">
    Welche Vereins-Adresse wer in der App liest: persönliche Postfächer gehören einem Mitglied, geteilte (etwa vorstand@) allen mit einer Rolle.
  </p>
  <ErrorNote error={remove.error} />

  <AsyncView resource={mailboxes}>
    {#snippet children(items)}
      {#if items.length}
        <ul class="boxes">
          {#each items as box (box.id)}
            <li>
              <div class="who">
                <strong>{box.address}</strong>
                <span class="muted">{box.name} · {box.memberId ? (box.memberName ?? 'Mitglied') : `alle ${ROLE_LABELS[box.role!]}`}</span>
              </div>
              <Button size="sm" icon="edit" tooltip="Adresse, Name oder Besitzer ändern" onclick={() => (form = MailboxForm.edit(box))}>Ändern</Button
              >
              <Button size="sm" variant="danger" icon="delete" tooltip="Postfach aus der App entfernen" onclick={() => destroy(box)}>Entfernen</Button
              >
            </li>
          {/each}
        </ul>
      {:else}
        <p class="muted">Noch keine Postfächer.</p>
      {/if}
    {/snippet}
  </AsyncView>

  {#if form}
    <form class="stack edit" onsubmit={submit} novalidate>
      <h3>{form.id ? 'Postfach ändern' : 'Neues Postfach'}</h3>
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
      <ErrorNote error={save.error} />
      <div class="row">
        <Button type="submit" variant="primary" busy={save.busy}>Speichern</Button>
        <Button variant="ghost" onclick={() => (form = null)}>Abbrechen</Button>
      </div>
    </form>
  {:else}
    <div><Button icon="add" onclick={() => (form = new MailboxForm())}>Neues Postfach</Button></div>
  {/if}
</div>

<style>
  p,
  h3 {
    margin: 0;
  }
  .boxes {
    display: grid;
    gap: var(--space-xs);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .boxes li {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }
  .who {
    display: grid;
    flex: 1;
    min-width: 0;
  }
  .who span {
    font-size: var(--font-size-small);
  }
</style>
