<script lang="ts">
  import { settings } from '../../settings';
  import AgendaSection from '../../ui/AgendaSection.svelte';
</script>

<AgendaSection id="home-agenda" title="Die nächsten {settings.home.agendaDays} Tage" days={settings.home.agendaDays} href="#/calendar" />
