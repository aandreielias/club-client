import { settings } from '../../settings';
import type { MessageCatalog } from '../../lib/errors/ErrorMessages';

const limits = settings.files;

export const FILE_MESSAGES: MessageCatalog = {
  'file.not-a-document': 'Das geht nur mit Dokumenten, nicht mit Bildern.',
  'folder.not-found': 'Ordner nicht gefunden.',
  'folder.name-invalid': `Ordnername mit 1 bis ${limits.folderNameMaxLength} Zeichen angeben.`,
  'folder.kind-or-scope-missing': 'Art und Sichtbarkeit angeben.',
  'folder.team-scope-mismatch': 'Teamordner brauchen ein Team, andere Ordner keines.',
  'folder.too-deep': `Ordner lassen sich höchstens ${limits.maxFolderDepth} Ebenen tief verschachteln.`,
  'folder.not-empty': 'Der Ordner ist nicht leer. Zuerst Dateien und Unterordner löschen.',
  'file.not-found': 'Datei nicht gefunden.',
  'file.type-not-allowed': 'Dieser Dateityp ist hier nicht erlaubt.',
  'file.infected': 'Die Datei enthält Schadsoftware und wurde abgelehnt.',
  'file.uploads-busy': 'Gerade laufen viele Uploads. Bitte gleich nochmal versuchen.',
  'file.tag-not-in-team': 'Markiert werden können nur Mitglieder der Teams dieses Ordners.',
  'file.scan-unavailable': 'Die Virenprüfung ist gerade nicht verfügbar. Bitte später erneut versuchen.',
  'file.busy': 'Der Server verarbeitet gerade viele Bilder. Bitte gleich erneut versuchen.',
  'file.image-too-large': 'Das Bild ist zu groß (höchstens 40 Megapixel).',
  'file.image-unreadable': 'Das Bild konnte nicht gelesen werden.',
  'file.no-thumbnail': 'Für diese Datei gibt es keine Vorschau.',
  'file.tags-invalid': `Nur Fotos lassen sich markieren, höchstens ${limits.maxTags} Personen.`,
  'file.tag-without-consent': 'Eine markierte Person hat keine Foto-Einwilligung.',
  'request.too-large': `Die Datei ist zu groß (höchstens ${Math.floor(limits.maxUploadBytes / 1024 / 1024)} MB).`,
  'file.version-exists': 'Diese Versionsnummer gibt es schon.',
  'file.version-label-invalid': 'Versionsnummer mit 1 bis 20 Zeichen angeben.',
  'file.version-date-missing': 'Bitte ein Datum für die Version angeben.',
  'file.version-not-found': 'Die Version gibt es nicht mehr.',
  'file.version-type-mismatch': 'Die neue Version muss dasselbe Dateiformat haben.',
  'file.versions-documents-only': 'Versionen gibt es nur für Dokumente, nicht für Fotos.',
  'folder.cover-invalid': 'Das Titelbild muss ein Foto aus diesem Ordner sein.',
  'folder.scope-inherited': 'Unterordner übernehmen die Sichtbarkeit ihres obersten Ordners.',
  'folder.move-into-self': 'Ein Ordner kann nicht in sich selbst verschoben werden.',
  'file.quota-exceeded': 'Dein Speicherplatz für Uploads (2 GB) ist voll.',
};
