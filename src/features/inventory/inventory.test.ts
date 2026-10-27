import { describe, expect, it } from 'vitest';
import { directory, MockDirectory } from '../../lib/mock/core';
import type { LinksApi } from '../../lib/links/LinksApi';
import { LinksModel } from '../../lib/links/LinksModel.svelte';
import type { Member } from '../../lib/types';
import { calendar } from '../calendar/mock';
import { files } from '../files/mock';
import { tasks } from '../tasks/mock';
import { ItemForm } from './ItemForm.svelte';
import { InventoryListModel } from './InventoryListModel.svelte';
import { inventory } from './mock';
import { mockServer } from '../../lib/mock/MockServer';

const member = (id: string): Member => directory.members.data.find((m) => m.id === id)!;
const stepUp = (id: string) => directory.confirm(member(id));
const code = (c: string) => expect.objectContaining({ code: c });

describe('mock inventory', () => {
  it('lets only privileged members with a step-up change items', () => {
    expect(inventory.list().length).toBeGreaterThan(0);
    const body = { name: 'Netzantennen', category: 'Ausrüstung', quantity: 4, locationId: 'l-nord', description: null };
    expect(() => inventory.create(member('spielerin'), body)).toThrow(code('access.denied'));
    expect(() => inventory.create(member('trainer'), body)).toThrow(code('auth.step-up-required'));
    stepUp('trainer');
    const item = inventory.create(member('trainer'), body);
    expect(item.stock).toEqual([{ kind: 'LOCATION', id: 'l-nord', name: 'Turnhalle Nord', quantity: 4 }]);
    expect(inventory.update(member('trainer'), item.id, { category: '' })).toMatchObject({ quantity: 4, category: null });
    const split = inventory.setStock(member('trainer'), item.id, [
      { locationId: 'l-nord', holderId: null, quantity: 3 },
      { locationId: null, holderId: 'spieler', quantity: 2 },
      { locationId: null, holderId: 'spieler', quantity: 1 },
    ]);
    expect(split).toMatchObject({ quantity: 6, stock: [{ kind: 'LOCATION', quantity: 3 }, { kind: 'PERSON', id: 'spieler', name: 'David Spieler', quantity: 3 }] });
    expect(inventory.mine(member('spieler')).items).toContainEqual({ itemId: item.id, name: 'Netzantennen', quantity: 3 });
    expect(() => inventory.setStock(member('trainer'), item.id, [{ locationId: 'l-nord', holderId: 'spieler', quantity: 1 }])).toThrow(code('inventory.stock-invalid'));
    expect(() => inventory.setStock(member('trainer'), item.id, [{ locationId: null, holderId: null, quantity: 0 }])).toThrow(code('inventory.quantity-invalid'));
    inventory.delete(member('trainer'), item.id);
    expect(() => inventory.get(item.id)).toThrow(code('inventory.not-found'));
  });

  it('is visible to admin, board and coaches only', () => {
    const read = (id: string) => mockServer.handle('GET', '/api/v1/inventory', null, member(id).email);
    expect(() => read('spielerin')).toThrow(code('access.denied'));
    expect(read('trainer')).toMatchObject({ items: expect.any(Array) });
  });
});

describe('mock links', () => {
  it('keeps deleted items and files listed under their last name', () => {
    const match = calendar.appointments.data.find((a) => a.type === 'MATCH')!;
    const links = calendar.getLinks(member('spielerin'), match.id);
    expect(links.needs.find((n) => n.itemId === 'i-old-cart')).toMatchObject({ name: 'Ballwagen alt', deleted: true, stock: null });
    // Members see what is needed, but the stock only admin, board and coaches.
    expect(links.needs.find((n) => n.itemId === 'i-balls')).toMatchObject({ deleted: false, stock: null });
    expect(calendar.getLinks(member('trainer'), match.id).needs.find((n) => n.itemId === 'i-balls')).toMatchObject({ stock: 24 });
    expect(links.files.map((f) => [f.name, f.deleted])).toEqual([['Spielplan Herbst.xlsx', false], ['Aufstellung Vorsaison.pdf', true]]);
    // The deleted team file stays hidden from members outside the team.
    expect(() => calendar.getLinks(member('spieler'), match.id)).toThrow(code('appointment.not-found'));
  });

  it('checks rights and refuses adding unknown or deleted entries anew', () => {
    stepUp('trainer');
    const body = { needs: [{ itemId: 'i-pump', quantity: 1 }], fileIds: ['file-4'] };
    expect(() => tasks.setLinks(member('spieler'), 't-3', body)).toThrow(code('access.denied'));
    expect(() => tasks.setLinks(member('trainer'), 't-3', { ...body, needs: [{ itemId: 'i-old-cart', quantity: 1 }] }))
      .toThrow(code('links.item-unknown'));
    expect(() => tasks.setLinks(member('trainer'), 't-3', { ...body, fileIds: ['file-8'] })).toThrow(code('links.file-unknown'));
    expect(() => tasks.setLinks(member('trainer'), 't-3', { needs: [{ itemId: 'i-pump', quantity: 0 }] })).toThrow(code('links.quantity-invalid'));
    const saved = tasks.setLinks(member('trainer'), 't-3', body);
    expect(saved.needs).toMatchObject([{ itemId: 'i-pump', quantity: 1, deleted: false }]);

    // Deleting the file and the item keeps both, marked; saving again keeps them.
    stepUp('admin');
    files.deleteFile(member('admin'), 'file-4');
    inventory.delete(member('admin'), 'i-pump');
    const after = tasks.getLinks(member('trainer'), 't-3');
    expect(after.needs[0]).toMatchObject({ name: 'Ballpumpe mit Manometer', deleted: true });
    expect(after.files[0]).toMatchObject({ name: 'Spielplan Herbst.xlsx', deleted: true });
    expect(tasks.setLinks(member('trainer'), 't-3', body).needs[0].deleted).toBe(true);
  });

  it('keeps attachments the editor cannot see', () => {
    stepUp('admin');
    stepUp('trainer');
    tasks.setLinks(member('admin'), 't-6', { needs: [], fileIds: ['file-8'] });
    expect(tasks.setLinks(member('trainer'), 't-6', { needs: [], fileIds: [] }).files).toEqual([]);
    expect(tasks.getLinks(member('admin'), 't-6').files.map((f) => f.id)).toEqual(['file-8']);
  });
});

describe('mock gaps', () => {
  it('lists where an item is needed, only what the member sees', () => {
    const forBoard = [...calendar.itemUses(member('vorstand'), 'i-balls'), ...tasks.itemUses(member('vorstand'), 'i-balls')];
    expect(forBoard.map((u) => u.kind)).toEqual(['APPOINTMENT']);
    expect(calendar.itemUses(member('spieler'), 'i-balls')).toEqual([]); // U16 player cannot see the Damen match
    stepUp('trainer');
    tasks.setLinks(member('trainer'), 't-3', { needs: [{ itemId: 'i-training-balls', quantity: 30 }], fileIds: [] });
    expect(tasks.itemUses(member('spieler'), 'i-training-balls')).toMatchObject([{ kind: 'TASK', id: 't-3', quantity: 30 }]);
  });

  it('searches visible files by name', () => {
    expect(files.search(member('spielerin'), 'budget', 20)).toEqual([]);
    expect(files.search(member('vorstand'), 'BUDGET', 20).map((f) => [f.name, f.folderName])).toEqual([['Budget 2027.xlsx', 'Vorstand intern']]);
    expect(files.search(member('vorstand'), '', 2)).toHaveLength(2);
  });

  it('filters tasks by due range and clears due dates', () => {
    const t1 = tasks.get(member('trainer'), 't-1');
    const from = new Date(Date.parse(t1.dueAt!) - 1000).toISOString();
    const to = new Date(Date.parse(t1.dueAt!) + 1000).toISOString();
    expect(tasks.list(member('trainer'), false, null, true, from, to).map((t) => t.id)).toEqual(['t-1']);
    expect(() => tasks.list(member('trainer'), false, null, true, to, from)).toThrow(code('task.range-invalid'));
    stepUp('trainer');
    expect(() => tasks.update(member('trainer'), 't-1', { clearDue: true, dueAt: to })).toThrow(code('task.due-conflict'));
    expect(tasks.update(member('trainer'), 't-1', { clearDue: true }).dueAt).toBeNull();
  });
});

describe('inventory client', () => {
  it('validates the item form like the server', () => {
    const form = ItemForm.blank();
    expect(form.errors.name).toBeDefined();
    form.name = 'Ball';
    form.quantity = 1.5;
    expect(form.errors.quantity).toBeDefined();
    form.quantity = 3;
    expect(form.valid).toBe(true);
    expect(form.toPatch()).toEqual({ name: 'Ball', category: '', description: '' });
  });

  it('lists distinct categories and flags shortages', () => {
    const items = inventory.list();
    expect(InventoryListModel.categories(items)).toEqual([...new Set(items.map((i) => i.category!))].sort((a, b) => a.localeCompare(b, 'de')));
    expect(LinksModel.short({ itemId: 'x', name: 'x', quantity: 5, stock: 4, deleted: false, places: [] })).toBe(true);
    expect(LinksModel.short({ itemId: 'x', name: 'x', quantity: 5, stock: null, deleted: true, places: [] })).toBe(false);
    expect(LinksModel.quantityError(0)).not.toBeNull();
  });
});

describe('StockForm', () => {
  it('turns lines into stock entries, merging the same place', async () => {
    const { StockForm } = await import('./StockForm.svelte');
    const form = new StockForm([
      { kind: 'LOCATION', id: 'l1', name: 'Halle', quantity: 10 },
      { kind: 'PERSON', id: 'm1', name: 'Clara', quantity: 4 },
    ]);
    form.add('location:l1', 2);
    form.add('none', 3);
    expect(form.total).toBe(19);
    expect(form.toInput()).toEqual([
      { locationId: 'l1', holderId: null, quantity: 12 },
      { locationId: null, holderId: 'm1', quantity: 4 },
      { locationId: null, holderId: null, quantity: 3 },
    ]);
    form.lines[0].quantity = 0;
    expect(form.error).toBe('Jede Zeile braucht eine Anzahl ab 1.');
  });
});

describe('LinksModel drops', () => {
  it('attaches a dropped file only when the editor finds it by name', async () => {
    const file = { id: 'f1', folderId: 'd1', name: 'Plan.pdf', contentType: 'application/pdf', sizeBytes: 1, deleted: false };
    const api = { files: async (q: string) => (q === 'Plan.pdf' ? [{ id: 'f1', label: 'Plan.pdf', file }] : []) } as unknown as LinksApi;
    const model = new LinksModel(api, '/api/v1/tasks/t1');
    expect(await model.dropFile('f1', 'Plan.pdf')).toBe(true);
    expect(await model.dropFile('f1', 'Plan.pdf')).toBe(true);
    expect(model.files).toHaveLength(1);
    expect(await model.dropFile('f2', 'Geheim.pdf')).toBe(false);
  });
});
