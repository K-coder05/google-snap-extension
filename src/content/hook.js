// MAIN world entry. Runs in the page's own JS realm, sharing globals with the
// page's scripts — this is where the real Fullscreen API will be patched.
import { enterPseudo, exitPseudo } from './pseudo/pseudo-fullscreen.js';

console.debug('[Snapfit] hook loaded (MAIN world)');

// Console-testable surface for the pseudo-fullscreen core (SPEC.md Phase 3).
// A later phase routes real requestFullscreen() calls through enterPseudo
// instead of exposing it only here.
window.__snapfit = {
  enter: enterPseudo,
  exit: exitPseudo
};
