import { describe, expect, it } from 'vitest';
import { directory, MockDirectory } from '../../lib/mock/core';
import type { Member } from '../../lib/types';
import { notifications } from '../notifications/mock';
import { tasks } from '../tasks/mock';
import { changeRequests } from './mock';

const member = (id: string): Member => directory.members.data.find((m) => m.id === id)!;
const taskFor = (requestId: string) => {
  const taskId = Object.entries(tasks.sources.data).find(([, s]) => s.id === requestId)![0];
  return tasks.get(member('admin'), taskId);
};

describe('mock change requests', () => {
  it('turns a request into a task for admin and board and finishes it on approval', () => {
    const request = changeRequests.request(member('spielerin'), { field: 'EMAIL', value: ' Lena@Neu.AT ', note: 'Neue Adresse' });
    expect(request).toMatchObject({ newValue: 'lena@neu.at', currentValue: 'spielerin@example.at', status: 'OPEN' });
    expect(() => changeRequests.request(member('spielerin'), { field: 'EMAIL', value: 'x@neu.at' }))
      .toThrow(expect.objectContaining({ code: 'change-request.open-exists' }));

    const task = taskFor(request.id);
    expect(task).toMatchObject({ title: 'Kontoänderung: Lena Spielerin – E-Mail', source: { kind: 'CHANGE_REQUEST', id: request.id }, status: 'OPEN' });
    expect(task.assignees.sort()).toEqual(['admin', 'beisitz', 'beisitz2', 'kassier', 'schrift', 'vorstand']); // admin and the board
    expect(() => tasks.get(member('spielerin'), task.id)).toThrow(expect.objectContaining({ status: 404 }));

    expect(() => changeRequests.decide(member('trainer'), request.id, true)).toThrow();
    directory.stepUp(member('vorstand'), MockDirectory.PIN);
    changeRequests.decide(member('vorstand'), request.id, true);
    expect(member('spielerin').email).toBe('lena@neu.at');
    expect(taskFor(request.id).status).toBe('DONE');
    expect(notifications.list('spielerin', true).items[0]).toMatchObject({ kind: 'CHANGE_DECIDED', title: 'Änderung übernommen: E-Mail' });
    expect(changeRequests.own(member('spielerin')).items).toEqual([]);
  });

  it('validates the value up front and leaves the member unchanged on rejection', () => {
    expect(() => changeRequests.request(member('neu'), { field: 'BIRTH_DATE', value: '3000-01-01' }))
      .toThrow(expect.objectContaining({ code: 'member.birth-date-in-future' }));
    expect(() => changeRequests.request(member('neu'), { field: 'EMAIL', value: 'admin@example.at' }))
      .toThrow(expect.objectContaining({ code: 'member.email-taken' }));
    const request = changeRequests.request(member('neu'), { field: 'LAST_NAME', value: 'Neumann' });
    directory.stepUp(member('admin'), MockDirectory.PIN);
    changeRequests.decide(member('admin'), request.id, false);
    expect(member('neu').lastName).toBe('Neu');
    expect(notifications.list('neu', true).items[0].title).toBe('Änderung abgelehnt: Nachname');
  });
});
