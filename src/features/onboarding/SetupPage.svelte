<script lang="ts">
  import { autofocus } from '../../ui/autofocus';
  import { session } from '../../lib/container';
  import { Action } from '../../lib/state/Action.svelte';
  import { settings } from '../../settings';
  import Button from '../../ui/Button.svelte';
  import Centered from '../../ui/Centered.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import { membersApi } from '../members/services';

  /**
   * First start of a new club (admin only): the club's name and the admin's own name; "Verein anlegen" saves both and opens the
   * app. The rest (address, season, …) waits in Einstellungen › Verein. The first save needs no PIN (server: ClubSettings.save).
   */
  let { onlogout }: { onlogout: () => void } = $props();

  /** The server's placeholder until the club saved its facts (club.yml default). */
  const PLACEHOLDER = 'Mein Verein';
  const limits = settings.club;
  const club = session.club!;
  const me = session.member;

  let name = $state(club.name === PLACEHOLDER ? '' : club.name);
  let shortName = $state(club.shortName === PLACEHOLDER ? '' : club.shortName);
  let firstName = $state(me.firstName);
  let lastName = $state(me.lastName);
  let submitted = $state(false);
  const save = new Action();

  const errors = $derived({
    name: !name.trim() ? 'Name des Vereins angeben.' : name.trim() === PLACEHOLDER ? 'Den echten Namen des Vereins angeben.' : undefined,
    shortName: !shortName.trim() ? 'Kurzname angeben (etwa „SV Musterdorf“).' : undefined,
    firstName: !firstName.trim() ? 'Vorname angeben.' : undefined,
    lastName: !lastName.trim() ? 'Nachname angeben.' : undefined,
  });
  const valid = $derived(Object.values(errors).every((e) => !e));
  const error = (field: keyof typeof errors) => (submitted ? errors[field] : undefined);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    submitted = true;
    if (!valid) return;
    await save.run(async () => {
      if (firstName.trim() !== me.firstName || lastName.trim() !== me.lastName) {
        await membersApi.update(me.id, { firstName: firstName.trim(), lastName: lastName.trim() });
        await session.loadMe();
      }
      // Saving the facts marks the club configured: the app opens.
      await session.updateClub({
        name: name.trim(),
        shortName: shortName.trim(),
        address: club.address ?? '',
        registerNumber: club.registerNumber ?? '',
        website: club.website ?? '',
        contactEmail: club.contactEmail ?? '',
        seasonStartMonth: club.seasonStartMonth,
        ridesEnabled: club.ridesEnabled,
      });
    });
  }
</script>

<Centered title="Willkommen" subtitle="Verein anlegen">
  <form class="stack" onsubmit={submit} novalidate {@attach autofocus}>
    <p class="muted">
      Name des Vereins und dein eigener Name genügen für den Anfang. Danach führt die Karte „Einrichtung“ auf der Startseite durch den Rest:
      Mitgliedsarten, Funktionen, Teams, Sitzungsarten und mehr.
    </p>
    <div class="grid-2">
      <Field label="Name des Vereins" error={error('name')}>
        <input bind:value={name} maxlength={limits.nameMaxLength} placeholder="Sportverein Musterdorf" required />
      </Field>
      <Field label="Kurzname" hint="Betreff der E-Mails" error={error('shortName')}>
        <input bind:value={shortName} maxlength={limits.shortNameMaxLength} placeholder="SV Musterdorf" required />
      </Field>
    </div>
    <div class="grid-2">
      <Field label="Dein Vorname" error={error('firstName')}>
        <input bind:value={firstName} maxlength="80" autocomplete="given-name" required />
      </Field>
      <Field label="Dein Nachname" error={error('lastName')}>
        <input bind:value={lastName} maxlength="80" autocomplete="family-name" required />
      </Field>
    </div>
    <ErrorNote error={save.error} />
    <div class="row">
      <Button type="submit" variant="primary" busy={save.busy}>Verein anlegen</Button>
      <Button variant="ghost" onclick={onlogout}>Abmelden</Button>
    </div>
  </form>
</Centered>

<style>
  p {
    margin: 0;
  }
</style>
