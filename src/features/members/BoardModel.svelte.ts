import { Action } from '../../lib/state/Action.svelte';
import { Resource } from '../../lib/state/Resource.svelte';
import type { Board, MembersApi, Office } from './MembersApi';

/** The running Vorstand and auditor offices, with ending (admin/board); assigning is the office-assign window. */
export class BoardModel {
  readonly board: Resource<Board>;
  readonly endAction = new Action();

  constructor(private readonly api: MembersApi) {
    this.board = new Resource(() => this.api.board());
  }

  load(): Promise<void> {
    return this.board.load();
  }

  /** The answer is one office; the whole board (and its warnings) is read again. */
  async end(id: string): Promise<Office | null> {
    const office = await this.endAction.attempt(() => this.api.endOffice(id));
    if (office) await this.load();
    return office;
  }
}
