<script lang="ts">
  import { settings } from '../../settings';
  import SectionHeading from '../../ui/SectionHeading.svelte';
  import { MemberListModel } from './MemberListModel.svelte';
  import MemberTable from './MemberTable.svelte';
  import { membersApi } from './services';

  /** Start page section (admin, board): the member list; the server asks for the PIN first. */
  const list = new MemberListModel(membersApi, null);
  void list.load();
</script>

<SectionHeading title="Mitglieder" href="#/members" />
<MemberTable {list} toolbar={false} limit={settings.home.listRows} />
