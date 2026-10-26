import type { EventBus } from '../../lib/bus';
import { liveEvent } from '../../lib/live/LiveUpdates.svelte';
import { LiveStore } from '../../lib/state/LiveStore.svelte';
import { OFFICE_KINDS, OFFICE_LABELS, type BoardSettings, type MembersApi, type OfficeKind } from './MembersApi';

export const BOARD_SETTINGS_CHANGED = liveEvent<Record<string, never>>('members.board-settings-changed');

/** The club's office names and rules (server: members_office_setting); null until loaded. */
export class BoardSettingsStore extends LiveStore<BoardSettings | null> {
  constructor(api: MembersApi, bus: EventBus) {
    super(() => api.boardSettings(), bus, BOARD_SETTINGS_CHANGED, null);
  }

  /** The seeded name until the settings are loaded. */
  label(kind: OfficeKind): string {
    return this.value?.offices.find((o) => o.office === kind)?.label ?? OFFICE_LABELS[kind];
  }

  /** Offices the club uses, for pickers. */
  get enabled(): OfficeKind[] {
    return OFFICE_KINDS.filter((k) => this.value?.offices.find((o) => o.office === k)?.enabled ?? true);
  }
}
