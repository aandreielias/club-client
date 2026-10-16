import { getContext, setContext } from 'svelte';
import type { WindowHandle } from '../lib/window/WindowService.svelte';

const KEY = Symbol('window-handle');

/** WindowHost provides its handle, so links inside window content open records with a way back. */
export function provideWindowHandle(handle: WindowHandle): void {
  setContext(KEY, handle);
}

export function windowHandle(): WindowHandle | undefined {
  return getContext<WindowHandle | undefined>(KEY);
}

