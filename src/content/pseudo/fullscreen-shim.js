// Fullscreen API shim (MAIN world) — SPEC.md §5. Patches
// Element.prototype.requestFullscreen and its legacy/webkit equivalents so a
// page's own fullscreen calls route through Snapfit's resolved Mode instead
// of always invoking the real Fullscreen API.
import { MODE, MODE_ATTR } from '../../shared/constants.js';
import { readWindowGeometry } from '../../shared/geometry.js';
import { classifyWindow } from '../../shared/snap.js';
import { enterPseudo, exitPseudo, isPseudoActive, pseudoElement } from './pseudo-fullscreen.js';

// Several players feature-detect the Fullscreen API by stringifying it.
// Spoofing keeps patched functions indistinguishable from native ones;
// gated behind a constant so it can be disabled if it ever causes trouble
// (SPEC.md §5.1).
const SPOOF_TO_STRING = true;
const NATIVE_TO_STRING = Function.prototype.toString;
const spoofedSources = new WeakMap();

if (SPOOF_TO_STRING) {
  Function.prototype.toString = function toString() {
    return NATIVE_TO_STRING.call(spoofedSources.get(this) ?? this);
  };
}

function spoof(patched, original) {
  Object.defineProperty(patched, 'name', { value: original.name, configurable: true });
  Object.defineProperty(patched, 'length', { value: original.length, configurable: true });
  if (SPOOF_TO_STRING) spoofedSources.set(patched, original);
  return patched;
}

// requestFullscreen() requires transient user activation, which is consumed
// and expires the moment anything awaits — a storage read, a postMessage
// round-trip, even a bare microtask chain. The mode must therefore be
// readable synchronously at call time: the Bridge publishes it onto the DOM
// (MODE_ATTR) instead of this module reading chrome.storage directly
// (SPEC.md §5.2).
export function resolveMode() {
  if (window !== window.top) return MODE.DISPLAY; // no cross-frame escalation yet (SPEC.md §9)

  const raw = document.documentElement?.getAttribute(MODE_ATTR) || MODE.AUTO;
  if (raw === MODE.WINDOW || raw === MODE.DISPLAY) return raw;

  const { layout } = classifyWindow(readWindowGeometry());
  return layout === 'maximized' ? MODE.DISPLAY : MODE.WINDOW;
}

// `display` must invoke the native method as the first synchronous action
// (§5.2, no `await` before it). Any unexpected error entering pseudo falls
// back to native rather than leaving the page worse than stock Chrome
// (§5.3) — a broken video is a bug report; one that behaves like stock
// Chrome is not.
function patchRequestFullscreen(native) {
  return spoof(function requestFullscreen(options) {
    if (resolveMode() === MODE.DISPLAY) return native.call(this, options);
    try {
      enterPseudo(this);
      return Promise.resolve();
    } catch {
      return native.call(this, options);
    }
  }, native);
}

// Same routing as requestFullscreen, but returns undefined like the native
// legacy/webkit forms rather than a Promise (SPEC.md §5.1).
function patchLegacyRequest(native) {
  return spoof(function (options) {
    if (resolveMode() === MODE.DISPLAY) {
      native.call(this, options);
      return;
    }
    try {
      enterPseudo(this);
    } catch {
      native.call(this, options);
    }
  }, native);
}

function patchExitFullscreen(native) {
  return spoof(function exitFullscreen() {
    if (isPseudoActive()) {
      exitPseudo();
      return Promise.resolve();
    }
    return native.call(this);
  }, native);
}

function patchWebkitExitFullscreen(native) {
  return spoof(function webkitExitFullscreen() {
    if (isPseudoActive()) {
      exitPseudo();
      return;
    }
    return native.call(this);
  }, native);
}

// Wraps a fullscreenElement-shaped getter to report the pseudo element (or
// `getPseudoValue()`'s result) while active, delegating to the native
// getter otherwise.
function patchGetter(descriptor, getPseudoValue) {
  return {
    ...descriptor,
    get() {
      if (isPseudoActive()) return getPseudoValue();
      return descriptor.get.call(this);
    }
  };
}

// SPEC.md §5.1 says to "bail out of patching entirely" if a capture is
// undefined. Read literally that would disable the whole shim on real
// desktop Chrome, since `webkitEnterFullscreen` (Safari/iOS-only) is never
// present there — defeating the extension's actual purpose. Deviation,
// deliberate: skip only the missing member, keep patching the rest. Also
// covers genuine future-proofing (a future Chrome dropping a webkit-
// prefixed alias) without an all-or-nothing failure mode.
function patchMethod(proto, prop, makePatched) {
  const native = proto?.[prop];
  if (typeof native !== 'function') return;
  proto[prop] = makePatched(native);
}

function patchAccessor(proto, prop, getPseudoValue) {
  const descriptor = Object.getOwnPropertyDescriptor(proto, prop);
  if (!descriptor || typeof descriptor.get !== 'function') return;
  Object.defineProperty(proto, prop, patchGetter(descriptor, getPseudoValue));
}

export function installFullscreenShim() {
  patchMethod(Element.prototype, 'requestFullscreen', patchRequestFullscreen);
  patchMethod(Element.prototype, 'webkitRequestFullscreen', patchLegacyRequest);
  patchMethod(Element.prototype, 'webkitRequestFullScreen', patchLegacyRequest);
  patchMethod(HTMLVideoElement.prototype, 'webkitEnterFullscreen', patchLegacyRequest);

  patchMethod(Document.prototype, 'exitFullscreen', patchExitFullscreen);
  patchMethod(Document.prototype, 'webkitExitFullscreen', patchWebkitExitFullscreen);

  patchAccessor(Document.prototype, 'fullscreenElement', pseudoElement);
  patchAccessor(Document.prototype, 'webkitFullscreenElement', pseudoElement);
  patchAccessor(Document.prototype, 'webkitIsFullScreen', () => true);
}
