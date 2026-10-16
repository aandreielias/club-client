import { describe, expect, it } from 'vitest';
import { settings } from '../../settings';
import { Motion } from './Motion.svelte';

describe('Motion', () => {
  it('uses the shared timing and staggers up to the cap', () => {
    const motion = new Motion(settings.motion, () => false);
    expect(motion.ms('base')).toBe(settings.motion.base);
    expect(motion.stagger(2)).toBe(2 * settings.motion.staggerMs);
    expect(motion.stagger(1000)).toBe(settings.motion.staggerMax * settings.motion.staggerMs);
    expect(motion.rise(null as never).duration).toBe(settings.motion.slow);
  });

  it('turns every animation off when the member prefers reduced motion', () => {
    const motion = new Motion(settings.motion, () => true);
    expect(motion.reduced).toBe(true);
    expect(motion.ms('window')).toBe(0);
    expect(motion.stagger(5)).toBe(0);
    expect(motion.pop(null as never).duration).toBe(0);
  });
});
