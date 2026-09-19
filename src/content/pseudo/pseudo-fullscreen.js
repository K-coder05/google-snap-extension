// Pseudo-fullscreen: promotes an element to a fixed, viewport-filling
// overlay instead of invoking the real Fullscreen API (SPEC.md §6). This
// module owns enter/exit and the element bookkeeping needed to restore the
// page exactly; it does not yet touch window.requestFullscreen or friends
// (that routing is a later phase) — it is exercised directly via the
// __snapfit test hook exposed by the MAIN-world hook.
import { CLS_ACTIVE, CLS_LOCK } from '../../shared/constants.js';
import { neutralizeAncestors, restoreAncestors } from './containing-block.js';

let state = null;

// ResizeObserver only fires on box-size changes, so it misses a page adding
// transform/filter/will-change to an ancestor without resizing it — exactly
// the trap this module exists to catch. Watch style/class attribute changes
// too; still push-based (not a poll).
const RESTYLE_WATCH_OPTIONS = { attributes: true, attributeFilter: ['style', 'class'], subtree: true };

function dispatchFullscreenChange(el) {
  el.dispatchEvent(new Event('fullscreenchange', { bubbles: true, composed: true }));
  el.dispatchEvent(new Event('webkitfullscreenchange', { bubbles: true, composed: true }));
}

// Disconnects the mutation observer before touching classes and reconnects
// after: neutralize/restore themselves mutate the `class` attribute this
// same observer watches, and without this the observer would perpetually
// re-trigger itself on its own writes.
function reneutralize() {
  if (!state) return;
  state.mutationObserver.disconnect();
  restoreAncestors(state.neutralized);
  state.neutralized = neutralizeAncestors(state.element);
  state.mutationObserver.observe(document.documentElement, RESTYLE_WATCH_OPTIONS);
}

// Capture phase on window, matching native fullscreen's Escape behavior: the
// page never observes the keydown. Only installed while active.
function onKeydown(e) {
  if (!state) return;
  if (e.key !== 'Escape') return;
  e.preventDefault();
  e.stopImmediatePropagation();
  exitPseudo();
}

export function isPseudoActive() {
  return state !== null;
}

export function pseudoElement() {
  return state ? state.element : null;
}

// options.escToExit seams in the advanced.escToExit setting (SPEC.md §4.3);
// defaults on since this module has no access to chrome.storage (MAIN
// world) — the caller that does read settings is responsible for passing it.
export function enterPseudo(el, { escToExit = true } = {}) {
  if (state) {
    if (state.element === el) return;
    exitPseudo();
  }

  const resizeObserver = new ResizeObserver(reneutralize);
  resizeObserver.observe(document.documentElement);
  const mutationObserver = new MutationObserver(reneutralize);

  // No prevInline field: el's own fixed/inset/etc. layout comes entirely
  // from the CLS_ACTIVE class in pseudo.css, so nothing here ever writes to
  // el.style, and there's nothing to restore on exit.
  state = {
    element: el,
    neutralized: neutralizeAncestors(el),
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    resizeObserver,
    mutationObserver,
    rafId: null,
    escToExit
  };

  el.classList.add(CLS_ACTIVE);
  document.documentElement.classList.add(CLS_LOCK);
  document.body?.classList.add(CLS_LOCK);

  mutationObserver.observe(document.documentElement, RESTYLE_WATCH_OPTIONS);

  if (escToExit) window.addEventListener('keydown', onKeydown, true);

  // Catches ancestor styles applied after this synchronous pass but before
  // the next paint (SPEC.md §6.1 step 6).
  state.rafId = requestAnimationFrame(reneutralize);

  dispatchFullscreenChange(el);
  window.dispatchEvent(new Event('resize'));
}

export function exitPseudo() {
  if (!state) return;
  const { element, neutralized, scrollX, scrollY, resizeObserver, mutationObserver, rafId, escToExit } = state;

  resizeObserver.disconnect();
  mutationObserver.disconnect();
  if (rafId !== null) cancelAnimationFrame(rafId);
  if (escToExit) window.removeEventListener('keydown', onKeydown, true);

  restoreAncestors(neutralized);

  element.classList.remove(CLS_ACTIVE);
  document.documentElement.classList.remove(CLS_LOCK);
  document.body?.classList.remove(CLS_LOCK);

  state = null;

  dispatchFullscreenChange(element);
  window.dispatchEvent(new Event('resize'));
  window.scrollTo(scrollX, scrollY);
}
