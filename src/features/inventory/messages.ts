import { settings } from '../../settings';
import type { MessageCatalog } from '../../lib/errors/ErrorMessages';

const limits = settings.inventory;

export const INVENTORY_MESSAGES: MessageCatalog = {
  'inventory.not-found': 'Gegenstand nicht gefunden.',
  'inventory.name-invalid': `Name mit 1 bis ${limits.nameMaxLength} Zeichen angeben.`,
  'inventory.category-invalid': `Die Kategorie hat höchstens ${limits.categoryMaxLength} Zeichen.`,
  'inventory.location-invalid': `Der Ort hat höchstens ${limits.locationMaxLength} Zeichen.`,
  'inventory.description-too-long': `Die Beschreibung hat höchstens ${limits.descriptionMaxLength} Zeichen.`,
  'inventory.quantity-invalid': `Bestand von 0 bis ${limits.maxQuantity} angeben.`,
};
