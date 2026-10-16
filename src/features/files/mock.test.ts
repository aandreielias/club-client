import { describe, expect, it } from 'vitest';
import { directory, MockDirectory } from '../../lib/mock/core';
import type { MockRequest } from '../../lib/mock/MockServer';
import type { Member } from '../../lib/types';
import { files, MockFiles } from './mock';

const member = (id: string): Member => directory.members.data.find((m) => m.id === id)!;
const stepUp = (id: string) => directory.stepUp(member(id), MockDirectory.PIN);
const visible = (id: string) => files.listFolders(member(id)).map((f) => f.id).sort();

function uploadRequest(as: string, folderId: string, content: BlobPart, name: string, tags: string[] = []): MockRequest {
  const form = new FormData();
  form.append('file', new File([content], name));
  const query = new URLSearchParams(tags.map((t) => ['tag', t]));
  return { params: { folderId }, query, body: form, email: `${as}@example.at` };
}

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const PDF = '%PDF-1.7\n';

describe('mock files', () => {
  it('shows folders by scope', () => {
    expect(visible('spieler')).toEqual(['f-docs', 'f-minutes', 'f-photos', 'f-u16']);
    expect(visible('vorstand')).toEqual(['f-board', 'f-damen', 'f-docs', 'f-minutes', 'f-photos', 'f-u16']);
    const damen = files.listFolders(member('trainer')).find((f) => f.id === 'f-damen')!;
    expect(damen).toMatchObject({ canManage: true, canUpload: true });
    expect(files.listFolders(member('spielerin')).find((f) => f.id === 'f-docs')).toMatchObject({ canManage: false, canUpload: false });
  });

  it('hides photos tagged with members without consent from non-managers', () => {
    expect(files.listFiles(member('spieler'), 'f-u16')).toEqual([]);
    expect(files.listFiles(member('trainer'), 'f-u16').map((f) => f.id)).toEqual(['file-7']);
    expect(() => files.link(member('spieler'), 'file-7', false)).toThrow(expect.objectContaining({ code: 'file.not-found' }));
  });

  it('detects types by content, rejects viruses and wrong kinds', async () => {
    const stored = await files.upload(uploadRequest('spielerin', 'f-damen', PDF, 'Plan.pdf'));
    expect(stored).toMatchObject({ contentType: 'application/pdf', uploadedBy: 'spielerin', hasThumbnail: false });
    await expect(files.upload(uploadRequest('spielerin', 'f-damen', 'MZ…', 'tool.pdf'))).rejects.toMatchObject({ code: 'file.type-not-allowed' });
    await expect(files.upload(uploadRequest('spielerin', 'f-photos', PDF, 'x.pdf'))).rejects.toMatchObject({ code: 'file.type-not-allowed' });
    await expect(files.upload(uploadRequest('spielerin', 'f-damen', `${PDF}X5O!P%@AP EICAR-STANDARD-ANTIVIRUS-TEST-FILE!`, 'eicar.pdf')))
      .rejects.toMatchObject({ code: 'file.infected' });
    await expect(files.upload(uploadRequest('spielerin', 'f-docs', PDF, 'x.pdf'))).rejects.toMatchObject({ code: 'access.denied' });
  });

  it('allows tags only with photo consent', async () => {
    await expect(files.upload(uploadRequest('spielerin', 'f-photos', JPEG, 'a.jpg', ['spieler']))).rejects.toMatchObject({ code: 'file.tag-without-consent' });
    const photo = await files.upload(uploadRequest('spielerin', 'f-photos', JPEG, 'a.jpg', ['trainer']));
    expect(photo).toMatchObject({ contentType: 'image/jpeg', hasThumbnail: true, taggedMemberIds: ['trainer'] });
  });

  it('lets the uploader or a manager delete, and keeps non-empty folders', async () => {
    const own = await files.upload(uploadRequest('spielerin', 'f-damen', PDF, 'Mein.pdf'));
    expect(() => files.deleteFile(member('neu'), own.id)).toThrow(expect.objectContaining({ code: 'access.denied' }));
    files.deleteFile(member('spielerin'), own.id);
    expect(() => files.deleteFile(member('trainer'), 'file-4')).toThrow(expect.objectContaining({ code: 'auth.step-up-required' }));
    stepUp('admin');
    expect(() => files.deleteFolder(member('admin'), 'f-docs')).toThrow(expect.objectContaining({ code: 'folder.not-empty' }));
  });

  it('limits folder depth and inherits scope', () => {
    stepUp('admin');
    let parent = 'f-minutes';
    for (let depth = 3; depth <= 5; depth++) parent = files.createFolder(member('admin'), { parentId: parent, name: `L${depth}`, kind: 'DOCUMENTS' }).id;
    expect(files.listFolders(member('admin')).find((f) => f.id === parent)).toMatchObject({ scope: 'CLUB', teamIds: [] });
    expect(() => files.createFolder(member('admin'), { parentId: parent, name: 'L6', kind: 'DOCUMENTS' })).toThrow(expect.objectContaining({ code: 'folder.too-deep' }));
  });
});

describe('mock sample documents', () => {
  it('builds a PDF whose xref offsets point at its objects', async () => {
    const text = await MockFiles.pdf('Satzung (2026).pdf').text();
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    const offsets = [...text.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(offsets).toHaveLength(5);
    offsets.forEach((offset, i) => expect(text.slice(offset).startsWith(`${i + 1} 0 obj`)).toBe(true));
    expect(Number(/startxref\n(\d+)/.exec(text)![1])).toBe(text.indexOf('xref\n'));
    expect(text).toContain('(Satzung \\(2026\\).pdf)');
  });
});
