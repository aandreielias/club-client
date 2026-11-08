import { describe, expect, it } from 'vitest';
import { Resource } from './Resource.svelte';

describe('Resource', () => {
  it('lets an earlier load resolve only once the newer one has set the value', async () => {
    const answers: ((value: number) => void)[] = [];
    const resource = new Resource(() => new Promise<number>((resolve) => answers.push(resolve)));
    const first = resource.load();
    const second = resource.load();
    answers[0](1); // the older answer arrives first and must not be written
    let firstDone = false;
    void first.then(() => (firstDone = true));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(firstDone).toBe(false);
    answers[1](2);
    await first;
    expect(resource.value).toBe(2);
    await second;
  });
});
