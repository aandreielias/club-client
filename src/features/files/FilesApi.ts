import type { ApiClient } from '../../lib/http/ApiClient';
import type { ProgressListener } from '../../lib/http/Transport';
import type { DownloadLink, FileList, FilePatch, Folder, FolderList, FolderPatch, NewFolder, StoredFile } from './model';

/** Typed access to the files endpoints of club-server. */
export class FilesApi {
  static readonly BASE = '/api/v1';

  constructor(private readonly api: ApiClient) {}

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
