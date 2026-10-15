import { settings } from '../../settings';
import type { MessageCatalog } from '../../lib/errors/ErrorMessages';

export const TEAM_MESSAGES: MessageCatalog = {
  'team.name-invalid': `Teamname mit 1 bis ${settings.teams.nameMaxLength} Zeichen angeben.`,
  'team.season-invalid': 'Saison im Format 2026/27 angeben.',
  'team.exists': 'Dieses Team gibt es in der Saison schon.',
};
