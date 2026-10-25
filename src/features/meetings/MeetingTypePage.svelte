<script lang="ts">
  import { usePane } from '../../lib/split/usePane';
  import DetailPage from '../../ui/DetailPage.svelte';
  import type { PageProps } from '../Feature';
  import MeetingTypeView from './MeetingTypeView.svelte';

  /** Full page of the meeting type window ("Als Seite öffnen", shared links). */
  let { params }: PageProps = $props();
  const pane = usePane();
</script>

<DetailPage back={{ href: '/settings/meeting-types', label: 'Sitzungsarten' }}>
  <MeetingTypeView id={params.key} onclosed={() => pane.navigate('/settings/meeting-types')} />
</DetailPage>
