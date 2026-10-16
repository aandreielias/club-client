<script lang="ts">
  import { bus } from '../../lib/container';
  import { NAVIGATE } from '../../channels';
  import DetailPage from '../../ui/DetailPage.svelte';
  import type { PageProps } from '../Feature';
  import TaskView from './TaskView.svelte';

  /** Full-page form of the task window ("Als Seite öffnen", shared links). */
  let { params }: PageProps = $props();
</script>

<DetailPage back={{ href: '/tasks', label: 'Aufgaben' }}>
  <TaskView id={params.id} onclosed={() => bus.publish(NAVIGATE, { path: '/tasks' })} />
</DetailPage>
