import { settings } from '../../settings';
import { Action } from '../state/Action.svelte';
import { Resource } from '../state/Resource.svelte';
import type { LinksApi } from './LinksApi';
import type { FileOption, FileRef, ItemOption, Links, Need } from './model';

interface Options {
  items: ItemOption[];
  files: FileOption[];
}

/**
 * "Benötigt" list and attachments of one appointment or task: the saved state plus an edit draft.
 * Deleted entries stay in the draft until removed; the server keeps them, but refuses adding them anew.
 */
export class LinksModel {
  readonly links: Resource<Links>;
  readonly options: Resource<Options>;
  readonly save = new Action();

  editing = $state(false);
  needs = $state<Need[]>([]);
  files = $state<FileRef[]>([]);

  readonly itemChoices: ItemOption[];
  readonly fileChoices: FileOption[];
  readonly valid: boolean;

  /** `owner` is the resource path, e.g. `/api/v1/appointments/a-1`. */
  constructor(
    private readonly api: LinksApi,
    readonly owner: string,
  ) {
    this.links = new Resource(() => this.api.get(this.owner));
    this.options = new Resource(async () => {
      const [items, files] = await Promise.all([this.api.items(), this.api.files()]);
      return { items, files };
    });
    this.itemChoices = $derived((this.options.value?.items ?? []).filter((o) => !this.needs.some((n) => n.itemId === o.id)));
    this.fileChoices = $derived((this.options.value?.files ?? []).filter((o) => !this.files.some((f) => f.id === o.id)));
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
    void this.options.load();
  }

  cancel(): void {
    this.editing = false;
  }

  addItem(itemId: string, quantity = 1): void {
    const option = this.options.value?.items.find((o) => o.id === itemId);
    if (!option || this.needs.some((n) => n.itemId === itemId)) return;
    this.needs.push({ itemId, name: option.name, quantity, stock: option.stock, deleted: false });
  }

  removeItem(itemId: string): void {
    this.needs = this.needs.filter((n) => n.itemId !== itemId);
  }

  addFile(fileId: string): void {
    const option = this.options.value?.files.find((o) => o.id === fileId);
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
