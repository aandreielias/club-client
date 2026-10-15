import { Action } from '../../lib/state/Action.svelte';
import type { CalendarApi } from './CalendarApi';

/**
 * The personal iCal subscription. The server shows the secret URL only when it is created, so the
 * model knows a URL only right after `create`; creating again rotates it (the old one stops working).
 */
export class IcalFeedModel {
  url = $state<string | null>(null);
  revoked = $state(false);
  readonly createAction = new Action();
  readonly revokeAction = new Action();

  constructor(private readonly api: CalendarApi) {}

  async create(): Promise<boolean> {
    return this.createAction.run(async () => {
      this.url = await this.api.issueFeed();
      this.revoked = false;
    });
  }

  async revoke(): Promise<boolean> {
    return this.revokeAction.run(async () => {
      await this.api.revokeFeed();
      this.url = null;
      this.revoked = true;
    });
  }
}
