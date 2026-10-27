<script lang="ts">
  import { background } from '../../lib/state/background';
  import { bus } from '../../lib/container';
  import { removeRecord, restoreRecord } from '../../lib/detail/removeRecord';
  import { TOAST } from '../../channels';
  import { Action } from '../../lib/state/Action.svelte';
  import ErrorNote from '../../ui/ErrorNote.svelte';
  import SettingsList from '../../ui/SettingsList.svelte';
  import { HONORARY, type BoardSettings } from './MembersApi';
  import Field from '../../ui/Field.svelte';
  import { settings } from '../../settings';
  import { boardSettings, membersApi, membershipKinds } from './services';

  /** Einstellungen › Mitgliedschaft (admin/board): the club's kinds of membership, each opens in the window; whether a member holds several. */
  background(membershipKinds.load());
  background(boardSettings.load());

  const rows = $derived(
    membershipKinds.items.map((k) => ({
      key: k.key,
      label: k.label,
      archived: k.archived,
      inUse: k.inUse,
      detail: [k.votes && 'Stimmrecht', k.eligible && 'wählbar'].filter(Boolean).join(' · ') || 'ohne Stimmrecht',
    })),
  );
  const action = new Action();

  function ops(key: string) {
    const { key: _key, inUse: _inUse, fixed: _fixed, ...input } = membershipKinds.get(key)!;
    return {
      delete: () => membersApi.deleteMembershipKind(key),
      archive: (archived: boolean) => membersApi.saveMembershipKind(key, { ...input, archived }),
      reload: () => membershipKinds.load(),
    };
  }

  async function save(change: Partial<BoardSettings>) {
    const settings = boardSettings.value;
    if (!settings) return;
    if (await action.run(async () => (boardSettings.value = await membersApi.saveBoardSettings({ ...settings, ...change })))) {
      bus.publish(TOAST, { text: 'Gespeichert.' });
    }
  }

  const ageLimits = settings.members.ages;
</script>

<div class="stack section">
  <p class="muted">Welche Arten der Mitgliedschaft es gibt und wer in der Mitgliederversammlung abstimmt und in eine Funktion gewählt werden kann.</p>
  <SettingsList
    {rows}
    kind="membership-kind"
    newLabel="Neue Mitgliedsart"
    onremove={(row) => removeRecord(bus, row, 'Mitgliedsart', ops(row.key))}
    onrestore={(row) => restoreRecord(bus, 'Mitgliedsart', ops(row.key))}
    fixed={(row) => row.key === HONORARY}
  />
  <p class="muted small">Ehrenmitglied lässt sich umbenennen und in seinen Rechten einstellen, aber nicht entfernen: Beschlüsse vergeben es.</p>

  <h3>Mehrere Mitgliedsarten</h3>
  <label class="check">
    <input
      type="checkbox"
      checked={boardSettings.value?.multipleKinds ?? false}
      disabled={!boardSettings.value || action.busy}
      onchange={(e) => save({ multipleKinds: e.currentTarget.checked })}
    />
    Ein Mitglied kann mehrere Mitgliedsarten zugleich haben (z.B. außerordentlich und Ehrenmitglied)
  </label>
  <p class="muted small">Ohne diese Einstellung ersetzt die Ehrenmitgliedschaft die bisherige Art; beim Aberkennen kommt sie zurück.</p>

  <h3>Minderjährige</h3>
  {#if boardSettings.value}
    {@const value = boardSettings.value}
    <div class="grid-2 readable">
      <Field label="Erziehungsberechtigte handeln bis zum Alter" hint="Ab diesem Alter sehen und ändern Eltern nichts mehr für das Mitglied.">
        <input
          type="number"
          min={ageLimits.guardianMin}
          max={ageLimits.guardianMax}
          value={value.guardianUntilAge}
          disabled={action.busy}
          onchange={(e) => save({ guardianUntilAge: e.currentTarget.valueAsNumber })}
        />
      </Field>
      <Field
        label="Eigene Foto-Einwilligung ab"
        hint="Darunter geben Erziehungsberechtigte die Einwilligung, ab diesem Alter nur das Mitglied selbst."
      >
        <input
          type="number"
          min={ageLimits.consentMin}
          max={value.guardianUntilAge}
          value={value.ownConsentAge}
          disabled={action.busy}
          onchange={(e) => save({ ownConsentAge: e.currentTarget.valueAsNumber })}
        />
      </Field>
    </div>
  {/if}
  <ErrorNote error={action.error} />
</div>

<style>
  p,
  h3 {
    margin: 0;
  }
</style>
