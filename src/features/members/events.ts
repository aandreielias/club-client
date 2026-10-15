// Live events of the members module (server: MembersApi.MemberInvited / MemberDeactivated).

export const MEMBER_INVITED = 'members.member-invited';
export const MEMBER_DEACTIVATED = 'members.member-deactivated';

export interface MemberEvent {
  memberId: string;
}
