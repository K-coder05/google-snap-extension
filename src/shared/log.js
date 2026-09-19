import { DEBUG } from './constants.js';

// The one gate for debug output (SPEC.md §12 Phase 6). Every debug console
// call in the extension goes through this instead of calling console.* directly.
export function debugLog(...args) {
  if (DEBUG) console.debug(...args);
}
