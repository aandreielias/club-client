// Mirrors of the club-server files DTOs.

/** DOCUMENTS accept documents and images; PHOTOS accept images only. */
export type FolderKind = 'DOCUMENTS' | 'PHOTOS';

/** CLUB: all members. TEAM: the team, guardians of its members, admin and board. BOARD: admin and board. */
export type FolderScope = 'CLUB' | 'TEAM' | 'BOARD';

export interface Folder {
  id: string;
  parentId: string | null;
  name: string;
  kind: FolderKind;
  scope: FolderScope;
  teamId: string | null;
  membersCanUpload: boolean;
  /** Computed by the server for the signed-in member. */
  canUpload: boolean;
  canManage: boolean;
}

export interface FolderList {
  items: Folder[];
}

export interface NewFolder {
  /** Subfolders inherit scope and team from the parent. */
  parentId: string | null;
  name: string;
  kind: FolderKind;
  scope: FolderScope | null;
  teamId: string | null;
  membersCanUpload: boolean;
}

export interface StoredFile {
  id: string;
  folderId: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  hasThumbnail: boolean;
  uploadedBy: string;
  taggedMemberIds: string[];
  createdAt: string;
}

export interface FileList {
  items: StoredFile[];
}

/** Presigned link, valid for about 5 minutes; use it right away, never store it. */
export interface DownloadLink {
  url: string;
  expiresAt: string;
}

export const FOLDER_KINDS: readonly { value: FolderKind; label: string }[] = [
  { value: 'DOCUMENTS', label: 'Dokumente' },
  { value: 'PHOTOS', label: 'Fotoalbum' },
];

export const FOLDER_SCOPES: readonly { value: FolderScope; label: string; hint: string }[] = [
  { value: 'CLUB', label: 'Ganzer Verein', hint: 'Alle Mitglieder sehen den Ordner.' },
  { value: 'TEAM', label: 'Team', hint: 'Das Team, Erziehungsberechtigte der Mitglieder, Vorstand und Admins.' },
  { value: 'BOARD', label: 'Vorstand', hint: 'Nur Vorstand und Admins.' },
];

export const scopeLabel = (scope: FolderScope): string => FOLDER_SCOPES.find((s) => s.value === scope)?.label ?? scope;
