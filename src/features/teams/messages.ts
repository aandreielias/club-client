import { settings } from '../../settings';
import type { MessageCatalog } from '../../lib/errors/ErrorMessages';

export const TEAM_MESSAGES: MessageCatalog = {
  'team.name-invalid': `Teamname mit 1 bis ${settings.teams.nameMaxLength} Zeichen angeben.`,
  'team.season-invalid': 'Saison im Format 2026/27 angeben.',
  'team.player-info-invalid': 'Nummer 0 bis 99, Position bis 40 Zeichen.',
  'team.request-invalid': 'Bitte angeben, wer ins Team soll (bis 500 Zeichen).',
  'team.exists': 'Dieses Team gibt es in der Saison schon.',
  'team.in-use': 'Das Team hat noch Termine, Aufgaben oder Ordner. Diese zuerst verschieben oder löschen.',
};
