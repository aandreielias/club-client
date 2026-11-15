import { attempt, confirmed, inWindow, type RecordActionProvider } from '../../lib/actions/RecordActions';
import { catalogActions } from '../../lib/actions/catalogActions';
import { bus, permissions } from '../../lib/container';
import { displayName, type Member } from '../../lib/types';
import { SEEDED_OFFICES, type OfficeSetting } from './MembersApi';
import { boardSettings, memberPolicy as policy, membersApi, membershipKinds } from './services';

/** A member and whether a sent invitation is still unused (known only to who may invite). */
export interface MemberRecord {
  member: Member;
  invited: boolean;
}

/** What can be done with a member: context menus, the profile window and the command palette. */
export const memberActions: RecordActionProvider<MemberRecord> = {
  load: async (id) => {
    const [member, pending] = await Promise.all([membersApi.get(id), policy.canInvite() ? membersApi.pendingInvitations() : ([] as string[])]);
    return { member, invited: pending.includes(id) };
  },
  actions: ({ member: m, invited }) => {
    const name = displayName(m);
    const invite = m.active && policy.canInvite() && ((!m.login && !!m.email) || invited);
    return [
      ...(policy.canEditProfile(m)
        ? [inWindow(bus, 'member', m.id, 'record.edit', { label: 'Profil bearbeiten', icon: 'edit', group: 'edit' })]
        : []),
      ...(invite
        ? [
            {
              command: 'member.invite' as const,
              label: invited ? 'Einladung erneut senden' : undefined,
              group: 'access',
              run: () => attempt(bus, () => membersApi.resendInvite(m.id), invited ? 'Einladung erneut gesendet.' : 'Einladung gesendet.'),
            },
          ]
        : []),
      ...(policy.canReactivate(m)
        ? [
            {
              command: 'member.reactivate' as const,
              group: 'access',
              run: () =>
                confirmed(
                  bus,
                  {
                    title: 'Mitglied reaktivieren',
                    message: `${name} kann sich wieder anmelden. Teams und Rollen bitte neu zuordnen.`,
                    confirmLabel: 'Reaktivieren',
                  },
                  () => membersApi.reactivate(m.id),
                  'Mitglied reaktiviert.',
                ),
            },
          ]
        : []),
      ...(policy.canDeactivate(m)
        ? [
            {
              command: 'member.deactivate' as const,
              label: 'Deaktivieren',
              danger: true,
              group: 'remove',
              run: () =>
                confirmed(
                  bus,
                  {
                    title: 'Mitglied deaktivieren',
                    message: `${name} kann sich danach nicht mehr anmelden und wird aus allen Teams entfernt.`,
                    confirmLabel: 'Deaktivieren',
                    danger: true,
                  },
                  () => membersApi.deactivate(m.id),
                  'Mitglied deaktiviert.',
                ),
            },
          ]
        : []),
      ...(policy.canErase(m)
        ? [
            {
              command: 'member.erase' as const,
              danger: true,
              group: 'remove',
              run: () =>
                confirmed(
                  bus,
                  {
                    title: 'Personendaten löschen (DSGVO)',
                    message: `Name, E-Mail, Telefon, Geburtsdatum und Login von ${name} werden endgültig gelöscht, ebenso Erziehungsberechtigte, Benachrichtigungen und Foto-Markierungen. Einträge wie Aufgaben oder Dateien bleiben, ohne Namen. Das lässt sich nicht rückgängig machen.`,
                    confirmLabel: 'Endgültig löschen',
                    danger: true,
                  },
                  () => membersApi.erase(m.id),
                  'Personendaten gelöscht.',
                ),
            },
          ]
        : []),
    ];
  },
};

/** HONORARY is fixed: resolutions grant it, it is never archived or deleted. */
export const membershipKindActions = catalogActions(
  bus,
  'membership-kind',
  'Mitgliedsart',
  membershipKinds,
  () => permissions.isManager,
  (k) => k.fixed,
);

/** An office of the board settings: edit; a club office nobody ever held may be deleted (else it is switched off). */
export const officeSettingActions: RecordActionProvider<OfficeSetting> = {
  load: async (id) => {
    await boardSettings.load();
    const office = boardSettings.get(id);
    if (!office) throw new Error(`office ${id} not found`);
    return office;
  },
  actions: (o) =>
    permissions.isManager
      ? [
          inWindow(bus, 'office-setting', o.office, 'record.edit', { icon: 'edit', group: 'edit' }),
          ...(SEEDED_OFFICES.includes(o.office)
            ? []
            : [
                {
                  command: 'record.delete' as const,
                  icon: 'delete' as const,
                  danger: true,
                  group: 'edit',
                  leaves: true,
                  run: () =>
                    confirmed(
                      bus,
                      {
                        title: 'Funktion löschen',
                        message: `„${o.label}“ wird gelöscht. Das geht nur, wenn sie nie vergeben war und keine Sitzungsart sie nennt; sonst stelle sie auf „Nicht besetzt“.`,
                        confirmLabel: 'Löschen',
                        danger: true,
                      },
                      async () => (boardSettings.value = await membersApi.deleteOffice(o.office)),
                      'Funktion gelöscht.',
                    ),
                },
              ]),
        ]
      : [],
};
