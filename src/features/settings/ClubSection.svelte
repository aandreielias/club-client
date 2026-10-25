<script lang="ts">
  import { settings } from '../../settings';
  import { bus, session } from '../../lib/container';
  import { TOAST } from '../../channels';
  import { Action } from '../../lib/state/Action.svelte';
  import Button from '../../ui/Button.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';

  /** Club facts for every member (admin/board edit, with step-up); empty fields take the server's defaults (club.yml). */
  const limits = settings.club;
  const club = session.club!;
  let name = $state(club.name);
  let shortName = $state(club.shortName);
  let address = $state(club.address ?? '');
  let registerNumber = $state(club.registerNumber ?? '');
  let website = $state(club.website ?? '');
  let contactEmail = $state(club.contactEmail ?? '');
  let seasonStartMonth = $state(String(club.seasonStartMonth));

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Intl.DateTimeFormat(club.locale, { month: 'long' }).format(new Date(2026, i, 1)),
  }));
  const action = new Action();

  async function save(event: SubmitEvent) {
    event.preventDefault();
    const edit = { name, shortName, address, registerNumber, website, contactEmail, seasonStartMonth: Number(seasonStartMonth) };
    if (await action.run(() => session.updateClub(edit))) bus.publish(TOAST, { text: 'Vereinsdaten gespeichert.' });
  }
</script>

<form class="stack section readable" onsubmit={save}>
  <p class="muted">Gilt für alle Mitglieder: Name in Seitenleiste, E-Mails, Kalender-Abo und Einladungen. Leere Felder nehmen den Standard des Servers.</p>
  <div class="grid-2">
    <Field label="Name">
      <input bind:value={name} maxlength={limits.nameMaxLength} />
    </Field>
    <Field label="Kurzname" hint="Betreff der E-Mails">
      <input bind:value={shortName} maxlength={limits.shortNameMaxLength} />
    </Field>
  </div>
  <Field label="Anschrift">
    <textarea bind:value={address} maxlength={limits.addressMaxLength} rows="2"></textarea>
  </Field>
  <div class="grid-2">
    <Field label="ZVR-Zahl" hint="Nummer im Vereinsregister">
      <input bind:value={registerNumber} inputmode="numeric" pattern={limits.registerNumberPattern} />
    </Field>
    <Field label="Saison beginnt im">
      <Select bind:value={seasonStartMonth} options={months} aria-label="Saison beginnt im" />
    </Field>
  </div>
  <div class="grid-2">
    <Field label="Website" hint="Mit https://">
      <input type="url" bind:value={website} maxlength={limits.linkMaxLength} pattern="https://.+" />
    </Field>
    <Field label="Kontakt-E-Mail">
      <input type="email" bind:value={contactEmail} maxlength={limits.linkMaxLength} />
    </Field>
  </div>
  <ErrorNote error={action.error} />
  <div><Button type="submit" busy={action.busy}>Speichern</Button></div>
</form>

<style>
  p {
    margin: 0;
  }
</style>
