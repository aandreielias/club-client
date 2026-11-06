import { settings } from '../../settings';
import { LocalStore } from '../storage/LocalStore';

/**
 * Mock data that survives reloads. `MockTable.resetAll()` restores every seed. Data stored under another `VERSION` is dropped,
 * so a changed stored shape or seed needs no upgrade code: bump the version instead.
 */
export class MockTable<T> {
  static readonly VERSION = 4;
  static readonly #store = new LocalStore(`${settings.storage.prefix}mock.`);

  static {
    if (MockTable.#store.get<number>('version') !== MockTable.VERSION) {
      MockTable.#store.clear();
      MockTable.#store.set('version', MockTable.VERSION);
    }
  }

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
    MockTable.#store.set('version', MockTable.VERSION);
  }
}
