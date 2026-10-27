<script lang="ts">
  import Button from '../../ui/Button.svelte';
  import Centered from '../../ui/Centered.svelte';
  import ClubSection from '../settings/ClubSection.svelte';

  /** First start of a new club (admin only): its facts first; saving them opens the app. */
  let { onlogout }: { onlogout: () => void } = $props();
</script>

<Centered title="Willkommen" subtitle="Einrichten des Vereins">
  <div class="stack">
    <p class="muted">
      Zuerst Name und Daten des Vereins eintragen. Mit dem Speichern geht die App auf. Danach in den Einstellungen prüfen, ob die Vorgaben zum Verein
      passen: Sitzungsarten, Funktionen, Mitgliedschaft, Beschlüsse und Termine. Den Vereins-PIN unter Sicherheit festlegen.
    </p>
    <ClubSection />
    <div><Button variant="ghost" onclick={onlogout}>Abmelden</Button></div>
  </div>
</Centered>

<style>
  p {
    margin: 0;
  }
</style>
