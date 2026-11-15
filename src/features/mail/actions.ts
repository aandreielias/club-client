import { attempt, confirmed, inWindow, type RecordAction, type RecordActionProvider } from '../../lib/actions/RecordActions';
import { bus, pendingDeletes, permissions } from '../../lib/container';
import { WINDOW_OPEN } from '../../lib/window/WindowService.svelte';
import type { Mail, MailboxAdmin } from './model';
import { mailApi, mailboxes, mailCenter as center } from './services';

/** A mail in one of the member's mailboxes; the window id is `<mailboxId>:<mailId>`. */
export interface MailRecord {
  mailboxId: string;
  mail: Pick<Mail, 'id' | 'folder' | 'from'> & { recipients: number };
}

export const mailRecord = (mailboxId: string, mail: Mail): MailRecord => ({
  mailboxId,
  mail: { id: mail.id, folder: mail.folder, from: mail.from, recipients: mail.to.length + mail.cc.length },
});

/** What can be done with a mail: its window, keys and the command palette. */
export const mailActions: RecordActionProvider<MailRecord> = {
  // Reading a mail marks it read, so a menu never loads one: menus elsewhere keep only their open entries.
  load: () => Promise.reject(new Error('mails load only in their window')),
  actions: ({ mailboxId, mail }) => {
    const compose = (mode: string) => () => bus.publish(WINDOW_OPEN, { kind: 'mail-new', id: `${mode}:${mailboxId}:${mail.id}` });
    const reload = () => center.mailboxes.load();
    const actions: RecordAction[] = [];
    if (mail.folder !== 'SENT') {
      actions.push({ command: 'mail.reply', icon: 'reply', group: 'write', run: compose('reply') });
      if (mail.recipients > 1) actions.push({ command: 'mail.replyAll', group: 'write', run: compose('reply-all') });
    }
    actions.push({ command: 'mail.forward', icon: 'forward', group: 'write', run: compose('forward') });
    if (mail.folder === 'INBOX')
      actions.push({
        command: 'mail.unread',
        icon: 'mail',
        group: 'state',
        leaves: true,
        run: () => attempt(bus, () => mailApi.update(mailboxId, mail.id, { read: false }).then(reload)),
      });
    if (mail.folder === 'TRASH') {
      // Own mails go back to Gesendet, others to the Posteingang.
      const own = center.mailboxes.value?.find((b) => b.id === mailboxId)?.address === mail.from;
      actions.push({
        command: 'record.restore',
        icon: 'back',
        group: 'state',
        leaves: true,
        run: () =>
          attempt(
            bus,
            () => mailApi.update(mailboxId, mail.id, { folder: own ? 'SENT' : 'INBOX' }).then(reload),
            own ? 'E-Mail nach „Gesendet“ zurückgelegt.' : 'E-Mail in den Posteingang zurückgelegt.',
          ),
      });
    }
    const inTrash = mail.folder === 'TRASH';
    actions.push({
      command: 'record.delete',
      label: inTrash ? 'Endgültig löschen' : 'Löschen',
      icon: 'delete',
      danger: true,
      group: 'remove',
      leaves: true,
      run: () =>
        pendingDeletes.schedule({
          ids: [mail.id],
          text: inTrash ? 'E-Mail endgültig gelöscht.' : 'E-Mail in den Papierkorb verschoben.',
          commit: async () => {
            await mailApi.delete(mailboxId, mail.id);
            await reload();
          },
        }),
    });
    return actions;
  },
};

/** A club mailbox for admin and board: context menus, its window and the command palette. */
export const mailboxActions: RecordActionProvider<MailboxAdmin> = {
  load: async (id) => {
    await mailboxes.load();
    const mailbox = mailboxes.get(id);
    if (!mailbox) throw new Error(`mailbox ${id} not found`);
    return mailbox;
  },
  actions: (m) =>
    permissions.isManager
      ? [
          inWindow(bus, 'mailbox', m.id, 'record.edit', { icon: 'edit', group: 'edit' }),
          {
            command: 'record.delete',
            icon: 'delete',
            danger: true,
            group: 'edit',
            leaves: true,
            run: () =>
              confirmed(
                bus,
                {
                  title: 'Postfach entfernen',
                  message: `${m.address}: niemand liest die Adresse dann mehr in der App. Die E-Mails selbst bleiben beim Mail-Anbieter.`,
                  confirmLabel: 'Löschen',
                  danger: true,
                },
                async () => {
                  await mailboxes.remove(m.id);
                  await center.mailboxes.load();
                },
                'Postfach entfernt.',
              ),
          },
        ]
      : [],
};
