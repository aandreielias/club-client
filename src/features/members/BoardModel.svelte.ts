import { Action } from '../../lib/state/Action.svelte';
import { Resource } from '../../lib/state/Resource.svelte';
import type { Board, MembersApi, NewOffice, Office } from './MembersApi';

/** The running Vorstand and auditor offices, with assigning and ending (admin/board). */
export class BoardModel {
  readonly board: Resource<Board>;
  readonly assignAction = new Action();
  readonly endAction = new Action();

  constructor(private readonly api: MembersApi) {
    this.board = new Resource(() => this.api.board());
  }

  load(): Promise<void> {
    return this.board.load();
  }

  /** The answer of a write is one office; the whole board (and its warnings) is read again. */
  assign(office: NewOffice): Promise<Office | null> {
    return this.write(this.assignAction, () => this.api.assignOffice(office));
  }

  end(id: string): Promise<Office | null> {
    return this.write(this.endAction, () => this.api.endOffice(id));
  }

  private async write(action: Action, request: () => Promise<Office>): Promise<Office | null> {
    const office = await action.attempt(request);
    if (office) await this.load();
    return office;
  }
}
