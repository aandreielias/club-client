import { settings } from '../../settings';
import type { MessageCatalog } from '../errors/ErrorMessages';

const limits = settings.links;

/** server: platform.LinkResolver */
export const LINK_MESSAGES: MessageCatalog = {
  'links.too-many': `Höchstens ${limits.maxEntries} Gegenstände und ${limits.maxEntries} Dateien.`,
  'links.quantity-invalid': `Menge von 1 bis ${limits.maxQuantity} angeben.`,
  'links.duplicate': 'Ein Eintrag steht doppelt in der Liste.',
  'links.item-unknown': 'Ein Gegenstand ist nicht (mehr) im Inventar.',
  'links.file-unknown': 'Eine Datei existiert nicht (mehr) oder ist nicht sichtbar.',
};
