// Live event of the finance module (server: FinanceApi.FinanceChanged).

import { liveEvent } from '../../lib/live/LiveUpdates.svelte';

export const FINANCE_CHANGED = liveEvent<FinanceChanged>('finance.finance-changed');

export interface FinanceChanged {
  /** null when accounts or categories changed */
  bookingId: string | null;
}
