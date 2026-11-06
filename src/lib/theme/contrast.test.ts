import { describe, expect, it } from 'vitest';
import { contrast, mix, readableOn, textOn } from './contrast';

describe('contrast', () => {
  it('measures WCAG ratios', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21);
    expect(contrast('#ffffff', '#ffffff')).toBeCloseTo(1);
    // brand guide: gold text #8A6A1F reads 5:1 on white
    expect(contrast('#8A6A1F', '#FFFFFF')).toBeGreaterThan(4.5);
  });

  it('mixes colours', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#57263C', '#ffffff', 0)).toBe('#57263c');
  });

  it('lightens a dark brand colour until it reads on a dark page', () => {
    const wine = readableOn('#57263C', '#0f1013');
    expect(contrast(wine, '#0f1013')).toBeGreaterThanOrEqual(4.5);
    expect(readableOn('#ffffff', '#0f1013')).toBe('#ffffff');
  });

  it('picks white or ink on a filled colour', () => {
    expect(textOn('#57263C', '#1E1A1D')).toBe('#ffffff');
    expect(textOn('#F5D04A', '#1E1A1D')).toBe('#1E1A1D');
  });
});
