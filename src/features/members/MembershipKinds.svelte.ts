import type { EventBus } from '../../lib/bus';
import { liveEvent } from '../../lib/live/LiveUpdates.svelte';
import { LiveStore } from '../../lib/state/LiveStore.svelte';
import type { Member, MembershipType } from '../../lib/types';
import { SEEDED_MEMBERSHIP_KINDS, type MembersApi, type MembershipKind } from './MembersApi';

export const MEMBERSHIP_KINDS_CHANGED = liveEvent<Record<string, never>>('members.membership-kinds-changed');

/** 'NONE' = no club member (e.g. parents). */
export type MembershipChoice = MembershipType | 'NONE';

/** The club's membership kinds (server: members_membership_kind); the seeded ones until loaded. */
export class MembershipKinds extends LiveStore<readonly MembershipKind[]> {
  constructor(api: MembersApi, bus: EventBus) {
    super(() => api.membershipKinds(), bus, MEMBERSHIP_KINDS_CHANGED, SEEDED_MEMBERSHIP_KINDS);
  }

  get items(): readonly MembershipKind[] {
    return this.value;
  }

  get(key: MembershipType): MembershipKind | undefined {
    return this.value.find((k) => k.key === key);
  }

  label(key: MembershipType): string {
    return this.get(key)?.label ?? key;
  }

  /** Segmented choice for a member; `current` stays offered even when archived. */
  choices(current?: MembershipType | null): { value: MembershipChoice; label: string }[] {
    return [{ value: 'NONE', label: 'Kein Mitglied' },
      ...this.value.filter((k) => !k.archived || k.key === current).map((k) => ({ value: k.key, label: k.label }))];
  }

  /** "Außerordentlich, Ehrenmitglied", "Ehrenmitglied" or "Kein Vereinsmitglied". */
  text(member: Member): string {
    const parts = [member.membershipType && this.label(member.membershipType), member.honorary && 'Ehrenmitglied'].filter(Boolean);
    return parts.length ? parts.join(', ') : 'Kein Vereinsmitglied';
  }
}
