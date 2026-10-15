import { settings } from '../../settings';
import { LocalStore } from '../storage/LocalStore';

/** Mock data that survives reloads. `MockTable.resetAll()` restores every seed. */
export class MockTable<T> {
  static readonly #store = new LocalStore(`${settings.storage.prefix}mock.`);

  readonly data: T;

  constructor(
    private readonly name: string,
    seed: () => T,
  ) {
    this.data = MockTable.#store.get<T>(name) ?? seed();
  }

  save(): void {
    MockTable.#store.set(this.name, this.data);
  }

  static resetAll(): void {
    MockTable.#store.clear();
  }
}
