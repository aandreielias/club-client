import { MEMBERSHIP_LABELS, type Hue, type Member, type MembershipType, type Role } from '../../lib/types';

const ROLE_HUES: Readonly<Record<Role, Hue>> = {
  ADMIN: 'red',
  BOARD: 'purple',
  COACH: 'blue',
  PLAYER: 'green',
  PARENT: 'orange',
  VOLUNTEER: 'brown',
  GUEST: 'gray',
};

/** Tag colour of a club role. */
export const roleHue = (role: Role): Hue => ROLE_HUES[role];

export type MembershipChoice = MembershipType | 'NONE';

/** Segmented choice of the membership type; 'NONE' = no club member (e.g. parents). */
export const MEMBERSHIP_CHOICES: readonly { value: MembershipChoice; label: string }[] = [
  { value: 'NONE', label: 'Kein Mitglied' },
  { value: 'ORDINARY', label: MEMBERSHIP_LABELS.ORDINARY },
  { value: 'EXTRAORDINARY', label: MEMBERSHIP_LABELS.EXTRAORDINARY },
];

/** "Außerordentlich, Ehrenmitglied", "Ehrenmitglied" or "Kein Vereinsmitglied". */
export function membershipText(member: Member): string {
  const parts = [member.membershipType && MEMBERSHIP_LABELS[member.membershipType], member.honorary && 'Ehrenmitglied'].filter(Boolean);
  return parts.length ? parts.join(', ') : 'Kein Vereinsmitglied';
}
