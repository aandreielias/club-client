<script lang="ts">
  import { usePane } from '../../lib/split/usePane';
  import DetailPage from '../../ui/DetailPage.svelte';
  import type { PageProps } from '../Feature';
  import AppointmentTypeView from './AppointmentTypeView.svelte';

  /** Full page of the appointment type window ("Als Seite öffnen", shared links). */
  let { params }: PageProps = $props();
  const pane = usePane();
</script>

<DetailPage back={{ href: '/settings/appointment-types', label: 'Terminarten' }}>
  <AppointmentTypeView id={params.key} onclosed={() => pane.navigate('/settings/appointment-types')} />
</DetailPage>
