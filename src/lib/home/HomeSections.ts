import type { Component } from 'svelte';
import { NavCatalog } from '../navigation/NavCatalog';
import type { Role } from '../types';

export interface HomeSection {
  id: string;
  /** Name in Einstellungen > Startseite. */
  label: string;
  component: Component;
  /** Only members with one of these roles see it. */
  roles?: readonly Role[];
}

/**
 * Start page sections contributed by features (like CalendarSources). The member orders them and
 * switches them off in the settings; by default they follow the feature order.
 */
export class HomeSections {
  readonly #sections: HomeSection[] = [];

  register(section: HomeSection): void {
    if (this.#sections.some((s) => s.id === section.id)) throw new Error(`Home section "${section.id}" registered twice`);
    this.#sections.push(section);
  }

  /** Every section the member may see, in their order (for the settings). */
  ordered(order: readonly string[], hasRole: (...roles: readonly Role[]) => boolean): HomeSection[] {
    const visible = this.#sections.filter((s) => !s.roles || hasRole(...s.roles));
    return NavCatalog.sort(visible.map((s) => ({ ...s, path: s.id })), order);
  }

  /** What the start page shows: ordered, without the switched-off ones. */
  shown(order: readonly string[], hidden: readonly string[], hasRole: (...roles: readonly Role[]) => boolean): HomeSection[] {
    return this.ordered(order, hasRole).filter((s) => !hidden.includes(s.id));
  }
}
