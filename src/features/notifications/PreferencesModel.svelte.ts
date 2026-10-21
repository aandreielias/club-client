import { Action } from '../../lib/state/Action.svelte';
import { Resource } from '../../lib/state/Resource.svelte';
import type { NotificationsApi } from './NotificationsApi';
import { isLockedEmail, type NotificationKind, type Preference } from './model';

/** Editable copy of the notification preferences; saved as a whole. */
export class PreferencesModel {
  readonly stored: Resource<Preference[]>;
  readonly saveAction = new Action();
  draft = $state<Preference[]>([]);
  readonly dirty: boolean;

  constructor(private readonly api: NotificationsApi) {
    this.stored = new Resource(() => this.api.preferences());
    this.dirty = $derived(JSON.stringify(this.draft) !== JSON.stringify(this.stored.value ?? []));
  }

  async load(): Promise<void> {
    await this.stored.load();
    this.draft = (this.stored.value ?? []).map((p) => ({ ...p }));
  }

  preference(kind: NotificationKind): Preference | undefined {
    return this.draft.find((p) => p.kind === kind);
  }

  set(kind: NotificationKind, channel: 'push' | 'email', on: boolean): void {
    const preference = this.preference(kind);
    if (!preference || (channel === 'email' && isLockedEmail(kind))) return;
    preference[channel] = on;
  }

  async save(): Promise<boolean> {
    const saved = await this.saveAction.attempt(() => this.api.savePreferences(this.draft));
    if (!saved) return false;
    this.stored.set(saved);
    this.draft = saved.map((p) => ({ ...p }));
    return true;
  }
}
