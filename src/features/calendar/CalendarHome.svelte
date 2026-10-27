<script lang="ts">
  import { settings } from '../../settings';
  import AgendaSection from '../../ui/AgendaSection.svelte';
</script>

<AgendaSection
  id="home-calendar"
  title="Termine der nächsten {settings.home.calendarDays} Tage"
  days={settings.home.calendarDays}
  source="APPOINTMENT"
  href="#/calendar"
  limit={settings.home.listRows}
/>
