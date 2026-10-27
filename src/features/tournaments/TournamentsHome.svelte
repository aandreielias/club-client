<script lang="ts">
  import { settings } from '../../settings';
  import AgendaSection from '../../ui/AgendaSection.svelte';
</script>

<AgendaSection
  id="home-tournaments"
  title="Turniere der nächsten {settings.home.planningDays} Tage"
  days={settings.home.planningDays}
  source="TOURNAMENT"
  href="#/tournaments"
  limit={settings.home.listRows}
/>
