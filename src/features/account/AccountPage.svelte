<script lang="ts">
  import { settings } from '../../settings';
  import { bus, session } from '../../lib/container';
  import { TOAST, WINDOW_OPEN } from '../../channels';
  import { Action } from '../../lib/state/Action.svelte';
  import { ROLE_LABELS, roleHue } from '../../lib/types';
  import Button from '../../ui/Button.svelte';
  import LinkButton from '../../ui/LinkButton.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import Page from '../../ui/Page.svelte';
  import Tag from '../../ui/Tag.svelte';
  import type { ChangeField } from '../members/MembersApi';
  import { membersApi } from '../members/services';
  import ChangeRequestDialog from './ChangeRequestDialog.svelte';
  import FamilySection from '../members/FamilySection.svelte';
  import { OwnChangeRequests } from './OwnChangeRequests.svelte';
  import HeldItemsSection from '../members/HeldItemsSection.svelte';
  import { BrowserFile } from '../../lib/files/BrowserFile';

  const savePhone = new Action();
  const requests = new OwnChangeRequests(membersApi);
  void requests.load();
  let asking = $state<ChangeField | null>(null);

  const member = $derived(session.member);
  let phone = $state(session.member.phone ?? '');

  const exporting = new Action();
  /** GDPR access request: the member's own data or a ward's, as a JSON file. */
  async function exportData(memberId: string | undefined, name: string) {
    await exporting.run(async () => {
      const data = await session.exportData(memberId);
      const file = `daten-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${session.clock.today()}.json`;
      BrowserFile.save(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), file);
    });
  }

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
    <dt>Zweiter Vorname</dt>
    {@render changeable('MIDDLE_NAME', member.middleName ?? '–')}
    <dt>Nachname</dt>
    {@render changeable('LAST_NAME', member.lastName)}
    <dt>Private E-Mail</dt>
    {@render changeable('EMAIL', member.email ?? '–')}
    <dt>Geburtsdatum</dt>
    {@render changeable('BIRTH_DATE', member.birthDate ? session.format.date(member.birthDate) : '–')}
    <dt>Rollen</dt>
    <dd>
      {#each member.roles as role (role)}<Tag tone={roleHue(role)}>{ROLE_LABELS[role]}</Tag>{/each}
    </dd>
    <dt>Teams</dt>
    <dd>
      {#each session.teams as team (team.id)}<Tag tone="blue">{team.name}</Tag>{:else}–{/each}
    </dd>
  </dl>
  <FamilySection memberId={member.id} firstName={member.firstName} self parent={member.roles.includes('PARENT')} />

  <HeldItemsSection memberId={member.id} title="Bei mir" note="Vor Terminen, die diese Sachen brauchen, bekommst du eine Erinnerung." />

  <h2>Telefon</h2>
  <form class="stack narrow" onsubmit={submitPhone}>
    <Field label="Telefonnummer">
      <input type="tel" bind:value={phone} maxlength={settings.profile.phoneMaxLength} autocomplete="tel" />
    </Field>
    <ErrorNote error={savePhone.error} />
    <div><Button type="submit" variant="primary" busy={savePhone.busy}>Speichern</Button></div>
  </form>

  <h2>Meine Daten</h2>
  <p class="muted small">Alles, was der Verein in der App über dich speichert, als Datei (JSON).</p>
  <div class="row">
    <Button busy={exporting.busy} onclick={() => exportData(undefined, member.firstName)}>Daten herunterladen</Button>
    {#each session.me?.wardIds ?? [] as wardId (wardId)}
      {@const name = session.me?.wardNames[wardId] ?? 'Kind'}
      <Button busy={exporting.busy} onclick={() => exportData(wardId, name)} tooltip="Daten von {name} herunterladen">Daten von {name}</Button>
    {/each}
  </div>
  <ErrorNote error={exporting.error} />
</Page>

<ChangeRequestDialog bind:field={asking} {requests} onsent={() => bus.publish(TOAST, { text: 'Anfrage an den Vorstand gesendet.' })} />

<style>
  .changeable {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-xs) var(--space-sm);
  }
</style>
