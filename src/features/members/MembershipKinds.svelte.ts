import type { EventBus } from '../../lib/bus';
import { liveEvent } from '../../lib/live/LiveUpdates.svelte';
import type { Member, MembershipType } from '../../lib/types';
import { SEEDED_MEMBERSHIP_KINDS, type MembersApi, type MembershipKind } from './MembersApi';

export const MEMBERSHIP_KINDS_CHANGED = liveEvent<Record<string, never>>('members.membership-kinds-changed');

/** 'NONE' = no club member (e.g. parents). */
export type MembershipChoice = MembershipType | 'NONE';

/** The club's membership kinds (server: members_membership_kind), loaded at start and reloaded when the club changes them. */
export class MembershipKinds {
  items = $state.raw<readonly MembershipKind[]>(SEEDED_MEMBERSHIP_KINDS);

  constructor(
    private readonly api: MembersApi,
    private readonly bus: EventBus,
  ) {}

  start(): () => void {
    void this.load().catch(() => {});
    return this.bus.subscribe(MEMBERSHIP_KINDS_CHANGED, () => void this.load().catch(() => {})).unsubscribe;
  }

  async load(): Promise<readonly MembershipKind[]> {
    this.items = await this.api.membershipKinds();
    return this.items;
  }

  get(key: MembershipType): MembershipKind | undefined {
    return this.items.find((k) => k.key === key);
  }

  label(key: MembershipType): string {
    return this.get(key)?.label ?? key;
  }

  /** Segmented choice for a member; `current` stays offered even when archived. */
  choices(current?: MembershipType | null): { value: MembershipChoice; label: string }[] {
    return [{ value: 'NONE', label: 'Kein Mitglied' },
      ...this.items.filter((k) => !k.archived || k.key === current).map((k) => ({ value: k.key, label: k.label }))];
  }

  /** "Außerordentlich, Ehrenmitglied", "Ehrenmitglied" or "Kein Vereinsmitglied". */
  text(member: Member): string {
    const parts = [member.membershipType && this.label(member.membershipType), member.honorary && 'Ehrenmitglied'].filter(Boolean);
    return parts.length ? parts.join(', ') : 'Kein Vereinsmitglied';
  }
}
