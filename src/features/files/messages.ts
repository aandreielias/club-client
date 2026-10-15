import { settings } from '../../settings';
import type { MessageCatalog } from '../../lib/errors/ErrorMessages';

const limits = settings.files;

export const FILE_MESSAGES: MessageCatalog = {
  'folder.not-found': 'Ordner nicht gefunden.',
  'folder.name-invalid': `Ordnername mit 1 bis ${limits.folderNameMaxLength} Zeichen angeben.`,
  'folder.kind-or-scope-missing': 'Art und Sichtbarkeit angeben.',
  'folder.team-scope-mismatch': 'Teamordner brauchen ein Team, andere Ordner keines.',
  'folder.too-deep': `Ordner lassen sich höchstens ${limits.maxFolderDepth} Ebenen tief verschachteln.`,
  'folder.not-empty': 'Der Ordner ist nicht leer. Zuerst Dateien und Unterordner löschen.',
  'file.not-found': 'Datei nicht gefunden.',
  'file.type-not-allowed': 'Dieser Dateityp ist hier nicht erlaubt.',
  'file.infected': 'Die Datei enthält Schadsoftware und wurde abgelehnt.',
  'file.scan-unavailable': 'Die Virenprüfung ist gerade nicht verfügbar. Bitte später erneut versuchen.',
  'file.busy': 'Der Server verarbeitet gerade viele Bilder. Bitte gleich erneut versuchen.',
  'file.image-too-large': 'Das Bild ist zu groß (höchstens 40 Megapixel).',
  'file.image-unreadable': 'Das Bild konnte nicht gelesen werden.',
  'file.no-thumbnail': 'Für diese Datei gibt es keine Vorschau.',
  'file.tags-invalid': `Nur Fotos lassen sich markieren, höchstens ${limits.maxTags} Personen.`,
  'file.tag-without-consent': 'Eine markierte Person hat keine Foto-Einwilligung.',
  'request.too-large': `Die Datei ist zu groß (höchstens ${Math.floor(limits.maxUploadBytes / 1024 / 1024)} MB).`,
};
