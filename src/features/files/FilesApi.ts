import type { ApiClient } from '../../lib/http/ApiClient';
import type { ProgressListener } from '../../lib/http/Transport';
import type {
  DownloadLink,
  FileHits,
  FileList,
  FilePatch,
  FileSettings,
  FileVersion,
  Folder,
  FolderList,
  FolderPatch,
  NewFolder,
  SettingFile,
  SettingFileList,
  SettingSlot,
  StoredFile,
} from './model';

/** Typed access to the files endpoints of club-server. */
export class FilesApi {
  static readonly BASE = '/api/v1';

  constructor(private readonly api: ApiClient) {}

  /** Admin and board: the upload quota per member. */
  settings(): Promise<FileSettings> {
    return this.api.get<FileSettings>(`${FilesApi.BASE}/files/settings`);
  }

  saveSettings(settings: FileSettings): Promise<FileSettings> {
    return this.api.put<FileSettings>(`${FilesApi.BASE}/files/settings`, settings);
  }

  /** Admin and board: the files the settings use (logos, templates). */
  async settingFiles(): Promise<SettingFile[]> {
    return (await this.api.get<SettingFileList>(`${FilesApi.BASE}/files/setting-files`)).items;
  }

  /** Copies a visible file into the slot; the copy follows its new versions. */
  pickSettingFile(slot: SettingSlot, fileId: string): Promise<SettingFile> {
    return this.api.put<SettingFile>(`${FilesApi.BASE}/files/setting-files/${slot}`, { fileId });
  }

  /** Own bytes for the slot; unlinks it from the file it followed. */
  uploadSettingFile(slot: SettingSlot, file: File): Promise<SettingFile> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.api.upload<SettingFile>(`${FilesApi.BASE}/files/setting-files/${slot}`, form);
  }

  clearSettingFile(slot: SettingSlot): Promise<void> {
    return this.api.delete(`${FilesApi.BASE}/files/setting-files/${slot}`);
  }

  /** Visible files whose name contains `query`. */
  async search(query: string, limit: number): Promise<FileHits['files']> {
    return (await this.api.get<FileHits>(`${FilesApi.BASE}/files`, { q: query.trim(), limit })).files;
  }

  /** Every folder the member may see (flat; build the tree from parentId). */
  async folders(): Promise<Folder[]> {
    return (await this.api.get<FolderList>(`${FilesApi.BASE}/folders`)).items;
  }

  createFolder(folder: NewFolder): Promise<Folder> {
    return this.api.post<Folder>(`${FilesApi.BASE}/folders`, folder);
  }

  updateFolder(id: string, patch: FolderPatch): Promise<Folder> {
    return this.api.patch<Folder>(`${FilesApi.BASE}/folders/${encodeURIComponent(id)}`, patch);
  }

  updateFile(id: string, patch: FilePatch): Promise<StoredFile> {
    return this.api.patch<StoredFile>(`${FilesApi.BASE}/files/${encodeURIComponent(id)}`, patch);
  }

  /** Only empty folders (no files, no subfolders). */
  deleteFolder(id: string): Promise<void> {
    return this.api.delete(`${FilesApi.BASE}/folders/${encodeURIComponent(id)}`);
  }

  async files(folderId: string): Promise<StoredFile[]> {
    return (await this.api.get<FileList>(`${FilesApi.BASE}/folders/${encodeURIComponent(folderId)}/files`)).items;
  }

  /** Multipart field `file`; tags (photos only) as repeated `tag` parameters. */
  upload(folderId: string, file: File, tags: readonly string[], onProgress?: ProgressListener): Promise<StoredFile> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.api.upload<StoredFile>(`${FilesApi.BASE}/folders/${encodeURIComponent(folderId)}/files`, form, onProgress, {
      tag: tags,
    });
  }

  /** New version of a document (same type); multipart `file`, `label`, `date`. */
  uploadVersion(fileId: string, file: File, label: string, date: string, onProgress?: ProgressListener): Promise<StoredFile> {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('label', label);
    form.append('date', date);
    return this.api.upload<StoredFile>(`${FilesApi.BASE}/files/${encodeURIComponent(fileId)}/versions`, form, onProgress);
  }

  async versions(fileId: string): Promise<FileVersion[]> {
    return (await this.api.get<{ items: FileVersion[] }>(`${FilesApi.BASE}/files/${encodeURIComponent(fileId)}/versions`)).items;
  }

  versionLink(fileId: string, versionId: string): Promise<DownloadLink> {
    return this.api.get<DownloadLink>(`${FilesApi.BASE}/files/${encodeURIComponent(fileId)}/versions/${encodeURIComponent(versionId)}/link`);
  }

  link(fileId: string, thumbnail: boolean): Promise<DownloadLink> {
    return this.api.get<DownloadLink>(`${FilesApi.BASE}/files/${encodeURIComponent(fileId)}/link`, { thumbnail });
  }

  /** Replaces the tags of a photo. */
  tag(fileId: string, memberIds: readonly string[]): Promise<StoredFile> {
    return this.api.put<StoredFile>(`${FilesApi.BASE}/files/${encodeURIComponent(fileId)}/tags`, { memberIds });
  }

  deleteFile(fileId: string): Promise<void> {
    return this.api.delete(`${FilesApi.BASE}/files/${encodeURIComponent(fileId)}`);
  }
}
