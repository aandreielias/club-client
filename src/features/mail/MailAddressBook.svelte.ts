import type { SelectOption } from '../../ui/Select.svelte';
import { MailForm } from './MailForm.svelte';
import type { AddressEntry } from './model';

const MAX_HITS = 8;

/** Where suggestions come from: the club's addresses, the teams and their rosters (member ids). */
export interface AddressSources {
  entries: () => Promise<readonly AddressEntry[]>;
  teams: () => Promise<readonly { id: string; name: string }[]>;
  members: (teamId: string) => Promise<readonly string[]>;
}

/**
 * Recipient suggestions while typing: what was typed (when it is an address), club addresses by name or address, and teams,
 * which add the club addresses of their members. Loaded once per composer.
 */
export class MailAddressBook {
  #entries: readonly AddressEntry[] = [];
  #teams: readonly { id: string; name: string }[] = [];
  #loaded: Promise<void> | null = null;

  constructor(private readonly sources: AddressSources) {}

  load(): Promise<void> {
    return (this.#loaded ??= Promise.all([this.sources.entries(), this.sources.teams()]).then(([entries, teams]) => {
      this.#entries = entries;
      this.#teams = teams;
    }));
  }

  /** Options for `query`; addresses already chosen are left out. Values: an address, several separated by commas, or `team:<id>`. */
  async suggest(query: string, chosen: readonly string[]): Promise<SelectOption[]> {
    await this.load();
    const text = query.trim().toLowerCase();
    if (!text) return [];
    const typed = MailForm.addresses(text).filter((a) => !chosen.includes(a));
    const options: SelectOption[] = [];
    if (typed.length > 1) options.push({ value: typed.join(','), label: `${typed.length} Adressen übernehmen` });
    else if (typed.length === 1 && MailForm.valid(typed[0]) && !this.#entries.some((e) => e.address === typed[0]))
      options.push({ value: typed[0], label: `${typed[0]} übernehmen` });
    for (const entry of this.#entries) {
      if (options.length >= MAX_HITS) break;
      if (chosen.includes(entry.address)) continue;
      if (entry.name.toLowerCase().includes(text) || entry.address.includes(text))
        options.push({ value: entry.address, label: `${entry.name} <${entry.address}>` });
    }
    for (const team of this.#teams) {
      if (options.length >= MAX_HITS) break;
      if (team.name.toLowerCase().includes(text)) options.push({ value: `team:${team.id}`, label: `Team ${team.name} (alle mit Vereins-Adresse)` });
    }
    return options;
  }

  /** The addresses a picked option stands for. */
  async resolve(value: string): Promise<string[]> {
    if (!value.startsWith('team:')) return MailForm.addresses(value);
    await this.load();
    const members = new Set(await this.sources.members(value.slice('team:'.length)));
    return this.#entries.filter((e) => e.memberId && members.has(e.memberId)).map((e) => e.address);
  }
}
