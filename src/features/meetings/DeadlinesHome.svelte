<script lang="ts">
  import { settings } from '../../settings';
  import AgendaSection from '../../ui/AgendaSection.svelte';
</script>

<AgendaSection id="home-deadlines" title="Fristen der nächsten {settings.home.planningDays} Tage" days={settings.home.planningDays}
  source="DEADLINE" href="#/deadlines" limit={settings.home.listRows} />
