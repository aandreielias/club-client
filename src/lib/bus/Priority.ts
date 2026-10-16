/** Order in which subscribers of one event run: higher first, same priority in subscription order. */
export const Priority = {
  HIGHEST: 100,
  HIGH: 75,
  NORMAL: 50,
  LOW: 25,
  /** Observers (logging, history) that must see the event after everyone else. */
  MONITOR: 0,
} as const;

export type Priority = (typeof Priority)[keyof typeof Priority];
