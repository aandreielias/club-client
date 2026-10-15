import { settings } from '../../settings';
import type { MessageCatalog } from '../../lib/errors/ErrorMessages';

export const SEARCH_MESSAGES: MessageCatalog = {
  'search.query-invalid': `Suchbegriff mit ${settings.search.minQueryLength} bis ${settings.search.maxQueryLength} Zeichen eingeben.`,
};
