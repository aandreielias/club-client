<script lang="ts">
  import SettingsList from '../../ui/SettingsList.svelte';
  import { noticeText } from './model';
  import { meetingTypes } from './services';

  /** Einstellungen › Sitzungsarten (admin/board): the club's meeting types; each opens in the window. */
  void meetingTypes.load().catch(() => {});

  const rows = $derived(meetingTypes.items.map((t) => ({
    key: t.key, label: t.label, archived: t.archived,
    detail: `${t.electorate === 'ASSEMBLY' ? 'Mitglieder' : 'Vorstand'} · Frist ${noticeText(t.noticeHours)}${t.dueBy ? ' · jährlich' : ''}`,
  })));
</script>

<div class="stack section">
  <p class="muted">
    Welche Sitzungen der Verein abhält und nach welchen Regeln: wer eingeladen wird, die Einladungsfrist, wer einberuft, wann die Sitzung
    beschlussfähig ist und was sie beschließen darf.
  </p>
  <SettingsList {rows} kind="meeting-type" newLabel="Neue Sitzungsart" />
</div>

<style>
  p {
    margin: 0;
  }
</style>
