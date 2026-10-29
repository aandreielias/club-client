<script lang="ts">
  import { bus } from '../../lib/container';
  import { CreateController } from '../../lib/detail/CreateController.svelte';
  import type { WindowHandle } from '../../lib/window/WindowService.svelte';
  import Detail from '../../ui/Detail.svelte';
  import ResolutionRuleEditor from './ResolutionRuleEditor.svelte';
  import { createdAction, ResolutionRuleForm } from './ResolutionRuleForm.svelte';
  import { saveRule } from './ruleActions';
  import { meetingsApi } from './services';

  /** A decision of the club's own in the window; saved, it is offered in circular votes and can be chosen in the Sitzungsarten. */
  let { handle }: { id: string; handle: WindowHandle } = $props();

  const form = new ResolutionRuleForm();
  // svelte-ignore state_referenced_locally
  const create = new CreateController(bus, handle, 'Neue Beschlussart');

  const submit = () =>
    create.submit(
      async () => {
        const before = await meetingsApi.resolutionRules();
        const saved = await saveRule(form.toRule());
        return createdAction(before, saved) ?? 'GENERAL';
      },
      'resolution-rule',
      'Beschlussart angelegt. In den Sitzungsarten auswählen, wo sie gefasst werden darf.',
    );
</script>

<Detail title="Neue Beschlussart">
  <ResolutionRuleEditor
    {form}
    name={form.label.trim()}
    action={create.save}
    submitLabel="Anlegen"
    oncancel={() => handle.close()}
    onsubmit={submit}
  />
</Detail>
