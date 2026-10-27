<script lang="ts">
  import { bus } from '../../lib/container';
  import { CreateController } from '../../lib/detail/CreateController.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Detail from '../../ui/Detail.svelte';
  import MembershipKindEditor from './MembershipKindEditor.svelte';
  import type { MembershipKindInput } from './MembersApi';
  import { membersApi, membershipKinds } from './services';

  /** New membership kind in the window; afterwards the window shows it. */
  let { handle }: { id: string; handle: WindowHandle } = $props();

  const form = $state<MembershipKindInput>({ label: '', votes: false, eligible: false, sort: 10, archived: false });
  // svelte-ignore state_referenced_locally
  const create = new CreateController(bus, handle, 'Neue Mitgliedsart');

  const submit = () =>
    create.submit(
      async () => {
        const saved = await membersApi.saveMembershipKind(null, { ...form, label: form.label.trim() });
        await membershipKinds.load();
        return saved.key;
      },
      'membership-kind',
      'Mitgliedsart angelegt.',
    );
</script>

<Detail title="Neue Mitgliedsart">
  <MembershipKindEditor {form} action={create.save} submitLabel="Anlegen" canArchive={false} oncancel={() => handle.close()} onsubmit={submit} />
</Detail>
