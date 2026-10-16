import type { Component } from 'svelte';
import type { Role } from '../types';

export interface HomeSection {
  id: string;
  component: Component;
  /** Only members with one of these roles see it. */
  roles?: readonly Role[];
}

/** Start page sections contributed by features (like CalendarSources), in feature order. */
export class HomeSections {
  readonly #sections: HomeSection[] = [];

  register(section: HomeSection): void {
    if (this.#sections.some((s) => s.id === section.id)) throw new Error(`Home section "${section.id}" registered twice`);
    this.#sections.push(section);
  }

  visible(hasRole: (...roles: readonly Role[]) => boolean): HomeSection[] {
    return this.#sections.filter((s) => !s.roles || hasRole(...s.roles));
  }
}
