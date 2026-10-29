<script lang="ts">
  import { settings } from '../../settings';
  import { session } from '../../lib/container';
  import { SettingsDraft } from '../../lib/state/SettingsDraft.svelte';
  import type { Club } from '../../lib/types';
  import Field from '../../ui/Field.svelte';
  import Select from '../../ui/Select.svelte';
  import SettingsForm from '../../ui/SettingsForm.svelte';

  /** Club facts for every member (admin/board edit, with step-up); empty fields take the server's defaults (club.yml). */
  interface ClubForm {
    name: string;
    shortName: string;
    address: string;
    registerNumber: string;
    website: string;
    contactEmail: string;
    seasonStartMonth: string;
    ridesEnabled: boolean;
  }

  const limits = settings.club;
  const formOf = (club: Club): ClubForm => ({
    name: club.name,
    shortName: club.shortName,
    address: club.address ?? '',
    registerNumber: club.registerNumber ?? '',
    website: club.website ?? '',
    contactEmail: club.contactEmail ?? '',
    seasonStartMonth: String(club.seasonStartMonth),
    ridesEnabled: club.ridesEnabled,
  });
  const draft = new SettingsDraft<ClubForm>(formOf(session.club!));

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: new Intl.DateTimeFormat(session.club!.locale, { month: 'long' }).format(new Date(2026, i, 1)),
  }));

  async function save(value: ClubForm): Promise<ClubForm> {
    await session.updateClub({ ...value, seasonStartMonth: Number(value.seasonStartMonth) });
    return formOf(session.club!);
  }
</script>

<div class="stack section readable">
  <SettingsForm
    title="Verein"
    intro="Gilt für alle Mitglieder: Name in Seitenleiste, E-Mails, Kalender-Abo und Einladungen. Leere Felder nehmen den Standard des Servers."
    hint="Speichern fragt nach Code oder PIN."
    {draft}
    onsave={save}
  >
    <div class="grid-2">
      <Field label="Name">
        <input bind:value={draft.value.name} maxlength={limits.nameMaxLength} />
      </Field>
      <Field label="Kurzname" hint="Betreff der E-Mails">
        <input bind:value={draft.value.shortName} maxlength={limits.shortNameMaxLength} />
      </Field>
    </div>
    <Field label="Anschrift">
      <textarea bind:value={draft.value.address} maxlength={limits.addressMaxLength} rows="2"></textarea>
    </Field>
    <div class="grid-2">
      <Field label="Registernummer" hint="Nummer im Vereinsregister">
        <input bind:value={draft.value.registerNumber} maxlength="20" pattern={limits.registerNumberPattern} />
      </Field>
      <Field label="Saison beginnt im">
        <Select bind:value={draft.value.seasonStartMonth} options={months} aria-label="Saison beginnt im" />
      </Field>
    </div>
    <div class="grid-2">
      <Field label="Website" hint="Mit https://">
        <input type="url" bind:value={draft.value.website} maxlength={limits.linkMaxLength} pattern="https://.+" />
      </Field>
      <Field label="Kontakt-E-Mail">
        <input type="email" bind:value={draft.value.contactEmail} maxlength={limits.linkMaxLength} />
      </Field>
    </div>
    <label class="check"
      ><input type="checkbox" bind:checked={draft.value.ridesEnabled} /> Fahrgemeinschaften im Verein anbieten (pro Termin ein- und ausschaltbar)</label
    >
  </SettingsForm>
</div>
