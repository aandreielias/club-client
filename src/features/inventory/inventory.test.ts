import { describe, expect, it } from 'vitest';
import { directory, MockDirectory } from '../../lib/mock/core';
import { LinksModel } from '../../lib/links/LinksModel.svelte';
import type { Member } from '../../lib/types';
import { calendar } from '../calendar/mock';
import { files } from '../files/mock';
import { tasks } from '../tasks/mock';
import { ItemForm } from './ItemForm.svelte';
import { InventoryListModel } from './InventoryListModel.svelte';
import { inventory } from './mock';

const member = (id: string): Member => directory.members.data.find((m) => m.id === id)!;
const stepUp = (id: string) => directory.stepUp(member(id), MockDirectory.PIN);
const code = (c: string) => expect.objectContaining({ code: c });

describe('mock inventory', () => {
  it('lets everyone read and only privileged members with a step-up change items', () => {
    expect(inventory.list().length).toBeGreaterThan(0);
    const body = { name: 'Netzantennen', category: 'Ausrüstung', quantity: 4, location: null, description: null };
    expect(() => inventory.create(member('spielerin'), body)).toThrow(code('access.denied'));
    expect(() => inventory.create(member('trainer'), body)).toThrow(code('auth.step-up-required'));
    stepUp('trainer');
    const item = inventory.create(member('trainer'), body);
    expect(inventory.update(member('trainer'), item.id, { quantity: 6, category: '' })).toMatchObject({ quantity: 6, category: null });
    expect(() => inventory.update(member('trainer'), item.id, { quantity: -1 })).toThrow(code('inventory.quantity-invalid'));
    inventory.delete(member('trainer'), item.id);
    expect(() => inventory.get(item.id)).toThrow(code('inventory.not-found'));
  });
});

describe('mock links', () => {
  it('keeps deleted items and files listed under their last name', () => {
    const match = calendar.appointments.data.find((a) => a.type === 'MATCH')!;
    const links = calendar.getLinks(member('spielerin'), match.id);
    expect(links.needs.find((n) => n.itemId === 'i-old-cart')).toMatchObject({ name: 'Ballwagen alt', deleted: true, stock: null });
    expect(links.needs.find((n) => n.itemId === 'i-balls')).toMatchObject({ deleted: false, stock: 24 });
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

describe('inventory client', () => {
  it('validates the item form like the server', () => {
    const form = ItemForm.blank();
    expect(form.errors.name).toBeDefined();
    form.name = 'Ball';
    form.quantity = 1.5;
    expect(form.errors.quantity).toBeDefined();
    form.quantity = 3;
    expect(form.valid).toBe(true);
    expect(form.toPatch()).toEqual({ name: 'Ball', category: '', quantity: 3, location: '', description: '' });
  });

  it('lists distinct categories and flags shortages', () => {
    const items = inventory.list();
    expect(InventoryListModel.categories(items)).toEqual([...new Set(items.map((i) => i.category!))].sort((a, b) => a.localeCompare(b, 'de')));
    expect(LinksModel.short({ itemId: 'x', name: 'x', quantity: 5, stock: 4, deleted: false })).toBe(true);
    expect(LinksModel.short({ itemId: 'x', name: 'x', quantity: 5, stock: null, deleted: true })).toBe(false);
    expect(LinksModel.quantityError(0)).not.toBeNull();
  });
});
