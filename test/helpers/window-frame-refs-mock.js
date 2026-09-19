import { vi } from 'vitest';

// jsdom's window.top/window.parent are read-only, self-referencing
// accessors. Object.defineProperty can override them for a single test to
// simulate a non-top frame, but a bare `delete` afterward leaves them
// undefined instead of restoring the original accessor, silently corrupting
// every later test's frame checks. Snapshot both descriptors once and hand
// back a restore function for the test's afterEach.
export function saveWindowFrameRefs() {
  const originalTop = Object.getOwnPropertyDescriptor(window, 'top');
  const originalParent = Object.getOwnPropertyDescriptor(window, 'parent');
  return function restoreWindowFrameRefs() {
    Object.defineProperty(window, 'top', originalTop);
    Object.defineProperty(window, 'parent', originalParent);
  };
}

// Makes `window !== window.top` true, as if this frame were nested.
export function makeNonTopFrame() {
  Object.defineProperty(window, 'top', { value: {}, configurable: true });
}

// A stand-in for a real cross-frame `window` reference: all a handler ever
// does with one is compare it for identity or call postMessage on it.
export function postMessageSource() {
  return { postMessage: vi.fn() };
}
