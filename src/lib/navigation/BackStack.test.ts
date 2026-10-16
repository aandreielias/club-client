import { describe, expect, it } from 'vitest';
import { BackStack } from './BackStack.svelte';

describe('BackStack', () => {
  it('runs the newest step; steps leave only when their owner removes them', () => {
    const stack = new BackStack();
    const calls: string[] = [];
    const removeEdit = stack.push(() => calls.push('edit'));
    const removePanel = stack.push(() => calls.push('panel'));
    expect(stack.depth).toBe(2);
    expect(stack.back()).toBe(true);
    expect(stack.back()).toBe(true); // the panel declined to close: still the newest step
    removePanel();
    removePanel(); // idempotent
    expect(stack.back()).toBe(true);
    removeEdit();
    expect(stack.back()).toBe(false);
    expect(calls).toEqual(['panel', 'panel', 'edit']);
    expect(stack.depth).toBe(0);
  });

  it('asks the steps before everything goes away', async () => {
    const stack = new BackStack();
    expect(stack.mayLeave()).toBe(true);
    stack.push({ back: () => {}, leave: () => Promise.resolve(false) });
    await expect(stack.mayLeave()).resolves.toBe(false);
  });
});
