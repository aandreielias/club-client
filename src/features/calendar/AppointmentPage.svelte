<script lang="ts">
  import DetailPage from '../../ui/DetailPage.svelte';
  import type { PageProps } from '../Feature';
  import AppointmentView from './AppointmentView.svelte';

  /** Full-page form of the appointment window ("Als Seite öffnen", shared links). */
  let { params }: PageProps = $props();
</script>

<DetailPage back={{ href: '/calendar', label: 'Kalender' }}>
  <AppointmentView id={params.id} />
</DetailPage>
