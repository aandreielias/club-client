import type { EventBus } from '../../lib/bus';
import { liveEvent } from '../../lib/live/LiveUpdates.svelte';
import { OFFICE_KINDS, OFFICE_LABELS, type BoardSettings, type MembersApi, type OfficeKind } from './MembersApi';

export const BOARD_SETTINGS_CHANGED = liveEvent<Record<string, never>>('members.board-settings-changed');

/** The club's office names and rules (server: members_office_setting), loaded at start and reloaded when the club changes them. */
export class BoardSettingsStore {
  value = $state.raw<BoardSettings | null>(null);

  constructor(
    private readonly api: MembersApi,
    private readonly bus: EventBus,
  ) {}

  start(): () => void {
    void this.load().catch(() => {});
    return this.bus.subscribe(BOARD_SETTINGS_CHANGED, () => void this.load().catch(() => {})).unsubscribe;
  }

  async load(): Promise<BoardSettings> {
    this.value = await this.api.boardSettings();
    return this.value;
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
