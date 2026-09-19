// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLS_ACTIVE, MODE, MODE_ATTR } from '../../../src/shared/constants.js';
import { installFullscreenShim, resolveMode } from '../../../src/content/pseudo/fullscreen-shim.js';
import { isPseudoActive, pseudoElement, exitPseudo } from '../../../src/content/pseudo/pseudo-fullscreen.js';
import { installNativeFullscreenMocks } from '../../helpers/fullscreen-natives-mock.js';
import { MockResizeObserver } from '../../helpers/resize-observer-mock.js';

function setGeometry({
  availWidth = 1920,
  availHeight = 1032,
  availLeft = 0,
  availTop = 0,
  outerWidth = 1920,
  outerHeight = 1032,
  screenX = 0,
  screenY = 0
} = {}) {
  Object.defineProperty(window.screen, 'availWidth', { value: availWidth, configurable: true });
  Object.defineProperty(window.screen, 'availHeight', { value: availHeight, configurable: true });
  Object.defineProperty(window.screen, 'availLeft', { value: availLeft, configurable: true });
  Object.defineProperty(window.screen, 'availTop', { value: availTop, configurable: true });
  Object.defineProperty(window, 'outerWidth', { value: outerWidth, configurable: true });
  Object.defineProperty(window, 'outerHeight', { value: outerHeight, configurable: true });
  Object.defineProperty(window, 'screenX', { value: screenX, configurable: true });
  Object.defineProperty(window, 'screenY', { value: screenY, configurable: true });
}

const MAXIMIZED = { outerWidth: 1920, outerHeight: 1032 };
const SNAPPED_LEFT = { outerWidth: 960, outerHeight: 1032 };

// Object.defineProperty(window, 'top', ...) below replaces jsdom's real
// self-referencing accessor with a plain data property; a bare `delete`
// afterward leaves `window.top` undefined instead of restoring it, which
// silently corrupts every later test's iframe check. Restore the exact
// original descriptor instead.
const ORIGINAL_TOP_DESCRIPTOR = Object.getOwnPropertyDescriptor(window, 'top');
function restoreWindowTop() {
  Object.defineProperty(window, 'top', ORIGINAL_TOP_DESCRIPTOR);
}

describe('resolveMode', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute(MODE_ATTR);
    setGeometry(SNAPPED_LEFT);
  });

  afterEach(() => {
    restoreWindowTop();
  });

  it('returns DISPLAY for a non-top-level frame regardless of the stored mode', () => {
    document.documentElement.setAttribute(MODE_ATTR, MODE.WINDOW);
    Object.defineProperty(window, 'top', { value: {}, configurable: true });

    expect(resolveMode()).toBe(MODE.DISPLAY);
  });

  it('returns the explicit mode when set to window', () => {
    document.documentElement.setAttribute(MODE_ATTR, MODE.WINDOW);
    expect(resolveMode()).toBe(MODE.WINDOW);
  });

  it('returns the explicit mode when set to display', () => {
    document.documentElement.setAttribute(MODE_ATTR, MODE.DISPLAY);
    expect(resolveMode()).toBe(MODE.DISPLAY);
  });

  it('resolves auto to display when the window is maximized', () => {
    document.documentElement.setAttribute(MODE_ATTR, MODE.AUTO);
    setGeometry(MAXIMIZED);
    expect(resolveMode()).toBe(MODE.DISPLAY);
  });

  it('resolves auto to window when the window is snapped', () => {
    document.documentElement.setAttribute(MODE_ATTR, MODE.AUTO);
    setGeometry(SNAPPED_LEFT);
    expect(resolveMode()).toBe(MODE.WINDOW);
  });

  it('treats a missing attribute the same as auto', () => {
    setGeometry(MAXIMIZED);
    expect(resolveMode()).toBe(MODE.DISPLAY);
  });
});

describe('installFullscreenShim routing', () => {
  let natives;

  beforeEach(() => {
    document.body.innerHTML = '<video id="target"></video>';
    document.documentElement.removeAttribute(MODE_ATTR);
    setGeometry(SNAPPED_LEFT);
    MockResizeObserver.instances = [];
    globalThis.ResizeObserver = MockResizeObserver;
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    natives = installNativeFullscreenMocks();
    installFullscreenShim();
  });

  afterEach(() => {
    if (isPseudoActive()) exitPseudo();
    natives.uninstall();
    vi.restoreAllMocks();
    restoreWindowTop();
  });

  function target() {
    return document.getElementById('target');
  }

  describe('requestFullscreen', () => {
    it('passes through to native synchronously in display mode', () => {
      document.documentElement.setAttribute(MODE_ATTR, MODE.DISPLAY);

      target().requestFullscreen();

      expect(natives.calls.requestFullscreen).toHaveBeenCalledWith(target(), undefined);
      expect(isPseudoActive()).toBe(false);
    });

    it('enters pseudo-fullscreen and returns a resolved promise in window mode', async () => {
      document.documentElement.setAttribute(MODE_ATTR, MODE.WINDOW);

      const result = target().requestFullscreen();

      expect(result).toBeInstanceOf(Promise);
      await expect(result).resolves.toBeUndefined();
      expect(natives.calls.requestFullscreen).not.toHaveBeenCalled();
      expect(isPseudoActive()).toBe(true);
      expect(pseudoElement()).toBe(target());
    });

    it('falls back to native fullscreen when pseudo entry throws', () => {
      document.documentElement.setAttribute(MODE_ATTR, MODE.WINDOW);
      class ThrowingResizeObserver {
        constructor() {
          throw new Error('boom');
        }
      }
      globalThis.ResizeObserver = ThrowingResizeObserver;

      target().requestFullscreen();

      expect(natives.calls.requestFullscreen).toHaveBeenCalledWith(target(), undefined);
      expect(isPseudoActive()).toBe(false);
      expect(target().classList.contains(CLS_ACTIVE)).toBe(false);
    });

    it('falls back to native fullscreen from a non-top-level frame', () => {
      document.documentElement.setAttribute(MODE_ATTR, MODE.WINDOW);
      Object.defineProperty(window, 'top', { value: {}, configurable: true });

      target().requestFullscreen();

      expect(natives.calls.requestFullscreen).toHaveBeenCalledWith(target(), undefined);
      expect(isPseudoActive()).toBe(false);
    });
  });

  describe('legacy webkit variants', () => {
    it('webkitRequestFullscreen mirrors the routing and returns undefined', () => {
      document.documentElement.setAttribute(MODE_ATTR, MODE.WINDOW);

      const result = target().webkitRequestFullscreen();

      expect(result).toBeUndefined();
      expect(natives.calls.webkitRequestFullscreen).not.toHaveBeenCalled();
      expect(isPseudoActive()).toBe(true);
    });

    it('webkitRequestFullscreen passes through natively in display mode', () => {
      document.documentElement.setAttribute(MODE_ATTR, MODE.DISPLAY);

      target().webkitRequestFullscreen();

      expect(natives.calls.webkitRequestFullscreen).toHaveBeenCalledWith(target(), undefined);
    });

    it('webkitRequestFullScreen (legacy capital S) mirrors the routing', () => {
      document.documentElement.setAttribute(MODE_ATTR, MODE.DISPLAY);

      target().webkitRequestFullScreen();

      expect(natives.calls.webkitRequestFullScreen).toHaveBeenCalledWith(target(), undefined);
    });

    it('HTMLVideoElement.webkitEnterFullscreen mirrors the routing on the video itself', () => {
      document.documentElement.setAttribute(MODE_ATTR, MODE.WINDOW);

      target().webkitEnterFullscreen();

      expect(natives.calls.webkitEnterFullscreen).not.toHaveBeenCalled();
      expect(isPseudoActive()).toBe(true);
      expect(pseudoElement()).toBe(target());
    });
  });

  describe('exitFullscreen', () => {
    it('exits pseudo-fullscreen and resolves without touching native exit', async () => {
      document.documentElement.setAttribute(MODE_ATTR, MODE.WINDOW);
      target().requestFullscreen();

      const result = document.exitFullscreen();

      expect(result).toBeInstanceOf(Promise);
      await result;
      expect(isPseudoActive()).toBe(false);
      expect(natives.calls.exitFullscreen).not.toHaveBeenCalled();
    });

    it('delegates to native exit when pseudo is not active', () => {
      document.exitFullscreen();
      expect(natives.calls.exitFullscreen).toHaveBeenCalledWith(document);
    });

    it('webkitExitFullscreen mirrors the routing synchronously', () => {
      document.documentElement.setAttribute(MODE_ATTR, MODE.WINDOW);
      target().requestFullscreen();

      const result = document.webkitExitFullscreen();

      expect(result).toBeUndefined();
      expect(isPseudoActive()).toBe(false);
      expect(natives.calls.webkitExitFullscreen).not.toHaveBeenCalled();
    });
  });

  describe('fullscreenElement accessors', () => {
    it('reports the pseudo element while active, then null after exit', () => {
      document.documentElement.setAttribute(MODE_ATTR, MODE.WINDOW);
      target().requestFullscreen();

      expect(document.fullscreenElement).toBe(target());
      expect(document.webkitFullscreenElement).toBe(target());
      expect(document.webkitIsFullScreen).toBe(true);

      document.exitFullscreen();

      expect(document.fullscreenElement).toBe(null);
      expect(document.webkitIsFullScreen).toBe(false);
    });

    it('delegates to the native getter when pseudo is not active', () => {
      natives.setNativeElement(target());
      expect(document.fullscreenElement).toBe(target());
      expect(document.webkitFullscreenElement).toBe(target());
    });
  });

});

describe('installFullscreenShim with a Chrome version missing optional legacy members', () => {
  it('does not throw and still patches the standard members', () => {
    document.body.innerHTML = '<video id="target"></video>';
    document.documentElement.setAttribute(MODE_ATTR, MODE.DISPLAY);
    setGeometry(SNAPPED_LEFT);
    const natives = installNativeFullscreenMocks({
      include: ['requestFullscreen', 'exitFullscreen', 'fullscreenElement']
    });

    expect(() => installFullscreenShim()).not.toThrow();
    expect(() => document.getElementById('target').requestFullscreen()).not.toThrow();
    expect(natives.calls.requestFullscreen).toHaveBeenCalled();

    natives.uninstall();
  });
});
