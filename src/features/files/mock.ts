// Mock of the club-server files module (FileHandlers): folder visibility and management, content
// type detection, a fake virus scan (EICAR), photo consent for tags. File bytes live in memory only.
import { activity, MockActivity } from '../../lib/mock/MockActivity';
import { settings } from '../../settings';
import { directory, type MockDirectory } from '../../lib/mock/core';
import type { MockAudience } from '../../lib/mock/MockEventBus';
import { linkRefs, type FileLink } from '../../lib/mock/MockLinks';
import { MockServer, mockServer, type MockRequest } from '../../lib/mock/MockServer';
import { MockTable } from '../../lib/mock/MockTable';
import type { FileRef } from '../../lib/links/model';
import type { Member } from '../../lib/types';
import type { DownloadLink, FileVersion, Folder, FolderKind, FolderScope, StoredFile } from './model';

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
    if (f.scope === 'TEAM') return this.board || f.teamIds.some((t) => this.teamIds.has(t));
    return this.board;
  }

  canManage(f: StoredFolder): boolean {
    // Coaches manage a team folder only when they coach every one of its teams.
    return this.board || (f.scope === 'TEAM' && f.teamIds.every((t) => this.coachTeamIds.has(t)));
  }
}

type StoredVersion = FileVersion;

/** Text of the seeded Hallenordnung versions (Word content is built on demand). */
const SAMPLE_VERSIONS: Readonly<Record<string, readonly string[]>> = {
  'v-10-1': [
    'Die Halle ist ab 17:00 Uhr für den Verein reserviert.',
    'Hallenschuhe mit heller Sohle sind Pflicht.',
    'Bälle werden nach dem Training in den Geräteraum gebracht.',
    'Der Schlüssel liegt beim Schulwart.',
  ],
  'v-10-2': [
    'Die Halle ist ab 17:30 Uhr für den Verein reserviert.',
    'Hallenschuhe mit heller Sohle sind Pflicht.',
    'Bälle werden nach dem Training in den Geräteraum gebracht.',
    'Getränke nur in verschließbaren Flaschen.',
    'Der Schlüssel liegt beim Schulwart.',
  ],
};

export class MockFiles {
  readonly folders: MockTable<StoredFolder[]>;
  readonly files: MockTable<StoredFile[]>;
  /** fileId → versions, newest first (server: files_version); bytes in #blobs under the version id. */
  readonly versions: MockTable<Record<string, StoredVersion[]>>;
  /** fileId → content; lost on reload, links then fall back to a placeholder. */
  readonly #blobs = new Map<string, Blob>();
  readonly #urls = new Map<string, string>();

  constructor(private readonly people: MockDirectory) {
    this.folders = new MockTable('folders', () => MockFiles.seedFolders());
    this.files = new MockTable('files', () => MockFiles.seedFiles());
    this.versions = new MockTable('file-versions', () => MockFiles.seedVersions());
    // Folders stored before several teams per folder existed carry a single `teamId` (server: migration V16).
    for (const f of this.folders.data as (StoredFolder & { teamId?: string | null })[]) {
      if (!Array.isArray(f.teamIds)) {
        f.teamIds = f.teamId ? [f.teamId] : [];
        delete f.teamId;
      }
    }
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
      folder = { id: crypto.randomUUID(), parentId: parent.id, name, kind: body.kind, scope: parent.scope, teamIds: [...parent.teamIds], membersCanUpload: !!body.membersCanUpload, color: null, coverFileId: null };
    } else {
      const scope = body.scope as FolderScope;
      if (!['CLUB', 'TEAM', 'BOARD'].includes(scope)) fail(400, 'folder.kind-or-scope-missing');
      const teamIds: string[] = Array.isArray(body.teamIds) ? [...new Set(body.teamIds.map(String))] : [];
      if ((scope === 'TEAM') !== teamIds.length > 0) fail(400, 'folder.team-scope-mismatch');
      folder = { id: crypto.randomUUID(), parentId: null, name, kind: body.kind, scope, teamIds, membersCanUpload: !!body.membersCanUpload, color: null, coverFileId: null };
    }
    this.requireManage(viewer, folder);
    this.folders.data.push(folder);
    this.folders.save();
    return this.toDto(folder, viewer);
  }

  /** server: FileHandlers.updateFolder */
  updateFolder(member: Member, id: string, body: Record<string, any>): Folder {
    const viewer = this.viewer(member);
    const folder = this.visibleFolder(viewer, id);
    this.requireManage(viewer, folder);
    const name = body.name === undefined ? folder.name : String(body.name).trim();
    if (!name || name.length > limits.folderNameMaxLength) fail(400, 'folder.name-invalid');
    const scope: FolderScope = body.scope ?? folder.scope;
    const current = [...folder.teamIds].sort();
    const teamIds: string[] = body.scope ? [...new Set<string>((body.teamIds ?? []).map(String))].sort() : current;
    const scopeChanged = scope !== folder.scope || teamIds.join() !== current.join();
    if (scopeChanged && folder.parentId) fail(400, 'folder.scope-inherited');
    if ((scope === 'TEAM') !== teamIds.length > 0) fail(400, 'folder.team-scope-mismatch');
    let cover = body.clearCover ? null : (folder.coverFileId ?? null);
    if (body.coverFileId && !body.clearCover) {
      const file = this.files.data.find((f) => f.id === body.coverFileId && f.folderId === folder.id && f.contentType.startsWith('image/'));
      if (!file) fail(400, 'folder.cover-invalid');
      cover = body.coverFileId;
    }
    const color = body.clearColor ? null : (body.color ?? folder.color ?? null);
    const changed: StoredFolder = { ...folder, name, scope, teamIds, color, coverFileId: cover };
    this.requireManage(viewer, changed);
    const before = { ...folder };
    Object.assign(folder, changed);
    if (scopeChanged) for (const sub of this.descendants(folder.id)) Object.assign(sub, { scope, teamIds });
    this.folders.save();
    this.changed(before, null, 'FOLDER_UPDATED');
    if (scopeChanged) this.changed(folder, null, 'FOLDER_UPDATED');
    return this.toDto(folder, viewer);
  }

  /** server: FileHandlers.updateFile */
  updateFile(member: Member, fileId: string, body: Record<string, any>): StoredFile {
    const viewer = this.viewer(member);
    const file = this.visibleFile(viewer, fileId);
    const folder = this.folder(file.folderId);
    this.requireModify(viewer, folder, file);
    let target = folder;
    if (body.folderId && body.folderId !== folder.id) {
      target = this.visibleFolder(viewer, body.folderId);
      this.requireManage(viewer, folder);
      this.requireManage(viewer, target);
      if (target.kind === 'PHOTOS' && !file.contentType.startsWith('image/')) fail(400, 'file.type-not-allowed');
    }
    if (body.name !== undefined) {
      const extension = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
      const base = String(body.name).replace(/\.[^.]*$/, '').replace(/[^\p{L}\p{N} ._()-]/gu, '_').trim().slice(0, 100) || 'datei';
      file.name = base + extension;
    }
    if (target !== folder) {
      file.folderId = target.id;
      for (const f of this.folders.data) if (f.coverFileId === file.id && f.id !== target.id) f.coverFileId = null;
      this.folders.save();
    }
    this.files.save();
    this.changed(folder, file.id, 'UPDATED');
    MockActivity.record('FILE', file.id, viewer.member, 'UPDATED', { title: file.name, teamIds: target.teamIds, parentId: target.id });
    if (target !== folder) this.changed(target, file.id, 'UPDATED');
    return file;
  }

  /** server: FileHandlers.audience - members of all the folder's teams plus their guardians, admin and board. */
  private teamsAudience(teamIds: readonly string[]): MockAudience {
    const audiences = teamIds.map((id) => this.people.teamAudience(id));
    return { members: [...new Set(audiences.flatMap((a) => a.members ?? []))], roles: ['ADMIN', 'BOARD'] };
  }

  private descendants(id: string): StoredFolder[] {
    const found: StoredFolder[] = [];
    const parents = new Set([id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const f of this.folders.data) {
        if (f.parentId && parents.has(f.parentId) && !parents.has(f.id)) {
          parents.add(f.id);
          found.push(f);
          grew = true;
        }
      }
    }
    return found;
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

  /** server: FileHandlers.searchFiles */
  search(member: Member, query: string, limit: number) {
    const viewer = this.viewer(member);
    const q = query.trim().toLocaleLowerCase();
    return this.files.data
      .map((f) => ({ f, folder: this.folders.data.find((d) => d.id === f.folderId)! }))
      .filter(({ f, folder }) => viewer.canSee(folder) && (viewer.canManage(folder) || this.consented(f)) && f.name.toLocaleLowerCase().includes(q))
      .sort((a, b) => a.f.name.toLocaleLowerCase().localeCompare(b.f.name.toLocaleLowerCase()))
      .slice(0, Math.min(Math.max(limit, 1), 50))
      .map(({ f, folder }) => ({ id: f.id, folderId: f.folderId, folderName: folder.name, name: f.name, contentType: f.contentType, sizeBytes: f.sizeBytes }));
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
      version: null,
    };
    this.#blobs.set(stored.id, new Blob([bytes], { type: stored.contentType }));
    this.files.data.push(stored);
    this.files.save();
    this.changed(folder, stored.id, 'UPLOADED');
    MockActivity.record('FILE', stored.id, viewer.member, 'UPLOADED', { title: stored.name, teamIds: folder.teamIds, parentId: folder.id });
    return stored;
  }

  /** server: FileHandlers.uploadVersion */
  async uploadVersion(req: MockRequest): Promise<StoredFile> {
    const viewer = this.viewer(directory.actor(req));
    const file = this.visibleFile(viewer, req.params.id);
    const folder = this.folders.data.find((f) => f.id === file.folderId)!;
    this.requireModify(viewer, folder, file);
    if (folder.kind !== 'DOCUMENTS') fail(400, 'file.versions-documents-only');
    const body = req.body instanceof FormData ? req.body : null;
    const upload = body?.get('file');
    const label = String(body?.get('label') ?? '').trim();
    const date = String(body?.get('date') ?? '');
    if (!(upload instanceof Blob)) return fail(400, 'request.invalid');
    if (!label || label.length > limits.versionLabelMaxLength) fail(400, 'file.version-label-invalid');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(400, 'file.version-date-missing');
    await MockFiles.simulateTransfer(upload.size, req.onProgress);
    const bytes = new Uint8Array(await upload.arrayBuffer());
    if (MockFiles.detect(bytes, upload instanceof File ? upload.name : file.name)?.contentType !== file.contentType) fail(400, 'file.version-type-mismatch');
    if (new TextDecoder().decode(bytes.subarray(0, 512)).includes(EICAR)) fail(400, 'file.infected');
    const list = (this.versions.data[file.id] ??= []);
    if (list.some((v) => v.label.toLowerCase() === label.toLowerCase()) || (!list.length && label === '1.0')) fail(409, 'file.version-exists');
    if (!list.length) {
      // The first upload becomes version 1.0; its bytes move under their own key.
      const first: StoredVersion = { id: crypto.randomUUID(), label: '1.0', date: file.createdAt.slice(0, 10), contentType: file.contentType,
        sizeBytes: file.sizeBytes, uploadedBy: file.uploadedBy, createdAt: file.createdAt, current: false };
      const blob = this.#blobs.get(file.id);
      if (blob) this.#blobs.set(first.id, blob);
      list.push(first);
    }
    list.forEach((v) => (v.current = false));
    const added: StoredVersion = { id: crypto.randomUUID(), label, date, contentType: file.contentType, sizeBytes: upload.size,
      uploadedBy: viewer.member.id, createdAt: new Date().toISOString(), current: true };
    list.unshift(added);
    const blob = new Blob([bytes], { type: file.contentType });
    this.#blobs.set(added.id, blob);
    this.#blobs.set(file.id, blob);
    this.#urls.delete(file.id);
    Object.assign(file, { sizeBytes: upload.size, version: label });
    this.files.save();
    this.versions.save();
    this.changed(folder, file.id, 'UPDATED');
    MockActivity.record('FILE', file.id, viewer.member, 'UPDATED', { title: file.name, teamIds: folder.teamIds, parentId: folder.id });
    return file;
  }

  listVersions(member: Member, fileId: string): { items: StoredVersion[] } {
    const file = this.visibleFile(this.viewer(member), fileId);
    return { items: this.versions.data[file.id] ?? [] };
  }

  async versionLink(member: Member, fileId: string, versionId: string): Promise<DownloadLink> {
    const file = this.visibleFile(this.viewer(member), fileId);
    const version = (this.versions.data[file.id] ?? []).find((v) => v.id === versionId) ?? fail(404, 'file.version-not-found');
    if (!this.#blobs.has(version.id)) {
      const text = SAMPLE_VERSIONS[version.id];
      this.#blobs.set(version.id, text ? await MockFiles.docx(file, text) : MockFiles.placeholder(file));
    }
    return { url: URL.createObjectURL(this.#blobs.get(version.id)!), expiresAt: new Date(Date.now() + LINK_LIFETIME_MS).toISOString() };
  }

  link(member: Member, fileId: string, thumbnail: boolean): DownloadLink | Promise<DownloadLink> {
    const file = this.visibleFile(this.viewer(member), fileId);
    if (thumbnail && !file.hasThumbnail) fail(404, 'file.no-thumbnail');
    const answer = () => ({ url: this.objectUrl(file), expiresAt: new Date(Date.now() + LINK_LIFETIME_MS).toISOString() });
    // Seeded Word files get real content (built asynchronously), so the preview has something to show.
    const sample = { [OFFICE.docx]: MockFiles.docx, [OFFICE.xlsx]: MockFiles.xlsx, [OFFICE.pptx]: MockFiles.pptx }[file.contentType];
    const current = (this.versions.data[file.id] ?? []).find((v) => v.current);
    if (current && SAMPLE_VERSIONS[current.id] && !this.#blobs.has(file.id)) {
      return MockFiles.docx(file, SAMPLE_VERSIONS[current.id]).then((blob) => (this.#blobs.set(file.id, blob), answer()));
    }
    if (sample && !this.#blobs.has(file.id)) {
      return sample(file).then((blob) => (this.#blobs.set(file.id, blob), answer()));
    }
    return answer();
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
    MockActivity.record('FILE', file.id, viewer.member, 'TAGGED', { title: file.name, teamIds: folder.teamIds, parentId: folder.id });
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
    MockActivity.record('FILE', file.id, viewer.member, 'DELETED', { title: file.name, teamIds: folder.teamIds, parentId: folder.id });
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
    // Folders stored before colours existed have neither field.
    return { ...f, color: f.color ?? null, coverFileId: f.coverFileId ?? null, canManage: manage, canUpload: manage || (f.membersCanUpload && viewer.canSee(f)) };
  }

  /** server: FileHandlers.audience */
  private changed(folder: StoredFolder, fileId: string | null, change: 'UPLOADED' | 'DELETED' | 'TAGGED' | 'UPDATED' | 'FOLDER_UPDATED'): void {
    const audience: MockAudience =
      folder.scope === 'CLUB' ? { everyone: true } : folder.scope === 'BOARD' ? { roles: ['ADMIN', 'BOARD'] } : this.teamsAudience(folder.teamIds);
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
    if (file.contentType === 'application/pdf') return MockFiles.pdf(file.name);
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

  /** A one-page PDF with the file name, built by hand (offsets in the xref table must be exact). */
  static pdf(title: string): Blob {
    // Standard PDF fonts only cover Latin-1 reliably: spell umlauts out, escape the string delimiters.
    const text = (s: string) => s.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss')
      .replace(/[^\x20-\x7e]/g, '?').replace(/([()\\])/g, '\\$1');
    const stream = `BT /F1 20 Tf 72 760 Td (${text(title)}) Tj 0 -32 Td /F1 12 Tf (Beispieldokument im Testmodus ohne Server.) Tj ET`;
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ];
    let body = '%PDF-1.4\n';
    const offsets = objects.map((object, i) => {
      const offset = body.length;
      body += `${i + 1} 0 obj\n${object}\nendobj\n`;
      return offset;
    });
    const xref = body.length;
    body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
    body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return new Blob([body], { type: 'application/pdf' });
  }

  /** A minimal Word document with the file name as heading and the given paragraphs. */
  static async docx(file: StoredFile, paragraphs: readonly string[] = ['Beispieldokument im Testmodus ohne Server.']): Promise<Blob> {
    const { default: JSZip } = await import('jszip');
    const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    const paragraph = (text: string, size: number, bold = false) =>
      `<w:p><w:r><w:rPr>${bold ? '<w:b/>' : ''}<w:sz w:val="${size}"/></w:rPr><w:t>${escape(text)}</w:t></w:r></w:p>`;
    zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraph(file.name.replace(/\.docx$/i, ''), 36, true)}${paragraphs.map((p) => paragraph(p, 24)).join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`);
    return zip.generateAsync({ type: 'blob', mimeType: file.contentType });
  }

  /** A small workbook: one sheet with a header row and a few lines (shared and inline strings, numbers). */
  static async xlsx(file: StoredFile): Promise<Blob> {
    const { default: JSZip } = await import('jszip');
    const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const rows = [
      ['Datum', 'Gegner', 'Ort', 'Punkte'],
      ['19.10.2026', 'VC Musterstadt', 'Heim', 3],
      ['26.10.2026', 'SV Bergdorf', 'Auswärts', 1],
      ['09.11.2026', 'TSV Seeblick', 'Heim', 0],
    ];
    const cell = (value: string | number, column: number, row: number) => {
      const ref = String.fromCharCode(65 + column) + (row + 1);
      return typeof value === 'number' ? `<c r="${ref}"><v>${value}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t>${escape(value)}</t></is></c>`;
    };
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
    zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escape(file.name.replace(/\.xlsx$/i, '').slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`);
    zip.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
    zip.file('xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((r, i) => `<row r="${i + 1}">${r.map((v, c) => cell(v, c, i)).join('')}</row>`).join('')}</sheetData></worksheet>`);
    return zip.generateAsync({ type: 'blob', mimeType: file.contentType });
  }

  /** A three-slide presentation with titles and bullet points. */
  static async pptx(file: StoredFile): Promise<Blob> {
    const { default: JSZip } = await import('jszip');
    const slides = [
      ['Saisonplanung 2026/27', 'Ziele, Termine und Aufgaben'],
      ['Ziele', 'Klassenerhalt Damen 1', 'Zweites Nachwuchsteam', 'Neue Trikots'],
      ['Nächste Schritte', 'Hallenzeiten bestätigen', 'Trainerteam einteilen'],
    ];
    const ns = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
    const zip = new JSZip();
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>${slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')}</Types>`);
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>');
    zip.file('ppt/presentation.xml', `<?xml version="1.0" encoding="UTF-8"?><p:presentation ${ns}><p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`).join('')}</p:sldIdLst></p:presentation>`);
    zip.file('ppt/_rels/presentation.xml.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${slides.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`).join('')}</Relationships>`);
    slides.forEach((lines, i) => {
      const paragraphs = lines.map((text) => `<a:p><a:r><a:t>${text}</a:t></a:r></a:p>`).join('');
      zip.file(`ppt/slides/slide${i + 1}.xml`, `<?xml version="1.0" encoding="UTF-8"?><p:sld ${ns}><p:cSld><p:spTree><p:sp><p:txBody>${paragraphs}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`);
    });
    return zip.generateAsync({ type: 'blob', mimeType: file.contentType });
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
    const folder = (id: string, name: string, kind: FolderKind, scope: FolderScope, teamId: string | null, membersCanUpload: boolean, parentId: string | null = null,
      style: Pick<StoredFolder, 'color' | 'coverFileId'> = { color: null, coverFileId: null }): StoredFolder =>
      ({ id, parentId, name, kind, scope, teamIds: teamId ? [teamId] : [], membersCanUpload, ...style });
    return [
      folder('f-docs', 'Vereinsdokumente', 'DOCUMENTS', 'CLUB', null, false),
      folder('f-minutes', 'Protokolle', 'DOCUMENTS', 'CLUB', null, false, 'f-docs'),
      folder('f-photos', 'Fotos Saison 2026/27', 'PHOTOS', 'CLUB', null, true, null, { color: 'BLUE', coverFileId: 'file-5' }),
      folder('f-damen', 'Damen 1', 'DOCUMENTS', 'TEAM', 't-damen', true, null, { color: 'GREEN', coverFileId: null }),
      folder('f-u16', 'U16 Fotos', 'PHOTOS', 'TEAM', 't-u16', true),
      folder('f-board', 'Vorstand intern', 'DOCUMENTS', 'BOARD', null, false),
    ];
  }

  private static seedFiles(): StoredFile[] {
    const day = 86_400_000;
    const file = (id: string, folderId: string, name: string, contentType: string, sizeBytes: number, uploadedBy: string, daysAgo: number,
      image?: { width: number; height: number; tags?: string[] }): StoredFile => ({
      id, folderId, name, contentType, sizeBytes, width: image?.width ?? null, height: image?.height ?? null, hasThumbnail: !!image,
      uploadedBy, taggedMemberIds: image?.tags ?? [], createdAt: new Date(Date.now() - daysAgo * day).toISOString(), version: null,
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
      file('file-9', 'f-docs', 'Saisonplanung 2026-27.pptx', OFFICE.pptx, 88_000, 'vorstand', 6),
      { ...file('file-10', 'f-docs', 'Hallenordnung.docx', OFFICE.docx, 12_000, 'vorstand', 60), version: '1.1' },
    ];
  }

  /** The seeded Hallenordnung in two versions, so comparing has something to show. */
  private static seedVersions(): Record<string, StoredVersion[]> {
    const at = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();
    const v = (id: string, label: string, date: string, daysAgo: number, current: boolean): StoredVersion =>
      ({ id, label, date, contentType: OFFICE.docx, sizeBytes: 12_000, uploadedBy: 'vorstand', createdAt: at(daysAgo), current });
    return { 'file-10': [v('v-10-2', '1.1', '2026-09-01', 5, true), v('v-10-1', '1.0', '2025-09-01', 60, false)] };
  }
}

export const files = new MockFiles(directory);

linkRefs.files = (member, links) => files.refs(member, links);

const actor = (req: MockRequest) => directory.actor(req);

mockServer
  .on('GET', '/api/v1/files/:id/activity', (req) => {
    const [ref] = files.refs(actor(req), [{ fileId: req.params.id, folderId: null, name: null }]);
    return ref && !ref.deleted ? activity.list(actor(req), 'FILE', ref.id) : MockServer.fail(404, 'file.not-found');
  })
  .on('GET', '/api/v1/folders', (req) => ({ items: files.listFolders(actor(req)) }))
  .on('POST', '/api/v1/folders', (req) => files.createFolder(actor(req), req.body ?? {}))
  .on('PATCH', '/api/v1/folders/:id', (req) => files.updateFolder(actor(req), req.params.id, req.body ?? {}))
  .on('PATCH', '/api/v1/files/:id', (req) => files.updateFile(actor(req), req.params.id, req.body ?? {}))
  .on('DELETE', '/api/v1/folders/:id', (req) => files.deleteFolder(actor(req), req.params.id))
  .on('GET', '/api/v1/folders/:folderId/files', (req) => ({ items: files.listFiles(actor(req), req.params.folderId) }))
  .on('POST', '/api/v1/folders/:folderId/files', (req) => files.upload(req))
  .on('GET', '/api/v1/files', (req) => ({ files: files.search(actor(req), req.query.get('q') ?? '', Number(req.query.get('limit') ?? 20)) }))
  .on('POST', '/api/v1/files/:id/versions', (req) => files.uploadVersion(req))
  .on('GET', '/api/v1/files/:id/versions', (req) => files.listVersions(actor(req), req.params.id))
  .on('GET', '/api/v1/files/:id/versions/:versionId/link', (req) => files.versionLink(actor(req), req.params.id, req.params.versionId))
  .on('GET', '/api/v1/files/:id/link', (req) => files.link(actor(req), req.params.id, req.query.get('thumbnail') === 'true'))
  .on('PUT', '/api/v1/files/:id/tags', (req) => files.tag(actor(req), req.params.id, req.body?.memberIds))
  .on('DELETE', '/api/v1/files/:id', (req) => files.deleteFile(actor(req), req.params.id));
