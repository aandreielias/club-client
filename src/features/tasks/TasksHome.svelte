<script lang="ts">
  import { settings } from '../../settings';
  import { bus, directory } from '../../lib/container';
  import { useBus } from '../../lib/bus/useBus.svelte';
  import SectionHeading from '../../ui/SectionHeading.svelte';
  import { TASK_CHANGED } from './events';
  import { TaskListModel } from './TaskListModel.svelte';
  import TaskTable from './TaskTable.svelte';
  import { taskPolicy, tasksApi } from './services';

  /** Start page section: the member's open tasks, soonest due first (the list's default filters). */
  const list = new TaskListModel(tasksApi, taskPolicy, directory, null);
  void list.load();
  useBus(bus, TASK_CHANGED, () => void list.load());
</script>

<SectionHeading title="Meine Aufgaben" href="#/tasks" />
<TaskTable {list} toolbar={false} limit={settings.home.listRows} emptyText="Dir ist keine offene Aufgabe zugewiesen." />
