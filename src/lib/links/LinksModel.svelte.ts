import { settings } from '../../settings';
import { Action } from '../state/Action.svelte';
import { Resource } from '../state/Resource.svelte';
import type { LinksApi } from './LinksApi';
import type { FileOption, FileRef, ItemOption, Links, Need } from './model';

/**
 * "Benötigt" list and attachments of one appointment or task: the saved state plus an edit draft.
 * Deleted entries stay in the draft until removed; the server keeps them, but refuses adding them anew.
 */
export class LinksModel {
  readonly links: Resource<Links>;
  /** Inventory for the item picker, loaded when editing starts. */
  readonly items: Resource<ItemOption[]>;
  readonly save = new Action();

  editing = $state(false);
  #found: FileOption[] = [];
  needs = $state<Need[]>([]);
  files = $state<FileRef[]>([]);

  readonly itemChoices: ItemOption[];
  readonly valid: boolean;

  /** `owner` is the resource path, e.g. `/api/v1/appointments/a-1`. */
  constructor(
    private readonly api: LinksApi,
    readonly owner: string,
  ) {
    this.links = new Resource(() => this.api.get(this.owner));
    this.items = new Resource(() => this.api.items());
    this.itemChoices = $derived((this.items.value ?? []).filter((o) => !this.needs.some((n) => n.itemId === o.id)));
    this.valid = $derived(this.needs.every((n) => LinksModel.quantityError(n.quantity) === null));
  }

  load(): Promise<void> {
    return this.links.load();
  }

  get isEmpty(): boolean {
    const links = this.links.value;
    return !links || (links.needs.length === 0 && links.files.length === 0);
  }

  edit(): void {
    const links = this.links.value ?? { needs: [], files: [] };
    this.needs = links.needs.map((n) => ({ ...n }));
    this.files = links.files.map((f) => ({ ...f }));
    this.save.reset();
    this.editing = true;
    void this.items.load();
  }

  cancel(): void {
    this.editing = false;
  }

  addItem(itemId: string, quantity = 1): void {
    const option = this.items.value?.find((o) => o.id === itemId);
    if (!option || this.needs.some((n) => n.itemId === itemId)) return;
    this.needs.push({ itemId, name: option.name, quantity, stock: option.stock, deleted: false });
  }

  removeItem(itemId: string): void {
    this.needs = this.needs.filter((n) => n.itemId !== itemId);
  }

  /** Item picker: inventory entries not listed yet whose label contains the query. */
  findItems(query: string): ItemOption[] {
    const q = query.trim().toLocaleLowerCase();
    return this.itemChoices.filter((o) => o.label.toLocaleLowerCase().includes(q));
  }

  /** File picker: visible files not attached yet whose name contains the query (server search). */
  async findFiles(query: string): Promise<FileOption[]> {
    const hits = await this.api.files(query, settings.links.fileResults);
    this.#found = hits;
    return hits.filter((h) => !this.files.some((f) => f.id === h.id));
  }

  addFile(fileId: string): void {
    const option = this.#found.find((o) => o.id === fileId);
    if (option && !this.files.some((f) => f.id === fileId)) this.files.push({ ...option.file });
  }

  removeFile(fileId: string): void {
    this.files = this.files.filter((f) => f.id !== fileId);
  }

  async commit(): Promise<boolean> {
    if (!this.valid) return false;
    let saved: Links | null = null;
    const ok = await this.save.run(async () => {
      saved = await this.api.set(
        this.owner,
        this.needs.map((n) => ({ itemId: n.itemId, quantity: n.quantity })),
        this.files.map((f) => f.id),
      );
    });
    if (saved) this.links.set(saved);
    if (ok) this.editing = false;
    return ok;
  }

  downloadUrl(file: FileRef): Promise<string> {
    return this.api.downloadUrl(file.id);
  }

  static quantityError(quantity: number): string | null {
    const max = settings.links.maxQuantity;
    return Number.isInteger(quantity) && quantity >= 1 && quantity <= max ? null : `1 bis ${max}`;
  }

  /** More needed than the inventory holds. */
  static short(need: Need): boolean {
    return !need.deleted && need.stock !== null && need.quantity > need.stock;
  }
}
