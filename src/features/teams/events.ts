// Live event of the teams module (server: TeamsApi.MembershipChanged).

export const MEMBERSHIP_CHANGED = 'teams.membership-changed';

export interface MembershipChanged {
  teamId: string;
  memberId: string;
}
