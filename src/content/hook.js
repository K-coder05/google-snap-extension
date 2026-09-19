// MAIN world entry. Runs in the page's own JS realm, sharing globals with the
// page's scripts — this is where the real Fullscreen API is patched.
import { debugLog } from '../shared/log.js';
import { installFullscreenShim } from './pseudo/fullscreen-shim.js';
import { enterPseudo, exitPseudo } from './pseudo/pseudo-fullscreen.js';

debugLog('[Snapfit] hook loaded (MAIN world)');

// Patches Element.prototype.requestFullscreen and friends once, here, at
// document_start (SPEC.md §5) — no other work happens until a page actually
// requests fullscreen.
installFullscreenShim();

// Console-testable surface for the pseudo-fullscreen core (SPEC.md Phase 3).
window.__snapfit = {
  enter: enterPseudo,
  exit: exitPseudo
};
