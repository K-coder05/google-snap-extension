// Reads the live window/screen geometry classifyWindow() expects (SPEC.md
// §4.2). Shared by the Bridge (status readout) and the Hook's fullscreen
// shim (mode resolution) — both worlds see the same browser-provided
// window/screen values, so there is one reader instead of two copies.

/**
 * @returns {import('./snap.js').Geometry}
 */
export function readWindowGeometry() {
  return {
    availWidth: screen.availWidth,
    availHeight: screen.availHeight,
    availLeft: screen.availLeft ?? 0,
    availTop: screen.availTop ?? 0,
    outerWidth: window.outerWidth,
    outerHeight: window.outerHeight,
    screenX: window.screenX,
    screenY: window.screenY
  };
}
