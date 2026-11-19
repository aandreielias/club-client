<script lang="ts">
  import { settings } from '../../settings';
  import { bus } from '../../lib/container';
  import { CONFIRM } from '../../channels';
  import Button from '../../ui/Button.svelte';

  const mockMode = settings.runtime.apiMode === 'mock';

  async function resetMockData() {
    const ok = await bus.request(CONFIRM, {
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

<div class="stack">
  {#if mockMode}
    <h3>Testmodus</h3>
    <p class="muted">Die Website läuft ohne Server mit Beispieldaten in diesem Browser.</p>
    <div><Button variant="danger" onclick={resetMockData}>Testdaten zurücksetzen</Button></div>
  {/if}
</div>
