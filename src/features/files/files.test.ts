import { describe, expect, it, vi } from 'vitest';
import { settings } from '../../settings';
import { ErrorMessages } from '../../lib/errors/ErrorMessages';
import { ProblemError } from '../../lib/http/ProblemError';
import { FileLinks } from './FileLinks';
import type { FilesApi } from './FilesApi';
import { FileTypes } from './FileTypes';
import { FolderForm } from './FolderForm.svelte';
import { FolderTree } from './FolderTree.svelte';
import type { Folder, StoredFile } from './model';
import { UploadQueue } from './UploadQueue.svelte';

const types = new FileTypes(settings.files.imageExtensions, settings.files.documentExtensions);

const folder = (id: string, parentId: string | null, name = id): Folder => ({
  id, parentId, name, kind: 'DOCUMENTS', scope: 'CLUB', teamId: null, membersCanUpload: true, canUpload: true, canManage: false,
});

describe('FileTypes', () => {
  it('accepts by folder kind and labels content types', () => {
    expect(types.allows('PHOTOS', 'IMG_1.HEIC')).toBe(true);
    expect(types.allows('PHOTOS', 'plan.pdf')).toBe(false);
    expect(types.allows('DOCUMENTS', 'plan.pdf')).toBe(true);
    expect(types.allows('DOCUMENTS', 'macro.docm')).toBe(false);
    expect(types.label('application/pdf')).toBe('PDF');
    expect(types.describe('PHOTOS')).toBe('JPG, PNG, HEIC');
  });
});

describe('FolderTree', () => {
  it('builds roots, children and paths from the flat list', async () => {
    const api = { folders: async () => [folder('a', null, 'B-Root'), folder('b', 'a'), folder('c', 'b'), folder('orphan', 'hidden'), folder('z', null, 'A-Root')] };
    const tree = new FolderTree(api as unknown as FilesApi, 3);
    await tree.load();
    expect(tree.children(null).map((f) => f.id)).toEqual(['z', 'a', 'orphan']);
    expect(tree.path('c').map((f) => f.id)).toEqual(['a', 'b', 'c']);
    expect(tree.canHaveSubfolders('b')).toBe(true);
    expect(tree.canHaveSubfolders('c')).toBe(false);
  });
});

describe('FolderForm', () => {
  it('needs a name, and a team for team folders', () => {
    const form = new FolderForm(null, { scope: 'TEAM', teamId: null });
    expect(Object.keys(form.errors).sort()).toEqual(['name', 'team']);
    form.name = ' Fotos ';
    form.teamId = 't1';
    expect(form.toNew()).toMatchObject({ parentId: null, name: 'Fotos', scope: 'TEAM', teamId: 't1' });
  });

  it('lets subfolders inherit scope and team', () => {
    const form = new FolderForm({ ...folder('p', null), kind: 'PHOTOS' }, { scope: 'TEAM', teamId: 't1' });
    form.name = 'Turnier';
    expect(form.valid).toBe(true);
    expect(form.toNew()).toMatchObject({ parentId: 'p', kind: 'PHOTOS', scope: null, teamId: null });
  });
});

describe('FileLinks', () => {
  it('reuses a link while valid and refetches after forget or near expiry', async () => {
    let n = 0;
    const link = vi.fn(async () => ({ url: `u${++n}`, expiresAt: new Date(Date.now() + 60_000).toISOString() }));
    const links = new FileLinks({ link } as unknown as FilesApi, 30_000);
    expect(await Promise.all([links.url('f'), links.url('f')])).toEqual(['u1', 'u1']);
    expect(await links.url('f', true)).toBe('u2');
    expect(link).toHaveBeenCalledTimes(2);

    links.forget('f');
    expect(await links.url('f')).toBe('u3');

    const expiring = vi.fn(async () => ({ url: 'x', expiresAt: new Date(Date.now() + 10_000).toISOString() }));
    const short = new FileLinks({ link: expiring } as unknown as FilesApi, 30_000);
    await short.url('f');
    await short.url('f');
    expect(expiring).toHaveBeenCalledTimes(2);
  });
});

describe('UploadQueue', () => {
  const stored = (name: string): StoredFile => ({
    id: name, folderId: 'f', name, contentType: 'application/pdf', sizeBytes: 1, width: null, height: null, hasThumbnail: false,
    uploadedBy: 'm', taggedMemberIds: [], createdAt: '',
  });

  it('checks files before sending and uploads the rest one by one', async () => {
    const order: string[] = [];
    const upload = vi.fn(async (_folder: string, file: File, _tags: readonly string[], progress?: (p: { loaded: number; total: number }) => void) => {
      order.push(file.name);
      progress?.({ loaded: 1, total: 2 });
      if (file.name === 'bad.pdf') throw new ProblemError(400, 'file.infected');
      return stored(file.name);
    });
    const uploaded: string[] = [];
    const errors = new ErrorMessages({}, '?').register({ 'file.infected': 'Virus' });
    const queue = new UploadQueue({ upload } as unknown as FilesApi, types, errors, 10, () => folder('f', null), (f) => uploaded.push(f.name));
    queue.add([
      new File(['x'], 'a.pdf'),
      new File(['x'.repeat(11)], 'big.pdf'),
      new File(['x'], 'script.exe'),
      new File(['x'], 'bad.pdf'),
      new File(['x'], 'b.pdf'),
    ]);
    await vi.waitFor(() => expect(queue.busy).toBe(false));
    expect(order).toEqual(['a.pdf', 'bad.pdf', 'b.pdf']);
    expect(uploaded).toEqual(['a.pdf', 'b.pdf']);
    expect(queue.items.map((i) => [i.file.name, i.state])).toEqual([
      ['a.pdf', 'done'], ['big.pdf', 'failed'], ['script.exe', 'failed'], ['bad.pdf', 'failed'], ['b.pdf', 'done'],
    ]);
    expect(queue.items[3].error).toBe('Virus');
    queue.clearFinished();
    expect(queue.items).toEqual([]);
  });
});
