import { settings } from '../../settings';
import type { Item, ItemPatch, NewItem } from './model';

export type ItemField = 'name' | 'category' | 'quantity' | 'location' | 'description';

export type ItemFormErrors = Partial<Record<ItemField, string>>;

const limits = settings.inventory;

/** Editable state of a new or existing inventory item; validation mirrors the server's Item. */
export class ItemForm {
  name = $state('');
  category = $state('');
  quantity = $state(1);
  location = $state('');
  description = $state('');
  submitted = $state(false);

  readonly errors: ItemFormErrors;
  readonly valid: boolean;

  private constructor(readonly original: Item | null) {
    this.errors = $derived(this.validate());
    this.valid = $derived(Object.keys(this.errors).length === 0);
  }

  static blank(): ItemForm {
    return new ItemForm(null);
  }

  static edit(item: Item): ItemForm {
    const form = new ItemForm(item);
    form.name = item.name;
    form.category = item.category ?? '';
    form.quantity = item.quantity;
    form.location = item.location ?? '';
    form.description = item.description ?? '';
    return form;
  }

  error(field: ItemField): string | null {
    return this.submitted ? (this.errors[field] ?? null) : null;
  }

  toNew(): NewItem {
    return {
      name: this.name.trim(),
      category: this.category.trim() || null,
      quantity: this.quantity,
      location: this.location.trim() || null,
      description: this.description.trim() || null,
    };
  }

  /** Every field is sent; empty texts clear them on the server. */
  toPatch(): ItemPatch {
    const value = this.toNew();
    return { ...value, category: value.category ?? '', location: value.location ?? '', description: value.description ?? '' };
  }

  private validate(): ItemFormErrors {
    const errors: ItemFormErrors = {};
    const name = this.name.trim();
    if (!name || name.length > limits.nameMaxLength) errors.name = `Name mit 1 bis ${limits.nameMaxLength} Zeichen angeben.`;
    if (this.category.trim().length > limits.categoryMaxLength) errors.category = `Höchstens ${limits.categoryMaxLength} Zeichen.`;
    if (this.location.trim().length > limits.locationMaxLength) errors.location = `Höchstens ${limits.locationMaxLength} Zeichen.`;
    if (this.description.trim().length > limits.descriptionMaxLength) errors.description = `Höchstens ${limits.descriptionMaxLength} Zeichen.`;
    if (!Number.isInteger(this.quantity) || this.quantity < 0 || this.quantity > limits.maxQuantity) {
      errors.quantity = `Bestand von 0 bis ${limits.maxQuantity} angeben.`;
    }
    return errors;
  }
}
