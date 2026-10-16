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
  /** On the start page until the member switches it off; others start switched off. */
  defaultShown?: boolean;
}

/**
 * Start page sections contributed by features (like CalendarSources). The member orders them and
 * switches them on or off in the settings; by default they follow the feature order and only
 * sections marked `defaultShown` are on.
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

  /** What the start page shows: ordered, switched on by the member or by default. */
  shown(order: readonly string[], toggles: Readonly<Record<string, boolean>>, hasRole: (...roles: readonly Role[]) => boolean): HomeSection[] {
    return this.ordered(order, hasRole).filter((s) => HomeSections.isShown(s, toggles));
  }

  static isShown(section: HomeSection, toggles: Readonly<Record<string, boolean>>): boolean {
    return toggles[section.id] ?? section.defaultShown ?? false;
  }
}
