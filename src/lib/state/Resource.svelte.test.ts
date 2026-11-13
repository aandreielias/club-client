import { describe, expect, it } from 'vitest';
import { Resource } from './Resource.svelte';

describe('Resource', () => {
  it('runs one trailing reload for loads during a request, and every load waits for it', async () => {
    const answers: ((value: number) => void)[] = [];
    const resource = new Resource(() => new Promise<number>((resolve) => answers.push(resolve)));
    const first = resource.load();
    const second = resource.load();
    const third = resource.load();
    expect(answers).toHaveLength(1);
    let firstDone = false;
    void first.then(() => (firstDone = true));
    answers[0](1);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(answers).toHaveLength(2); // one trailing request for both later loads
    expect(firstDone).toBe(false);
    answers[1](2);
    await Promise.all([first, second, third]);
    expect(resource.value).toBe(2);
    expect(answers).toHaveLength(2);
  });

  it('keeps a value set meanwhile over the answer of the running request', async () => {
    const answers: ((value: number) => void)[] = [];
    const resource = new Resource(() => new Promise<number>((resolve) => answers.push(resolve)));
    const load = resource.load();
    resource.set(5);
    answers[0](1);
    await load;
    expect(resource.value).toBe(5);
  });
});
