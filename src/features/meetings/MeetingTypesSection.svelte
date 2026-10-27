<script lang="ts">
  import { bus } from '../../lib/container';
  import { removeRecord, restoreRecord } from '../../lib/detail/removeRecord';
  import { background } from '../../lib/state/background';
  import SettingsList from '../../ui/SettingsList.svelte';
  import { noticeText } from './model';
  import { meetingsApi, meetingTypes } from './services';

  /** Einstellungen › Sitzungsarten (admin/board): the club's meeting types; each opens in the window. */
  background(meetingTypes.load());

  const rows = $derived(meetingTypes.items.map((t) => ({
    key: t.key, label: t.label, archived: t.archived, inUse: t.inUse,
    detail: `${t.electorate === 'ASSEMBLY' ? 'Mitglieder' : 'Vorstand'} · Frist ${noticeText(t.noticeHours)}${t.dueBy ? ' · jährlich' : ''}`,
  })));

  function ops(key: string) {
    const { key: _key, inUse: _inUse, ...input } = meetingTypes.get(key)!;
    return { delete: () => meetingsApi.deleteType(key), archive: (archived: boolean) => meetingsApi.saveType(key, { ...input, archived }),
      reload: () => meetingTypes.load() };
  }
</script>

<div class="stack section">
  <p class="muted">
    Welche Sitzungen der Verein abhält und nach welchen Regeln: wer eingeladen wird, die Einladungsfrist, wer einberuft, wann die Sitzung
    beschlussfähig ist und was sie beschließen darf.
  </p>
  <SettingsList {rows} kind="meeting-type" newLabel="Neue Sitzungsart" onremove={(row) => removeRecord(bus, row, 'Sitzungsart', ops(row.key))}
    onrestore={(row) => restoreRecord(bus, 'Sitzungsart', ops(row.key))} />
</div>

<style>
  p {
    margin: 0;
  }
</style>
