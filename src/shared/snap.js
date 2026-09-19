// Pure window/screen geometry classifier — no DOM, no globals. See CONTEXT.md
// for Layout's definition and SPEC.md §4.2 for the algorithm this implements.

// Windows snaps a window to exactly half the work area, but Chrome reports
// outerWidth/outerHeight in CSS pixels (post devicePixelRatio division), and
// Windows reserves a few pixels of invisible resize border on non-maximized
// windows. Ratio bands absorb both sources of slop that pixel equality can't.
const FULL_MIN = 0.94;
const HALF_LO = 0.38;
const HALF_HI = 0.62;

/**
 * @typedef {Object} Geometry
 * @property {number} availWidth   screen.availWidth
 * @property {number} availHeight  screen.availHeight
 * @property {number} availLeft    screen.availLeft (0 on a single monitor)
 * @property {number} availTop     screen.availTop
 * @property {number} outerWidth   window.outerWidth
 * @property {number} outerHeight  window.outerHeight
 * @property {number} screenX      window.screenX
 * @property {number} screenY      window.screenY
 */

/**
 * @typedef {'maximized'|'half-left'|'half-right'|'half-top'|'half-bottom'|'quarter'|'floating'} Layout
 */

export const LAYOUT = Object.freeze({
  MAXIMIZED: 'maximized',
  HALF_LEFT: 'half-left',
  HALF_RIGHT: 'half-right',
  HALF_TOP: 'half-top',
  HALF_BOTTOM: 'half-bottom',
  QUARTER: 'quarter',
  FLOATING: 'floating'
});

/**
 * @param {Geometry} geometry
 * @returns {{ layout: Layout, wRatio: number, hRatio: number, coversDisplay: boolean }}
 */
export function classifyWindow(geometry) {
  const { availWidth, availHeight, availLeft, availTop, outerWidth, outerHeight, screenX, screenY } = geometry;

  const wRatio = outerWidth / availWidth;
  const hRatio = outerHeight / availHeight;

  const isFullW = wRatio >= FULL_MIN;
  const isFullH = hRatio >= FULL_MIN;
  const isHalfW = wRatio >= HALF_LO && wRatio <= HALF_HI;
  const isHalfH = hRatio >= HALF_LO && hRatio <= HALF_HI;

  const midX = availLeft + availWidth / 2;
  const midY = availTop + availHeight / 2;
  const centerX = screenX + outerWidth / 2;
  const centerY = screenY + outerHeight / 2;

  let layout;
  if (isFullW && isFullH) {
    layout = LAYOUT.MAXIMIZED;
  } else if (isHalfW && isHalfH) {
    layout = LAYOUT.QUARTER;
  } else if (isHalfW && isFullH) {
    layout = centerX < midX ? LAYOUT.HALF_LEFT : LAYOUT.HALF_RIGHT;
  } else if (isFullW && isHalfH) {
    layout = centerY < midY ? LAYOUT.HALF_TOP : LAYOUT.HALF_BOTTOM;
  } else {
    layout = LAYOUT.FLOATING;
  }

  return { layout, wRatio, hRatio, coversDisplay: layout === LAYOUT.MAXIMIZED };
}
