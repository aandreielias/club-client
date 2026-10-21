<script lang="ts">
  import { settings } from '../../settings';
  import { bus, session } from '../../lib/container';
  import { TOAST, WINDOW_OPEN } from '../../channels';
  import { Action } from '../../lib/state/Action.svelte';
  import { ROLE_LABELS } from '../../lib/types';
  import Button from '../../ui/Button.svelte';
  import LinkButton from '../../ui/LinkButton.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import Page from '../../ui/Page.svelte';
  import Tag from '../../ui/Tag.svelte';
  import type { ChangeField } from '../members/MembersApi';
  import { membersApi } from '../members/services';
  import ChangeRequestDialog from './ChangeRequestDialog.svelte';
  import { OwnChangeRequests } from './OwnChangeRequests.svelte';
  import { Resource } from '../../lib/state/Resource.svelte';
  import { inventoryApi } from '../inventory/services';

  const savePhone = new Action();
  const requests = new OwnChangeRequests(membersApi);
  void requests.load();
  let asking = $state<ChangeField | null>(null);
  /** Club items the member has at home; they get a reminder before appointments that need them. */
  const held = new Resource(() => inventoryApi.mine());
  void held.load();

  const member = $derived(session.member);
  let phone = $state(session.member.phone ?? '');

  async function submitPhone(event: SubmitEvent) {
    event.preventDefault();
    if (await savePhone.run(() => session.updateProfile({ phone: phone.trim() }))) bus.publish(TOAST, { text: 'Telefonnummer gespeichert.' });
  }
</script>

{#snippet changeable(field: ChangeField, value: string)}
  {@const pending = requests.pending(field)}
  <dd class="changeable">
    <span>{value}</span>
    {#if pending}
      <Tag tone="warning">Angefragt: {field === 'BIRTH_DATE' ? session.format.date(pending.newValue) : pending.newValue}</Tag>
    {:else}
      <Button size="sm" variant="ghost" onclick={() => (asking = field)}>Änderung anfragen</Button>
    {/if}
  </dd>
{/snippet}

<Page title="Mein Konto">
  {#snippet actions()}
    <Button onclick={() => bus.publish(WINDOW_OPEN, { kind: 'settings', id: 'security' })}>Passwort und Sicherheit</Button>
    <Button onclick={() => bus.publish(WINDOW_OPEN, { kind: 'settings', id: 'appearance' })}>Einstellungen</Button>
    <LinkButton href="#/calendar/absences" tooltip="Urlaub oder Verletzung eintragen">Abwesenheiten</LinkButton>
  {/snippet}


  <dl class="props">
    <dt>Vorname</dt>
    {@render changeable('FIRST_NAME', member.firstName)}
    <dt>Nachname</dt>
    {@render changeable('LAST_NAME', member.lastName)}
    <dt>E-Mail</dt>
    {@render changeable('EMAIL', member.email)}
    <dt>Geburtsdatum</dt>
    {@render changeable('BIRTH_DATE', member.birthDate ? session.format.date(member.birthDate) : '–')}
    <dt>Rollen</dt>
    <dd>{#each member.roles as role (role)}<Tag tone="gray">{ROLE_LABELS[role]}</Tag>{/each}</dd>
    <dt>Teams</dt>
    <dd>{#each session.teams as team (team.id)}<Tag tone="blue">{team.name}</Tag>{:else}–{/each}</dd>
  </dl>

  {#if held.value?.length}
    <h2>Bei mir</h2>
    <ul class="held">
      {#each held.value as item (item.itemId)}
        <li><span>{item.name}</span><span class="count">{item.quantity}</span></li>
      {/each}
    </ul>
    <p class="muted small">Vor Terminen, die diese Sachen brauchen, bekommst du eine Erinnerung.</p>
  {/if}

  <h2>Telefon</h2>
  <form class="stack narrow" onsubmit={submitPhone}>
    <Field label="Telefonnummer">
      <input type="tel" bind:value={phone} maxlength={settings.profile.phoneMaxLength} autocomplete="tel" />
    </Field>
    <ErrorNote error={savePhone.error} />
    <div><Button type="submit" busy={savePhone.busy}>Speichern</Button></div>
  </form>
</Page>

<ChangeRequestDialog bind:field={asking} {requests} onsent={() => bus.publish(TOAST, { text: 'Anfrage an den Vorstand gesendet.' })} />

<style>
  .held {
    display: grid;
    max-width: var(--layout-readable-width);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .held li {
    display: flex;
    justify-content: space-between;
    gap: var(--space-md);
    padding: var(--space-xs) 0;
    border-bottom: 1px solid var(--color-border);
  }
  .count {
    font-variant-numeric: tabular-nums;
  }
  .small {
    font-size: var(--font-size-small);
  }
  .changeable {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-xs) var(--space-sm);
  }
</style>
