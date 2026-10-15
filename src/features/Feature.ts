import type { Component } from 'svelte';
import type { MessageCatalog } from '../lib/errors/ErrorMessages';
import type { CalendarSource } from '../lib/calendar/CalendarSources';
import type { LinkRule } from '../lib/router/LinkResolver';
import type { WindowContent } from '../lib/window/WindowService.svelte';
import type { RouteParams } from '../lib/router/Router.svelte';
import type { Role } from '../lib/types';

/** Props every routed page receives. */
export interface PageProps {
  params: RouteParams;
}

export type PageComponent = Component<PageProps> | Component<Record<string, never>>;

export interface FeatureRoute {
  /** Hash path pattern, e.g. '/calendar/:id'. Specific paths before parameter paths. */
  path: string;
  component: PageComponent;
  /** Sidebar label; routes without one are reachable by link only. */
  nav?: string;
  /** Only members with one of these roles see and open the route. */
  roles?: readonly Role[];
  /** Shown at the bottom of the sidebar (above "Abmelden") instead of in the reorderable main list. */
  navFooter?: boolean;
  /** Count shown next to the sidebar label (e.g. unread items); read reactively. */
  badge?: () => number;
}

/** A self-contained slice of the website: its routes and error texts. */
export interface Feature {
  readonly id: string;
  readonly routes: readonly FeatureRoute[];
  readonly messages?: MessageCatalog;
  /** Server links (in notifications) this feature can open. */
  readonly links?: readonly LinkRule[];
  /** Detail windows this feature provides, by kind (opened with `windows.open(kind, id)`). */
  readonly windows?: Readonly<Record<string, WindowContent>>;
  /** Entries this feature contributes to the calendar. */
  readonly calendar?: CalendarSource;
  /** Runs while a member is signed in with a complete profile; returns its cleanup. */
  readonly start?: () => (() => void) | void;
}
