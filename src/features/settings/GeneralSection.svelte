<script lang="ts">
  import { settings } from '../../settings';
  import { confirmation, preferences } from '../../lib/container';
  import Button from '../../ui/Button.svelte';
  import ChoiceGroup from '../../ui/ChoiceGroup.svelte';
  import Field from '../../ui/Field.svelte';

  const VIEWS = [
    { value: 'month', label: 'Monat' },
    { value: 'week', label: 'Woche' },
    { value: 'list', label: 'Liste' },
  ] as const;

  const mockMode = settings.runtime.apiMode === 'mock';

  async function resetMockData() {
    const ok = await confirmation.ask({
      title: 'Testdaten zurücksetzen',
      message: 'Alle Änderungen an Terminen, Aufgaben, Dateien und Mitgliedern im Testmodus gehen verloren. Die Seite lädt danach neu.',
      confirmLabel: 'Zurücksetzen',
      danger: true,
    });
    if (!ok) return;
    const { MockTable } = await import('../../lib/mock/MockTable');
    MockTable.resetAll();
    location.reload();
  }
</script>

<div class="stack section">
  <Field label="Kalender öffnet mit">
    <ChoiceGroup name="calendar-view-pref" label="Kalender öffnet mit" options={VIEWS}
      bind:value={() => preferences.values.calendarView, (v) => v && preferences.set('calendarView', v)} />
  </Field>

  {#if mockMode}
    <h3>Testmodus</h3>
    <p class="muted">Die Website läuft ohne Server mit Beispieldaten in diesem Browser.</p>
    <div><Button variant="danger" onclick={resetMockData}>Testdaten zurücksetzen</Button></div>
  {/if}
</div>

<style>
  h3 {
    margin: var(--space-sm) 0 0;
  }
  p {
    margin: 0;
  }
</style>
