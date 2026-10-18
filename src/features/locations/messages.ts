import { settings } from '../../settings';
import type { MessageCatalog } from '../../lib/errors/ErrorMessages';

const limits = settings.locations;

export const LOCATION_MESSAGES: MessageCatalog = {
  'location.not-found': 'Diesen Ort gibt es nicht mehr.',
  'location.name-invalid': `Name mit 1 bis ${limits.nameMaxLength} Zeichen angeben.`,
  'location.name-taken': 'Einen Ort mit diesem Namen gibt es schon.',
  'location.street-invalid': `Die Straße hat höchstens ${limits.streetMaxLength} Zeichen.`,
  'location.zip-invalid': `Die PLZ hat höchstens ${limits.zipMaxLength} Zeichen.`,
  'location.city-invalid': `Der Ort hat höchstens ${limits.cityMaxLength} Zeichen.`,
  'location.note-too-long': `Der Hinweis hat höchstens ${limits.noteMaxLength} Zeichen.`,
  'location.coordinates-invalid': 'Breite und Länge zusammen angeben (Breite −90 bis 90, Länge −180 bis 180).',
  'location.address-missing': 'Zuerst eine Adresse eintragen.',
  'location.geocoding-unavailable': 'Die Kartensuche ist gerade nicht erreichbar. Die Koordinaten lassen sich auch von Hand eintragen.',
};
