<script lang="ts">
  import { settings } from '../../settings';
  import { Action } from '../../lib/state/Action.svelte';
  import { SettingsDraft } from '../../lib/state/SettingsDraft.svelte';
  import { ROLE_LABELS, type Role } from '../../lib/types';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import Field from '../../ui/Field.svelte';
  import OptionList from '../../ui/OptionList.svelte';
  import SettingsForm from '../../ui/SettingsForm.svelte';
  import { FILE_TYPES, type FileSettings } from './model';
  import { filesApi } from './services';

  /** Einstellungen › Dateien (admin/board): upload quota (club-wide and per role), allowed types, image size and kept versions. */
  const ROLES = (['ADMIN', 'BOARD', 'COACH', 'PLAYER', 'PARENT', 'VOLUNTEER'] as const satisfies readonly Role[]).map((r) => ({
    role: r,
    label: ROLE_LABELS[r],
  }));
  type Form = { quotaGb: number; roleGb: Partial<Record<Role, number | null>>; types: string[]; maxImageSide: number; keepVersions: number };

  const load = new Action();
  // In GB with one decimal, stored in MB (server: 100 MB to 100 GB); an empty role field = the club value.
  const gb = (mb: number) => Math.round((mb / 1024) * 10) / 10;
  const toForm = (s: FileSettings): Form => ({
    quotaGb: gb(s.quotaMb),
    roleGb: Object.fromEntries(Object.entries(s.roleQuotaMb).map(([r, mb]) => [r, gb(mb as number)])),
    types: s.types,
    maxImageSide: s.maxImageSide,
    keepVersions: s.keepVersions,
  });
  const draft = new SettingsDraft<Form>({ quotaGb: 2, roleGb: {}, types: FILE_TYPES.map((t) => t.value), maxImageSide: 3000, keepVersions: 0 });
  void load.run(async () => draft.load(toForm(await filesApi.settings())));

  async function save(value: Form) {
    const roleQuotaMb = Object.fromEntries(
      Object.entries(value.roleGb)
        .filter(([, v]) => v != null && (v as unknown) !== '')
        .map(([r, v]) => [r, Math.round((v as number) * 1024)]),
    );
    const { quotaGb, roleGb: _, ...rest } = value;
    return toForm(await filesApi.saveSettings({ ...rest, quotaMb: Math.round(quotaGb * 1024), roleQuotaMb }));
  }
</script>

<div class="stack">
  <ErrorNote error={load.error} />
  <SettingsForm
    title="Dateien"
    intro="Wie viel ein Mitglied insgesamt hochladen darf (Dateien und Versionen), welche Dateiarten erlaubt sind und wie viele Versionen bleiben. Wer einen Ordner verwaltet, lädt dort ohne Grenze hoch."
    {draft}
    onsave={save}
  >
    <Field label="Speicherplatz je Mitglied" hint="In GB, 0,1 bis 100">
      <input
        type="number"
        min={settings.files.quotaMinGb}
        max={settings.files.quotaMaxGb}
        step="0.1"
        bind:value={draft.value.quotaGb}
        class="short"
      />
    </Field>
    {#each ROLES as r (r.role)}
      <Field label={`Speicherplatz ${r.label}`} hint="In GB; leer = wie oben. Bei mehreren Rollen gilt der größte Wert.">
        <input
          type="number"
          min={settings.files.quotaMinGb}
          max={settings.files.quotaMaxGb}
          step="0.1"
          bind:value={() => draft.value.roleGb[r.role] ?? null, (v) => (draft.value.roleGb = { ...draft.value.roleGb, [r.role]: v })}
          class="short"
        />
      </Field>
    {/each}
    <Field label="Erlaubte Dateiarten" hint="Was Mitglieder in Ordner hochladen dürfen; Fotoalben nehmen nur Bilder. Vorhandene Dateien bleiben.">
      <OptionList label="Erlaubte Dateiarten" options={FILE_TYPES} bind:value={draft.value.types} />
    </Field>
    <Field label="Längste Bildseite" hint="Pixel, 1600 bis 6000; größere Bilder werden beim Hochladen verkleinert.">
      <input
        type="number"
        min={settings.files.imageSideMin}
        max={settings.files.imageSideMax}
        step="100"
        bind:value={draft.value.maxImageSide}
        class="short"
      />
    </Field>
    <Field label="Versionen behalten" hint="Die neuesten je Datei, 0 = alle. Ältere werden beim nächsten Hochladen gelöscht.">
      <input type="number" min="0" max={settings.files.maxKeepVersions} bind:value={draft.value.keepVersions} class="short" />
    </Field>
  </SettingsForm>
</div>
