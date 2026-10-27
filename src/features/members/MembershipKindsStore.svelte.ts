import type { EventBus } from '../../lib/bus';
import { liveEvent } from '../../lib/live/LiveUpdates.svelte';
import { LiveStore } from '../../lib/state/LiveStore.svelte';
import type { Member, MembershipType } from '../../lib/types';
import { SEEDED_MEMBERSHIP_KINDS, type MembersApi, type MembershipKind } from './MembersApi';

export const MEMBERSHIP_KINDS_CHANGED = liveEvent<Record<string, never>>('members.membership-kinds-changed');

/** 'NONE' = no club member (e.g. parents). */
export type MembershipChoice = MembershipType | 'NONE';

/** The club's membership kinds (server: members_membership_kind); the seeded ones until loaded. */
export class MembershipKindsStore extends LiveStore<readonly MembershipKind[]> {
  constructor(api: MembersApi, bus: EventBus) {
    super(() => api.membershipKinds(), bus, MEMBERSHIP_KINDS_CHANGED, SEEDED_MEMBERSHIP_KINDS);
  }

  get items(): readonly MembershipKind[] {
    return this.value;
  }

  get(key: MembershipType): MembershipKind | undefined {
    return this.value.find((k) => k.key === key);
  }

  /** Archived ones keep their name on what used them, marked; new records cannot choose them. */
  label(key: MembershipType): string {
    const found = this.get(key);
    return found ? (found.archived ? `${found.label} (archiviert)` : found.label) : key;
  }

  /** The kinds a member may be given; those `current` holds stay offered even when archived. */
  options(current: readonly MembershipType[] = []): { value: MembershipType; label: string }[] {
    return this.value.filter((k) => !k.archived || current.includes(k.key)).map((k) => ({ value: k.key, label: k.label }));
  }

  /** Segmented choice for one kind per member, with "Kein Mitglied". */
  choices(current: readonly MembershipType[] = []): { value: MembershipChoice; label: string }[] {
    return [{ value: 'NONE', label: 'Kein Mitglied' }, ...this.options(current)];
  }

  /** "Außerordentlich, Ehrenmitglied", "Ehrenmitglied" or "Kein Vereinsmitglied". */
  text(member: Member): string {
    return member.membershipTypes.length ? member.membershipTypes.map((t) => this.label(t)).join(', ') : 'Kein Vereinsmitglied';
  }
}
