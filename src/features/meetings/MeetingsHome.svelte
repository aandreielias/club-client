<script lang="ts">
  import { settings } from '../../settings';
  import AgendaSection from '../../ui/AgendaSection.svelte';
</script>

<AgendaSection id="home-meetings" title="Sitzungen der nächsten {settings.home.planningDays} Tage" days={settings.home.planningDays}
  source="MEETING" href="#/meetings" limit={settings.home.listRows} />
