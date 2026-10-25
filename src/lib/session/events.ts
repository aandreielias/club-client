// Live event of the club facts (server: platform.club.ClubSettings.ClubChanged).

import { liveEvent } from '../live/LiveUpdates.svelte';
import type { Club } from '../types';

export const CLUB_CHANGED = liveEvent<{ club: Club }>('platform.club-changed');
