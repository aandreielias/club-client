import type { Hue, Role } from '../../lib/types';

// Mirrors of the club-server files DTOs.

/** DOCUMENTS accept documents and images; PHOTOS accept images only. */
export type FolderKind = 'DOCUMENTS' | 'PHOTOS';

/** CLUB: all members. TEAM: the team, guardians of its members, admin and board. BOARD: admin and board. */
/** MEETING: a meeting's own folder (e.g. arbitration), seen by who sees the meeting. COACHES: the COACH role. OFFICE: one office's holders. */
export type FolderScope = 'CLUB' | 'TEAM' | 'BOARD' | 'ASSEMBLY' | 'MEETING' | 'COACHES' | 'OFFICE';

/** Folder colours: the hues of the tags. */
export type FolderColor = 'GRAY' | 'BROWN' | 'ORANGE' | 'YELLOW' | 'GREEN' | 'BLUE' | 'PURPLE' | 'RED';

export interface Folder {
  id: string;
  parentId: string | null;
  name: string;
  kind: FolderKind;
  scope: FolderScope;
  /** TEAM folders: one or more teams; empty otherwise. */
  teamIds: string[];
  /** OFFICE folders: the office key; null otherwise. */
  office: string | null;
  membersCanUpload: boolean;
  color: FolderColor | null;
  /** A photo of this folder shown on its gallery tile. */
  coverFileId: string | null;
  /** Computed by the server for the signed-in member. */
  canUpload: boolean;
  canManage: boolean;
  /** The read-only folder "Einstellungen" with the copies the settings use. */
  system: boolean;
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
  teamIds: string[];
  office: string | null;
  membersCanUpload: boolean;
}

/** Omitted fields stay unchanged. Scope/teams only for top-level folders (the tree follows). */
export interface FolderPatch {
  name?: string;
  scope?: FolderScope;
  teamIds?: string[];
  office?: string | null;
  color?: FolderColor;
  clearColor?: boolean;
  coverFileId?: string;
  clearCover?: boolean;
  membersCanUpload?: boolean;
  /** Move below this folder (takes its visibility). */
  parentId?: string;
  /** Move to the top level. */
  moveToTop?: boolean;
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
  /** Label of the current version; null while there is only the first upload. */
  version: string | null;
  /** A club setting (logo, template) follows this file: only admin and board change it. */
  settingSource: boolean;
}

/** One version of a document (server: FilesApi.VersionDto); newest first in lists. */
export interface FileVersion {
  id: string;
  label: string;
  /** The date the version stands for (ISO date). */
  date: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string | null;
  createdAt: string;
  current: boolean;
}

export interface FileList {
  items: StoredFile[];
}

/** server: FilesApi.FileHits — the name search for pickers. */
export interface FileHits {
  files: { id: string; folderId: string; folderName: string; name: string; contentType: string; sizeBytes: number }[];
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
  {
    value: 'ASSEMBLY',
    label: 'Stimmberechtigte',
    hint: 'Mitglieder mit Stimmrecht, Vorstand und Admins (wie die Mitgliederversammlung).',
  },
  { value: 'COACHES', label: 'Trainer:innen', hint: 'Alle mit der Rolle Trainer:in, Vorstand und Admins.' },
  { value: 'OFFICE', label: 'Amt', hint: 'Wer das gewählte Amt gerade innehat, Vorstand und Admins.' },
  // Made by the meetings module only (e.g. Schlichtungseinrichtung): never offered as a choice.
  { value: 'MEETING', label: 'Sitzung', hint: 'Wer die Sitzung sieht: Eingeladene, wer einberuft, Admins.' },
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

/** server: FileType names — what a club may allow members to upload. */
export type FileTypeName = 'JPEG' | 'PNG' | 'HEIC' | 'SVG' | 'PDF' | 'DOCX' | 'DOTX' | 'XLSX' | 'PPTX';

export const FILE_TYPES: readonly { value: FileTypeName; label: string; hint: string }[] = [
  { value: 'JPEG', label: 'JPEG', hint: 'Fotos (.jpg)' },
  { value: 'PNG', label: 'PNG', hint: 'Bilder, Grafiken' },
  { value: 'HEIC', label: 'HEIC', hint: 'iPhone-Fotos, werden zu JPEG' },
  { value: 'SVG', label: 'SVG', hint: 'Vektorgrafiken, z. B. Logos' },
  { value: 'PDF', label: 'PDF', hint: 'Dokumente' },
  { value: 'DOCX', label: 'Word', hint: '.docx ohne Makros' },
  { value: 'DOTX', label: 'Word-Vorlage', hint: '.dotx, z. B. für Einladung und Protokoll' },
  { value: 'XLSX', label: 'Excel', hint: '.xlsx ohne Makros' },
  { value: 'PPTX', label: 'PowerPoint', hint: '.pptx ohne Makros' },
];

/**
 * server: FilesApi.FileSettings — upload quota of a member who manages no folder (per role, the highest counts; else `quotaMb`), the
 * types members may upload, the longest image side and how many versions a file keeps (0 = all).
 */
export interface FileSettings {
  quotaMb: number;
  roleQuotaMb: Partial<Record<Role, number>>;
  /** FileTypeName values (the server sends plain strings). */
  types: string[];
  maxImageSide: number;
  keepVersions: number;
}

/** What the club settings use a file for (server: FilesApi.SettingSlot). */
export type SettingSlot =
  'LOGO' | 'LOGO_SECONDARY' | 'FAVICON' | 'MAIL_LOGO' | 'DOKUMENT' | 'INVITATION_TEMPLATE' | 'PROTOCOL_TEMPLATE' | 'AUDIT_TEMPLATE';

/** server: DocumentsApi.Field — a placeholder, or a list (`fields`) for {{#Name}}…{{/Name}} blocks. */
export interface DocumentField {
  name: string;
  description: string;
  example: string | null;
  fields: DocumentField[];
}

/** server: DocumentsApi.KindList — the placeholders every document knows (`letterhead`) and those of each kind, the base first. */
export interface DocumentKinds {
  letterhead: DocumentField[];
  items: { slot: SettingSlot; label: string; fields: DocumentField[] }[];
}

/** server: FilesApi.SettingFileDto — the slot's copy in "Einstellungen"; `sourceId` while it follows a file in Dateien. */
export interface SettingFile {
  slot: SettingSlot;
  file: StoredFile;
  sourceId: string | null;
  sourceName: string | null;
  sourceFolderId: string | null;
}

export interface SettingFileList {
  items: SettingFile[];
}
