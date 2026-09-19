import { describe, expect, it } from 'vitest';
import { establishesContainingBlock } from '../../../src/content/pseudo/containing-block.js';

function cs(overrides = {}) {
  return {
    transform: 'none',
    filter: 'none',
    backdropFilter: 'none',
    perspective: 'none',
    contain: 'none',
    willChange: 'auto',
    ...overrides
  };
}

describe('establishesContainingBlock', () => {
  it('is false for a plain, untransformed ancestor', () => {
    expect(establishesContainingBlock(cs())).toBe(false);
  });

  it('is true when transform is set', () => {
    expect(establishesContainingBlock(cs({ transform: 'translateZ(0)' }))).toBe(true);
  });

  it('is true when filter is set', () => {
    expect(establishesContainingBlock(cs({ filter: 'blur(2px)' }))).toBe(true);
  });

  it('is true when backdrop-filter is set', () => {
    expect(establishesContainingBlock(cs({ backdropFilter: 'blur(2px)' }))).toBe(true);
  });

  it('is true when perspective is set', () => {
    expect(establishesContainingBlock(cs({ perspective: '800px' }))).toBe(true);
  });

  it('is true when contain includes layout/paint/strict/content', () => {
    expect(establishesContainingBlock(cs({ contain: 'layout' }))).toBe(true);
    expect(establishesContainingBlock(cs({ contain: 'paint' }))).toBe(true);
    expect(establishesContainingBlock(cs({ contain: 'strict' }))).toBe(true);
    expect(establishesContainingBlock(cs({ contain: 'content' }))).toBe(true);
  });

  it('is false when contain is a value that does not trap fixed descendants', () => {
    expect(establishesContainingBlock(cs({ contain: 'size' }))).toBe(false);
  });

  it('is true when will-change names a trapping property', () => {
    expect(establishesContainingBlock(cs({ willChange: 'transform' }))).toBe(true);
    expect(establishesContainingBlock(cs({ willChange: 'filter' }))).toBe(true);
    expect(establishesContainingBlock(cs({ willChange: 'perspective' }))).toBe(true);
    expect(establishesContainingBlock(cs({ willChange: 'opacity' }))).toBe(true);
  });

  it('is false when will-change names an unrelated property', () => {
    expect(establishesContainingBlock(cs({ willChange: 'scroll-position' }))).toBe(false);
  });
});
