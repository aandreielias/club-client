import { describe, expect, it } from 'vitest';
import { directory } from '../../lib/mock/core';
import type { MockRequest } from '../../lib/mock/MockServer';
import type { Member } from '../../lib/types';
import { isSafeSvg } from '../../lib/mock/MockBrand';
import { files, MockFiles } from './mock';

const member = (id: string): Member => directory.members.data.find((m) => m.id === id)!;
const visible = (id: string) =>
  files
    .listFolders(member(id))
    .map((f) => f.id)
    .sort();

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
    expect(visible('spieler')).toEqual(['f-docs', 'f-logos', 'f-minutes', 'f-photos', 'f-u16']);
    expect(visible('vorstand')).toEqual(['f-board', 'f-damen', 'f-docs', 'f-logos', 'f-minutes', 'f-photos', 'f-settings', 'f-templates', 'f-u16']);
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
    await expect(
      files.upload(uploadRequest('spielerin', 'f-damen', `${PDF}X5O!P%@AP EICAR-STANDARD-ANTIVIRUS-TEST-FILE!`, 'eicar.pdf')),
    ).rejects.toMatchObject({ code: 'file.infected' });
    await expect(files.upload(uploadRequest('spielerin', 'f-docs', PDF, 'x.pdf'))).rejects.toMatchObject({ code: 'access.denied' });
  });

  it('allows tags only with photo consent', async () => {
    await expect(files.upload(uploadRequest('spielerin', 'f-photos', JPEG, 'a.jpg', ['spieler']))).rejects.toMatchObject({
      code: 'file.tag-without-consent',
    });
    const photo = await files.upload(uploadRequest('spielerin', 'f-photos', JPEG, 'a.jpg', ['trainer']));
    expect(photo).toMatchObject({ contentType: 'image/jpeg', hasThumbnail: true, taggedMemberIds: ['trainer'] });
  });

  it('lets the uploader or a manager delete, and keeps non-empty folders', async () => {
    const own = await files.upload(uploadRequest('spielerin', 'f-damen', PDF, 'Mein.pdf'));
    expect(() => files.deleteFile(member('neu'), own.id)).toThrow(expect.objectContaining({ code: 'access.denied' }));
    files.deleteFile(member('spielerin'), own.id);
    expect(() => files.deleteFolder(member('admin'), 'f-docs')).toThrow(expect.objectContaining({ code: 'folder.not-empty' }));
  });

  it('limits folder depth and inherits scope', () => {
    let parent = 'f-minutes';
    for (let depth = 3; depth <= 5; depth++)
      parent = files.createFolder(member('admin'), { parentId: parent, name: `L${depth}`, kind: 'DOCUMENTS' }).id;
    expect(files.listFolders(member('admin')).find((f) => f.id === parent)).toMatchObject({ scope: 'CLUB', teamIds: [] });
    expect(() => files.createFolder(member('admin'), { parentId: parent, name: 'L6', kind: 'DOCUMENTS' })).toThrow(
      expect.objectContaining({ code: 'folder.too-deep' }),
    );
  });
});

describe('mock folder move', () => {
  it('follows FolderHandlers.movableInto: not into itself, depth limit, the visibility of the new parent, back to the top', () => {
    const admin = member('admin');
    const box = files.createFolder(admin, { name: 'Umzug', kind: 'DOCUMENTS', scope: 'CLUB', teamIds: [] });
    const inner = files.createFolder(admin, { parentId: box.id, name: 'Innen', kind: 'DOCUMENTS' });
    expect(() => files.updateFolder(admin, box.id, { parentId: inner.id })).toThrow(expect.objectContaining({ code: 'folder.move-into-self' }));

    const moved = files.updateFolder(admin, box.id, { parentId: 'f-damen' });
    expect(moved).toMatchObject({ parentId: 'f-damen', scope: 'TEAM', teamIds: ['t-damen'] });
    expect(files.folders.data.find((f) => f.id === inner.id)).toMatchObject({ scope: 'TEAM', teamIds: ['t-damen'] });

    expect(files.updateFolder(admin, box.id, { moveToTop: true })).toMatchObject({ parentId: null });

    let deepest = 'f-docs';
    for (let level = 2; level <= 4; level++) deepest = files.createFolder(admin, { parentId: deepest, name: `T${level}`, kind: 'DOCUMENTS' }).id;
    expect(() => files.updateFolder(admin, box.id, { parentId: deepest })).toThrow(expect.objectContaining({ code: 'folder.too-deep' }));
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

describe('mock setting files (server: SettingFileHandlers)', () => {
  const svg = (fill: string) => `<svg xmlns="http://www.w3.org/2000/svg"><rect fill="${fill}" width="1" height="1"/></svg>`;
  const slotRequest = (slot: string, content: BlobPart, name: string): MockRequest => {
    const form = new FormData();
    form.append('file', new File([content], name));
    return { params: { slot }, query: new URLSearchParams(), body: form, email: 'vorstand@example.at' };
  };
  const logo = () => files.listSettingFiles(member('vorstand')).items.find((s) => s.slot === 'LOGO')!;

  it('copies a picked file into the read-only system folder and follows its new versions', async () => {
    const picked = files.pickSettingFile(member('vorstand'), 'LOGO', 'file-logo-black');
    expect(picked).toMatchObject({ sourceId: 'file-logo-black', file: { folderId: 'f-settings', name: 'sdg-logo-mono-black.svg' } });
    expect(() => files.pickSettingFile(member('vorstand'), 'LOGO', 'file-tpl-letter')).toThrow(
      expect.objectContaining({ code: 'setting-file.wrong-type' }),
    );
    expect(() => files.pickSettingFile(member('spieler'), 'LOGO', 'file-logo-black')).toThrow();

    const content = svg('#123456');
    const form = new FormData();
    form.append('file', new File([content], 'neu.svg'));
    form.append('label', '2.0');
    form.append('date', '2026-11-01');
    await files.uploadVersion({ params: { id: 'file-logo-black' }, query: new URLSearchParams(), body: form, email: 'vorstand@example.at' });
    expect(logo().file.sizeBytes).toBe(content.length);

    const settings = files.listFolders(member('vorstand')).find((f) => f.id === 'f-settings')!;
    expect(settings).toMatchObject({ system: true, canManage: false, canUpload: false });
    expect(visible('spieler')).not.toContain('f-settings');
    expect(() => files.deleteFile(member('admin'), logo().file.id)).toThrow();
  });

  it('unlinks on an own upload, refuses unsafe SVGs and empties a slot', async () => {
    files.pickSettingFile(member('vorstand'), 'LOGO', 'file-logo-wine');
    const own = await files.uploadSettingFile(slotRequest('LOGO', svg('#000000'), 'eigen.svg'));
    expect(own).toMatchObject({ sourceId: null, file: { name: 'eigen.svg' } });
    expect(files.listFiles(member('vorstand'), 'f-logos').map((f) => f.id)).toContain('file-logo-wine');
    await expect(files.uploadSettingFile(slotRequest('LOGO', '<svg onload="alert(1)"></svg>', 'x.svg'))).rejects.toMatchObject({
      code: 'setting-file.wrong-type',
    });
    files.clearSettingFile(member('vorstand'), 'FAVICON');
    expect(files.listSettingFiles(member('vorstand')).items.map((s) => s.slot)).not.toContain('FAVICON');
  });

  it('refuses an SVG as e-mail logo (mail programs do not show SVG)', async () => {
    expect(() => files.pickSettingFile(member('vorstand'), 'MAIL_LOGO', 'file-logo-black')).toThrow(
      expect.objectContaining({ code: 'setting-file.wrong-type' }),
    );
    await expect(files.uploadSettingFile(slotRequest('MAIL_LOGO', svg('#000000'), 'mail.svg'))).rejects.toMatchObject({
      code: 'setting-file.wrong-type',
    });
  });

  it('lets only admin and board change a file a setting follows', async () => {
    const own = await files.upload(uploadRequest('trainer', 'f-damen', svg('#00ff00'), 'team.svg'));
    files.pickSettingFile(member('vorstand'), 'LOGO_SECONDARY', own.id);
    expect(files.listFiles(member('trainer'), 'f-damen').find((f) => f.id === own.id)).toMatchObject({ settingSource: true });
    expect(() => files.deleteFile(member('trainer'), own.id)).toThrow(expect.objectContaining({ code: 'access.denied' }));

    await files.uploadSettingFile(slotRequest('LOGO_SECONDARY', svg('#000000'), 'eigen.svg'));
    expect(files.listFiles(member('trainer'), 'f-damen').find((f) => f.id === own.id)).toMatchObject({ settingSource: false });
    files.deleteFile(member('trainer'), own.id);
  });

  it('seeds only safe SVGs', () => {
    const svgs = import.meta.glob<string>('../../lib/mock/brand/*.svg', { query: '?raw', import: 'default', eager: true });
    expect(Object.keys(svgs).length).toBeGreaterThan(5);
    for (const [name, text] of Object.entries(svgs)) expect([name, isSafeSvg(text)]).toEqual([name, true]);
  });
});
