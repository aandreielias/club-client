import type { Hue } from '../../lib/types';

// Mirrors of the club-server files DTOs.

/** DOCUMENTS accept documents and images; PHOTOS accept images only. */
export type FolderKind = 'DOCUMENTS' | 'PHOTOS';

/** CLUB: all members. TEAM: the team, guardians of its members, admin and board. BOARD: admin and board. */
export type FolderScope = 'CLUB' | 'TEAM' | 'BOARD';

/** Folder colours: the hues of the tags. */
export type FolderColor = 'GRAY' | 'BROWN' | 'ORANGE' | 'YELLOW' | 'GREEN' | 'BLUE' | 'PURPLE' | 'RED';

export interface Folder {
  id: string;
  parentId: string | null;
  name: string;
  kind: FolderKind;
  scope: FolderScope;
  teamId: string | null;
  membersCanUpload: boolean;
  color: FolderColor | null;
  /** A photo of this folder shown on its gallery tile. */
  coverFileId: string | null;
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

/** Omitted fields stay unchanged. Scope/team only for top-level folders (the tree follows). */
export interface FolderPatch {
  name?: string;
  scope?: FolderScope;
  teamId?: string | null;
  color?: FolderColor;
  clearColor?: boolean;
  coverFileId?: string;
  clearCover?: boolean;
}

/** Rename (the extension stays) and/or move to another folder. */
export interface FilePatch {
  name?: string;
  folderId?: string;
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

export const FOLDER_COLORS: readonly { value: FolderColor; label: string; hue: Hue }[] = [
  { value: 'GRAY', label: 'Grau', hue: 'gray' },
  { value: 'BROWN', label: 'Braun', hue: 'brown' },
  { value: 'ORANGE', label: 'Orange', hue: 'orange' },
  { value: 'YELLOW', label: 'Gelb', hue: 'yellow' },
  { value: 'GREEN', label: 'Grün', hue: 'green' },
  { value: 'BLUE', label: 'Blau', hue: 'blue' },
  { value: 'PURPLE', label: 'Lila', hue: 'purple' },
  { value: 'RED', label: 'Rot', hue: 'red' },
];

export const colorHue = (color: FolderColor | null): Hue | null => FOLDER_COLORS.find((c) => c.value === color)?.hue ?? null;
