<script lang="ts">
  import { usePane } from '../../lib/split/usePane';
  import DetailPage from '../../ui/DetailPage.svelte';
  import type { PageProps } from '../Feature';
  import MeetingView from './MeetingView.svelte';

  /** A meeting as a page (from the list and the invitation link). */
  let { params }: PageProps = $props();
  const pane = usePane();
</script>

<DetailPage back={{ href: '/meetings', label: 'Sitzungen' }}>
  <MeetingView id={params.id} onclosed={() => pane.navigate('/meetings')} />
</DetailPage>
