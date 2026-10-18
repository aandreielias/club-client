import type { Hue, Role } from '../../lib/types';

const ROLE_HUES: Readonly<Record<Role, Hue>> = {
  ADMIN: 'red',
  BOARD: 'purple',
  COACH: 'blue',
  PLAYER: 'green',
  PARENT: 'orange',
  VOLUNTEER: 'brown',
  GUEST: 'gray',
};

/** Tag colour of a club role. */
export const roleHue = (role: Role): Hue => ROLE_HUES[role];
