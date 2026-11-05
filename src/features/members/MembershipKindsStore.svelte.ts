import type { EventBus } from '../../lib/bus';
import { liveEvent } from '../../lib/live/LiveUpdates.svelte';
import { CatalogStore } from '../../lib/state/CatalogStore.svelte';
import type { Member, MembershipType } from '../../lib/types';
import { SEEDED_MEMBERSHIP_KINDS, type MembersApi, type MembershipKind, type MembershipKindInput } from './MembersApi';

export const MEMBERSHIP_KINDS_CHANGED = liveEvent<Record<string, never>>('members.membership-kinds-changed');

/** 'NONE' = no club member (e.g. parents). */
export type MembershipChoice = MembershipType | 'NONE';

/** The club's membership kinds (server: members_membership_kind); the seeded ones until loaded. */
export class MembershipKindsStore extends CatalogStore<MembershipType, MembershipKind, MembershipKindInput> {
  constructor(api: MembersApi, bus: EventBus) {
    super(() => api.membershipKinds(), bus, MEMBERSHIP_KINDS_CHANGED, SEEDED_MEMBERSHIP_KINDS, {
      save: (key, input) => api.saveMembershipKind(key, input),
      delete: (key) => api.deleteMembershipKind(key),
    });
  }

  /**
   * Kinds offered when inviting: with what they allow, without the honorary membership (given by resolution); "Kein Mitglied" for
   * parents and helpers.
   */
  inviteChoices(): { value: MembershipChoice; label: string }[] {
    return [
      { value: 'NONE', label: 'Kein Mitglied (z.B. Eltern)' },
      ...this.value
        .filter((k) => !k.archived && k.key !== 'HONORARY')
        .map((k) => ({
          value: k.key,
          label: `${k.label} · ${[k.votes ? 'Stimmrecht' : 'ohne Stimmrecht', k.eligible && 'wählbar'].filter(Boolean).join(', ')}`,
        })),
    ];
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
