import { describe, expect, it } from 'vitest';
import { classifyWindow } from '../../src/shared/snap.js';

// Screen 1920×1080 with a 48px taskbar → availHeight 1032, unless noted.
const SCREEN_1080 = { availWidth: 1920, availHeight: 1032, availLeft: 0, availTop: 0 };

describe('classifyWindow', () => {
  it('classifies a maximized window', () => {
    const result = classifyWindow({ ...SCREEN_1080, outerWidth: 1920, outerHeight: 1032, screenX: 0, screenY: 0 });
    expect(result.layout).toBe('maximized');
    expect(result.coversDisplay).toBe(true);
  });

  it('classifies a window snapped to the left half', () => {
    const result = classifyWindow({ ...SCREEN_1080, outerWidth: 960, outerHeight: 1032, screenX: 0, screenY: 0 });
    expect(result.layout).toBe('half-left');
    expect(result.coversDisplay).toBe(false);
  });

  it('classifies a window snapped to the right half', () => {
    const result = classifyWindow({ ...SCREEN_1080, outerWidth: 960, outerHeight: 1032, screenX: 960, screenY: 0 });
    expect(result.layout).toBe('half-right');
  });

  it('classifies a right-half snap under 125% DPI scaling (fractional ratios)', () => {
    const screen = { availWidth: 1536, availHeight: 826, availLeft: 0, availTop: 0 };
    const result = classifyWindow({ ...screen, outerWidth: 768, outerHeight: 826, screenX: 768, screenY: 0 });
    expect(result.layout).toBe('half-right');
  });

  it('classifies a left-half snap with invisible resize borders', () => {
    const result = classifyWindow({ ...SCREEN_1080, outerWidth: 967, outerHeight: 1039, screenX: -7, screenY: 0 });
    expect(result.layout).toBe('half-left');
  });

  it('classifies a top-left quarter tile', () => {
    const result = classifyWindow({ ...SCREEN_1080, outerWidth: 960, outerHeight: 516, screenX: 0, screenY: 0 });
    expect(result.layout).toBe('quarter');
  });

  it('classifies a window snapped to the top half', () => {
    const result = classifyWindow({ ...SCREEN_1080, outerWidth: 1920, outerHeight: 516, screenX: 0, screenY: 0 });
    expect(result.layout).toBe('half-top');
  });

  it('classifies a small floating window', () => {
    const result = classifyWindow({ ...SCREEN_1080, outerWidth: 1200, outerHeight: 800, screenX: 300, screenY: 100 });
    expect(result.layout).toBe('floating');
  });

  it('classifies a near-maximized window within tolerance as maximized', () => {
    const result = classifyWindow({ ...SCREEN_1080, outerWidth: 1824, outerHeight: 980, screenX: 48, screenY: 26 });
    expect(result.layout).toBe('maximized');
  });

  it('returns the width/height ratios it computed the layout from', () => {
    const result = classifyWindow({ ...SCREEN_1080, outerWidth: 960, outerHeight: 1032, screenX: 0, screenY: 0 });
    expect(result.wRatio).toBeCloseTo(0.5);
    expect(result.hRatio).toBeCloseTo(1);
  });
});
