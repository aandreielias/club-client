import { describe, expect, it } from 'vitest';
import { FileEditForm, FolderEditForm } from './FolderEditForm.svelte';
import type { Folder, StoredFile } from './model';

const folder = (overrides: Partial<Folder> = {}): Folder => ({
  id: 'f1', parentId: null, name: 'Fotos', kind: 'PHOTOS', scope: 'TEAM', teamId: 't1', membersCanUpload: false,
  color: 'BLUE', coverFileId: 'p1', canUpload: true, canManage: true, ...overrides,
});

describe('FolderEditForm', () => {
  it('sends only what changed, clearing colour and cover explicitly', () => {
    const form = new FolderEditForm(folder());
    expect(form.toPatch()).toEqual({});
    form.name = ' Fotos 2026 ';
    form.color = null;
    form.coverFileId = null;
    form.scope = 'CLUB';
    expect(form.toPatch()).toEqual({ name: 'Fotos 2026', scope: 'CLUB', teamId: null, clearColor: true, clearCover: true });
  });

  it('never changes the visibility of subfolders and requires a team for team folders', () => {
    const sub = new FolderEditForm(folder({ parentId: 'root' }));
    sub.scope = 'BOARD';
    expect(sub.toPatch()).toEqual({});
    const root = new FolderEditForm(folder({ scope: 'CLUB', teamId: null }));
    root.scope = 'TEAM';
    root.submitted = true;
    expect(root.error('team')).toBe('Team auswählen.');
  });
});

describe('FileEditForm', () => {
  it('keeps the extension and reports a move', () => {
    const form = new FileEditForm({ id: 'x', folderId: 'f1', name: 'Plan.final.pdf' } as StoredFile);
    expect(form.base).toBe('Plan.final');
    form.base = 'Spielplan';
    form.folderId = 'f2';
    expect(form.toPatch()).toEqual({ name: 'Spielplan.pdf', folderId: 'f2' });
  });
});
