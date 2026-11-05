import type { EventBus } from '../../lib/bus';
import { liveEvent } from '../../lib/live/LiveUpdates.svelte';
import { LiveStore } from '../../lib/state/LiveStore.svelte';
import { OFFICE_LABELS, SEEDED_OFFICES, type BoardSettings, type MembersApi, type OfficeKind, type OfficeSetting } from './MembersApi';

export const BOARD_SETTINGS_CHANGED = liveEvent<Record<string, never>>('members.board-settings-changed');

/** The club's office names and rules (server: members_office_setting); null until loaded. */
export class BoardSettingsStore extends LiveStore<BoardSettings | null> {
  constructor(
    private readonly api: MembersApi,
    bus: EventBus,
  ) {
    super(() => api.boardSettings(), bus, BOARD_SETTINGS_CHANGED, null);
  }

  /** Saves a change on the settings as the server has them now (the rest stays), and keeps the answer. */
  async update(change: (current: BoardSettings) => BoardSettings): Promise<BoardSettings> {
    this.value = await this.api.saveBoardSettings(change(await this.api.boardSettings()));
    return this.value;
  }

  /** One office's setting (the settings window); none until loaded. */
  get(office: string): OfficeSetting | undefined {
    return this.value?.offices.find((o) => o.office === office);
  }

  /** The seeded name until the settings are loaded. */
  label(kind: OfficeKind): string {
    return this.value?.offices.find((o) => o.office === kind)?.label ?? OFFICE_LABELS[kind] ?? kind;
  }

  /** Every office of the club in its order (the seeded ones until loaded). */
  get all(): OfficeKind[] {
    return this.value?.offices.map((o) => o.office) ?? [...SEEDED_OFFICES];
  }

  /** Offices the club uses, for pickers. */
  get enabled(): OfficeKind[] {
    return this.all.filter((k) => this.get(k)?.enabled ?? true);
  }

  /** server: BoardSettings.isBoard — holders are on the Vorstand; an unknown office counts as the seeded ones do. */
  isBoard(kind: OfficeKind): boolean {
    return this.get(kind)?.board ?? kind !== 'AUDITOR';
  }
}
