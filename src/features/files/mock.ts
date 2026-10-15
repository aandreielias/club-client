// Mock of the club-server files module (FileHandlers): folder visibility and management, content
// type detection, a fake virus scan (EICAR), photo consent for tags. File bytes live in memory only.
import { settings } from '../../settings';
import { directory, type MockDirectory } from '../../lib/mock/core';
import type { MockAudience } from '../../lib/mock/MockEventBus';
import { linkRefs, type FileLink } from '../../lib/mock/MockLinks';
import { MockServer, mockServer, type MockRequest } from '../../lib/mock/MockServer';
import { MockTable } from '../../lib/mock/MockTable';
import type { FileRef } from '../../lib/links/model';
import type { Member } from '../../lib/types';
import type { Folder, FolderKind, FolderScope, StoredFile } from './model';

type StoredFolder = Omit<Folder, 'canUpload' | 'canManage'>;

const fail = MockServer.fail;
const limits = settings.files;
const LINK_LIFETIME_MS = 5 * 60_000;
const EICAR = 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE';
const OFFICE: Readonly<Record<string, string>> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

/** server: FileHandlers.Viewer */
class Viewer {
  readonly board: boolean;
  readonly teamIds: Set<string>;
  readonly coachTeamIds: Set<string>;

  constructor(readonly member: Member, people: MockDirectory) {
    const own = people.teamRoles(member.id);
    this.board = people.isManager(member);
    this.teamIds = new Set(Object.keys(own));
    this.coachTeamIds = new Set(Object.keys(own).filter((t) => own[t] === 'COACH'));
  }

  canSee(f: StoredFolder): boolean {
    if (f.scope === 'CLUB') return true;
    if (f.scope === 'TEAM') return this.board || this.teamIds.has(f.teamId ?? '');
    return this.board;
  }

  canManage(f: StoredFolder): boolean {
    return this.board || (f.scope === 'TEAM' && this.coachTeamIds.has(f.teamId ?? ''));
  }
}

export class MockFiles {
  readonly folders: MockTable<StoredFolder[]>;
  readonly files: MockTable<StoredFile[]>;
  /** fileId → content; lost on reload, links then fall back to a placeholder. */
  readonly #blobs = new Map<string, Blob>();
  readonly #urls = new Map<string, string>();

  constructor(private readonly people: MockDirectory) {
    this.folders = new MockTable('folders', () => MockFiles.seedFolders());
    this.files = new MockTable('files', () => MockFiles.seedFiles());
  }

  listFolders(member: Member): Folder[] {
    const viewer = this.viewer(member);
    return this.folders.data.filter((f) => viewer.canSee(f)).map((f) => this.toDto(f, viewer));
  }

  createFolder(member: Member, body: Record<string, any>): Folder {
    const viewer = this.viewer(member);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > limits.folderNameMaxLength) fail(400, 'folder.name-invalid');
    if (body.kind !== 'DOCUMENTS' && body.kind !== 'PHOTOS') fail(400, 'folder.kind-or-scope-missing');
    let folder: StoredFolder;
    if (body.parentId) {
      const parent = this.visibleFolder(viewer, body.parentId);
      if (this.depth(parent) >= limits.maxFolderDepth) fail(400, 'folder.too-deep');
      folder = { id: crypto.randomUUID(), parentId: parent.id, name, kind: body.kind, scope: parent.scope, teamId: parent.teamId, membersCanUpload: !!body.membersCanUpload };
    } else {
      const scope = body.scope as FolderScope;
      if (!['CLUB', 'TEAM', 'BOARD'].includes(scope)) fail(400, 'folder.kind-or-scope-missing');
      if ((scope === 'TEAM') !== !!body.teamId) fail(400, 'folder.team-scope-mismatch');
      folder = { id: crypto.randomUUID(), parentId: null, name, kind: body.kind, scope, teamId: body.teamId ?? null, membersCanUpload: !!body.membersCanUpload };
    }
    this.requireManage(viewer, folder);
    this.folders.data.push(folder);
    this.folders.save();
    return this.toDto(folder, viewer);
  }

  deleteFolder(member: Member, id: string): void {
    const viewer = this.viewer(member);
    const folder = this.visibleFolder(viewer, id);
    this.requireManage(viewer, folder);
    if (this.folders.data.some((f) => f.parentId === id) || this.files.data.some((f) => f.folderId === id)) fail(409, 'folder.not-empty');
    this.folders.data.splice(this.folders.data.indexOf(folder), 1);
    this.folders.save();
  }

  listFiles(member: Member, folderId: string): StoredFile[] {
    const viewer = this.viewer(member);
    const folder = this.visibleFolder(viewer, folderId);
    return this.files.data.filter((f) => f.folderId === folder.id && (viewer.canManage(folder) || this.consented(f)));
  }

  async upload(req: MockRequest): Promise<StoredFile> {
    const viewer = this.viewer(directory.actor(req));
    const folder = this.visibleFolder(viewer, req.params.folderId);
    if (viewer.canManage(folder)) this.requireManage(viewer, folder);
    else if (!folder.membersCanUpload) fail(403, 'access.denied');
    const file = req.body instanceof FormData ? req.body.get('file') : null;
    if (!(file instanceof Blob)) return fail(400, 'request.invalid');
    if (file.size > limits.maxUploadBytes) fail(413, 'request.too-large');
    await MockFiles.simulateTransfer(file.size, req.onProgress);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const name = file instanceof File ? file.name : 'datei';
    const detected = MockFiles.detect(bytes, name);
    if (!detected || (folder.kind === 'PHOTOS' && !detected.image)) return fail(400, 'file.type-not-allowed');
    if (new TextDecoder().decode(bytes.subarray(0, 512)).includes(EICAR)) fail(400, 'file.infected');
    const tags = req.query.getAll('tag');
    this.requireTaggable(detected.image, tags);

    const size = detected.image && !detected.heic ? await MockFiles.imageSize(file) : null;
    const stored: StoredFile = {
      id: crypto.randomUUID(),
      folderId: folder.id,
      name: name.replace(/[^\p{L}\p{N} ._()-]/gu, '_'),
      contentType: detected.contentType,
      sizeBytes: file.size,
      width: size?.width ?? null,
      height: size?.height ?? null,
      // The real server renders thumbnails for every image (HEIC after conversion); the mock cannot convert HEIC.
      hasThumbnail: detected.image && !detected.heic,
      uploadedBy: viewer.member.id,
      taggedMemberIds: tags,
      createdAt: new Date().toISOString(),
    };
    this.#blobs.set(stored.id, new Blob([bytes], { type: stored.contentType }));
    this.files.data.push(stored);
    this.files.save();
    this.changed(folder, stored.id, 'UPLOADED');
    return stored;
  }

  link(member: Member, fileId: string, thumbnail: boolean): { url: string; expiresAt: string } {
    const file = this.visibleFile(this.viewer(member), fileId);
    if (thumbnail && !file.hasThumbnail) fail(404, 'file.no-thumbnail');
    return { url: this.objectUrl(file), expiresAt: new Date(Date.now() + LINK_LIFETIME_MS).toISOString() };
  }

  tag(member: Member, fileId: string, memberIds: unknown): StoredFile {
    const viewer = this.viewer(member);
    const file = this.visibleFile(viewer, fileId);
    const folder = this.folder(file.folderId);
    this.requireModify(viewer, folder, file);
    const ids = Array.isArray(memberIds) ? [...new Set(memberIds.map(String))] : fail(400, 'request.invalid');
    this.requireTaggable(file.contentType.startsWith('image/'), ids);
    file.taggedMemberIds = ids;
    this.files.save();
    this.changed(folder, file.id, 'TAGGED');
    return file;
  }

  deleteFile(member: Member, fileId: string): void {
    const viewer = this.viewer(member);
    const file = this.visibleFile(viewer, fileId);
    const folder = this.folder(file.folderId);
    this.requireModify(viewer, folder, file);
    this.files.data.splice(this.files.data.indexOf(file), 1);
    this.files.save();
    this.#blobs.delete(file.id);
    this.changed(folder, file.id, 'DELETED');
  }

  /** server: FileHandlers.fileRefs. Deleted files keep their last name for viewers of their last folder. */
  refs(member: Member, links: readonly FileLink[]): FileRef[] {
    const viewer = this.viewer(member);
    const seen = new Set<string>();
    const refs: FileRef[] = [];
    for (const link of links) {
      if (seen.has(link.fileId)) continue;
      seen.add(link.fileId);
      if (this.files.data.some((f) => f.id === link.fileId)) {
        try {
          const f = this.visibleFile(viewer, link.fileId);
          refs.push({ id: f.id, folderId: f.folderId, name: f.name, contentType: f.contentType, sizeBytes: f.sizeBytes, deleted: false });
        } catch {
          // not visible: left out
        }
      } else if (link.folderId) {
        const folder = this.folders.data.find((f) => f.id === link.folderId);
        if (folder ? viewer.canSee(folder) : viewer.board) {
          refs.push({ id: link.fileId, folderId: link.folderId, name: link.name ?? '', contentType: null, sizeBytes: 0, deleted: true });
        }
      }
    }
    return refs;
  }

  private viewer(member: Member): Viewer {
    return new Viewer(member, this.people);
  }

  private folder(id: string): StoredFolder {
    return this.folders.data.find((f) => f.id === id) ?? fail(404, 'folder.not-found');
  }

  private visibleFolder(viewer: Viewer, id: string): StoredFolder {
    const folder = this.folders.data.find((f) => f.id === id);
    if (!folder || !viewer.canSee(folder)) return fail(404, 'folder.not-found');
    return folder;
  }

  /** Not visible: unknown, folder hidden, or tagged without consent for non-managers. */
  private visibleFile(viewer: Viewer, id: string): StoredFile {
    const file = this.files.data.find((f) => f.id === id);
    const folder = file && this.folders.data.find((f) => f.id === file.folderId);
    if (!file || !folder || !viewer.canSee(folder) || (!viewer.canManage(folder) && !this.consented(file))) return fail(404, 'file.not-found');
    return file;
  }

  private consented(file: StoredFile): boolean {
    return file.taggedMemberIds.every((id) => this.people.hasPhotoConsent(id));
  }

  /** server: FileHandlers.requireManage */
  private requireManage(viewer: Viewer, folder: StoredFolder): void {
    if (viewer.board) this.people.requirePrivileged(viewer.member, ['ADMIN', 'BOARD']);
    else if (viewer.canManage(folder)) this.people.requirePrivileged(viewer.member, ['COACH']);
    else fail(403, 'access.denied');
  }

  /** Delete and tag: the uploader, or a folder manager (with step-up). */
  private requireModify(viewer: Viewer, folder: StoredFolder, file: StoredFile): void {
    if (viewer.canManage(folder)) this.requireManage(viewer, folder);
    else if (file.uploadedBy !== viewer.member.id) fail(403, 'access.denied');
  }

  private requireTaggable(image: boolean, tags: readonly string[]): void {
    if (!tags.length) return;
    if (!image || tags.length > limits.maxTags) fail(400, 'file.tags-invalid');
    if (!tags.every((id) => this.people.hasPhotoConsent(id))) fail(400, 'file.tag-without-consent');
  }

  private depth(folder: StoredFolder): number {
    let depth = 1;
    for (let parent = folder.parentId; parent && depth <= limits.maxFolderDepth; depth++) {
      parent = this.folders.data.find((f) => f.id === parent)?.parentId ?? null;
    }
    return depth;
  }

  private toDto(f: StoredFolder, viewer: Viewer): Folder {
    const manage = viewer.canManage(f);
    return { ...f, canManage: manage, canUpload: manage || (f.membersCanUpload && viewer.canSee(f)) };
  }

  /** server: FileHandlers.audience */
  private changed(folder: StoredFolder, fileId: string, change: 'UPLOADED' | 'DELETED' | 'TAGGED'): void {
    const audience: MockAudience =
      folder.scope === 'CLUB' ? { everyone: true } : folder.scope === 'BOARD' ? { roles: ['ADMIN', 'BOARD'] } : this.people.teamAudience(folder.teamId);
    mockServer.events.publish({ type: 'files.files-changed', data: { folderId: folder.id, fileId, change }, audience });
  }

  private objectUrl(file: StoredFile): string {
    let url = this.#urls.get(file.id);
    if (!url) {
      url = URL.createObjectURL(this.#blobs.get(file.id) ?? MockFiles.placeholder(file));
      this.#urls.set(file.id, url);
    }
    return url;
  }

  /** Stand-in content for seeded files and for uploads lost on reload. */
  private static placeholder(file: StoredFile): Blob {
    if (!file.contentType.startsWith('image/')) {
      return new Blob([`Beispieldatei "${file.name}" (Testmodus ohne Server).`], { type: 'text/plain' });
    }
    const w = file.width ?? 1200;
    const h = file.height ?? 800;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
      + `<rect width="100%" height="100%" fill="#e2e2e2"/>`
      + `<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="${Math.round(h / 14)}" fill="#777">${w} × ${h}</text></svg>`;
    return new Blob([svg], { type: 'image/svg+xml' });
  }

  /** server: FileType.detect (magic bytes; Office files by ZIP signature plus extension) */
  private static detect(bytes: Uint8Array, name: string): { contentType: string; image: boolean; heic: boolean } | null {
    const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
    if (starts(0xff, 0xd8, 0xff)) return { contentType: 'image/jpeg', image: true, heic: false };
    if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { contentType: 'image/png', image: true, heic: false };
    const brand = new TextDecoder().decode(bytes.subarray(4, 12));
    if (/^ftyp(heic|heix|mif1|msf1)/.test(brand)) return { contentType: 'image/jpeg', image: true, heic: true };
    if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) return { contentType: 'application/pdf', image: false, heic: false };
    const extension = name.toLowerCase().split('.').pop() ?? '';
    if (starts(0x50, 0x4b, 0x03, 0x04) && OFFICE[extension]) return { contentType: OFFICE[extension], image: false, heic: false };
    return null;
  }

  private static async imageSize(file: Blob): Promise<{ width: number; height: number } | null> {
    try {
      const bitmap = await createImageBitmap(file);
      const size = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return size;
    } catch {
      return null;
    }
  }

  private static async simulateTransfer(size: number, onProgress?: (loaded: number, total: number) => void): Promise<void> {
    const duration = Math.max(300, (size / (1024 * 1024)) * limits.mockUploadMsPerMb);
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      await new Promise((resolve) => setTimeout(resolve, duration / steps));
      onProgress?.(Math.round((size * i) / steps), size);
    }
  }

  private static seedFolders(): StoredFolder[] {
    const folder = (id: string, name: string, kind: FolderKind, scope: FolderScope, teamId: string | null, membersCanUpload: boolean, parentId: string | null = null): StoredFolder =>
      ({ id, parentId, name, kind, scope, teamId, membersCanUpload });
    return [
      folder('f-docs', 'Vereinsdokumente', 'DOCUMENTS', 'CLUB', null, false),
      folder('f-minutes', 'Protokolle', 'DOCUMENTS', 'CLUB', null, false, 'f-docs'),
      folder('f-photos', 'Fotos Saison 2026/27', 'PHOTOS', 'CLUB', null, true),
      folder('f-damen', 'Damen 1', 'DOCUMENTS', 'TEAM', 't-damen', true),
      folder('f-u16', 'U16 Fotos', 'PHOTOS', 'TEAM', 't-u16', true),
      folder('f-board', 'Vorstand intern', 'DOCUMENTS', 'BOARD', null, false),
    ];
  }

  private static seedFiles(): StoredFile[] {
    const day = 86_400_000;
    const file = (id: string, folderId: string, name: string, contentType: string, sizeBytes: number, uploadedBy: string, daysAgo: number,
      image?: { width: number; height: number; tags?: string[] }): StoredFile => ({
      id, folderId, name, contentType, sizeBytes, width: image?.width ?? null, height: image?.height ?? null, hasThumbnail: !!image,
      uploadedBy, taggedMemberIds: image?.tags ?? [], createdAt: new Date(Date.now() - daysAgo * day).toISOString(),
    });
    return [
      file('file-1', 'f-docs', 'Satzung.pdf', 'application/pdf', 182_000, 'admin', 90),
      file('file-2', 'f-docs', 'Beitragsordnung 2026.pdf', 'application/pdf', 64_000, 'vorstand', 30),
      file('file-3', 'f-minutes', 'Protokoll Vorstandssitzung September.docx', OFFICE.docx, 41_000, 'vorstand', 20),
      file('file-4', 'f-damen', 'Spielplan Herbst.xlsx', OFFICE.xlsx, 23_000, 'trainer', 12),
      file('file-5', 'f-photos', 'Saisonauftakt-1.jpg', 'image/jpeg', 2_400_000, 'trainer', 10, { width: 1600, height: 1067 }),
      file('file-6', 'f-photos', 'Saisonauftakt-2.jpg', 'image/jpeg', 2_100_000, 'trainer', 10, { width: 1600, height: 1067, tags: ['spielerin'] }),
      file('file-7', 'f-u16', 'Training U16.jpg', 'image/jpeg', 1_800_000, 'trainer', 4, { width: 1200, height: 1600, tags: ['spieler'] }),
      file('file-8', 'f-board', 'Budget 2027.xlsx', OFFICE.xlsx, 31_000, 'admin', 3),
    ];
  }
}

export const files = new MockFiles(directory);

linkRefs.files = (member, links) => files.refs(member, links);

const actor = (req: MockRequest) => directory.actor(req);

mockServer
  .on('GET', '/api/v1/folders', (req) => ({ items: files.listFolders(actor(req)) }))
  .on('POST', '/api/v1/folders', (req) => files.createFolder(actor(req), req.body ?? {}))
  .on('DELETE', '/api/v1/folders/:id', (req) => files.deleteFolder(actor(req), req.params.id))
  .on('GET', '/api/v1/folders/:folderId/files', (req) => ({ items: files.listFiles(actor(req), req.params.folderId) }))
  .on('POST', '/api/v1/folders/:folderId/files', (req) => files.upload(req))
  .on('GET', '/api/v1/files/:id/link', (req) => files.link(actor(req), req.params.id, req.query.get('thumbnail') === 'true'))
  .on('PUT', '/api/v1/files/:id/tags', (req) => files.tag(actor(req), req.params.id, req.body?.memberIds))
  .on('DELETE', '/api/v1/files/:id', (req) => files.deleteFile(actor(req), req.params.id));
