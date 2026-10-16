import type { EventBus } from '../bus';
import { TOAST } from '../notify/ToastService.svelte';
import { Action } from '../state/Action.svelte';
import type { WindowHandle } from '../window/WindowService.svelte';

/** A "new record" window: sets its title, saves, then shows the created record in the same window. */
export class CreateController {
  readonly save = new Action();

  constructor(
    private readonly bus: EventBus,
    private readonly handle: WindowHandle,
    title: string,
  ) {
    $effect(() => handle.setTitle(title));
  }

  /** `write` resolves the new record's id; the window then opens it as `kind`. */
  async submit(write: () => Promise<string>, kind: string, success: string): Promise<void> {
    let created = '';
    if (await this.save.run(async () => (created = await write()))) {
      this.bus.publish(TOAST, { text: success });
      this.handle.replace(kind, created);
    }
  }
}
