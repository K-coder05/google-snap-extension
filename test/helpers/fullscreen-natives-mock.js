import { vi } from 'vitest';

// jsdom implements none of the Fullscreen API (no requestFullscreen,
// exitFullscreen, or fullscreenElement — see SPEC.md §5.1's capture list).
// Installs a minimal native-like surface on the real prototypes so
// fullscreen-shim.js has something to capture and wrap, matching what real
// Chrome provides. `include` narrows which members exist, so tests can
// simulate a Chrome version missing an optional legacy member (SPEC.md's
// "bail out ... if any capture returns undefined" future-proofing case).
const ALL_MEMBERS = [
  'requestFullscreen',
  'webkitRequestFullscreen',
  'webkitRequestFullScreen',
  'exitFullscreen',
  'webkitExitFullscreen',
  'fullscreenElement',
  'webkitFullscreenElement',
  'webkitIsFullScreen',
  'webkitEnterFullscreen'
];

export function installNativeFullscreenMocks({ include = ALL_MEMBERS } = {}) {
  const has = (name) => include.includes(name);
  let nativeElement = null;

  const calls = {
    requestFullscreen: vi.fn(),
    webkitRequestFullscreen: vi.fn(),
    webkitRequestFullScreen: vi.fn(),
    exitFullscreen: vi.fn(),
    webkitExitFullscreen: vi.fn(),
    webkitEnterFullscreen: vi.fn()
  };

  const removers = [];

  if (has('requestFullscreen')) {
    Element.prototype.requestFullscreen = function requestFullscreen(options) {
      calls.requestFullscreen(this, options);
      nativeElement = this;
      return Promise.resolve();
    };
    removers.push(() => delete Element.prototype.requestFullscreen);
  }
  if (has('webkitRequestFullscreen')) {
    Element.prototype.webkitRequestFullscreen = function webkitRequestFullscreen(options) {
      calls.webkitRequestFullscreen(this, options);
      nativeElement = this;
    };
    removers.push(() => delete Element.prototype.webkitRequestFullscreen);
  }
  if (has('webkitRequestFullScreen')) {
    Element.prototype.webkitRequestFullScreen = function webkitRequestFullScreen(options) {
      calls.webkitRequestFullScreen(this, options);
      nativeElement = this;
    };
    removers.push(() => delete Element.prototype.webkitRequestFullScreen);
  }
  if (has('webkitEnterFullscreen')) {
    window.HTMLVideoElement.prototype.webkitEnterFullscreen = function webkitEnterFullscreen() {
      calls.webkitEnterFullscreen(this);
      nativeElement = this;
    };
    removers.push(() => delete window.HTMLVideoElement.prototype.webkitEnterFullscreen);
  }
  if (has('exitFullscreen')) {
    Document.prototype.exitFullscreen = function exitFullscreen() {
      calls.exitFullscreen(this);
      nativeElement = null;
      return Promise.resolve();
    };
    removers.push(() => delete Document.prototype.exitFullscreen);
  }
  if (has('webkitExitFullscreen')) {
    Document.prototype.webkitExitFullscreen = function webkitExitFullscreen() {
      calls.webkitExitFullscreen(this);
      nativeElement = null;
    };
    removers.push(() => delete Document.prototype.webkitExitFullscreen);
  }
  if (has('fullscreenElement')) {
    Object.defineProperty(Document.prototype, 'fullscreenElement', {
      configurable: true,
      enumerable: true,
      get() {
        return nativeElement;
      }
    });
    removers.push(() => delete Document.prototype.fullscreenElement);
  }
  if (has('webkitFullscreenElement')) {
    Object.defineProperty(Document.prototype, 'webkitFullscreenElement', {
      configurable: true,
      enumerable: true,
      get() {
        return nativeElement;
      }
    });
    removers.push(() => delete Document.prototype.webkitFullscreenElement);
  }
  if (has('webkitIsFullScreen')) {
    Object.defineProperty(Document.prototype, 'webkitIsFullScreen', {
      configurable: true,
      enumerable: true,
      get() {
        return nativeElement !== null;
      }
    });
    removers.push(() => delete Document.prototype.webkitIsFullScreen);
  }

  return {
    calls,
    setNativeElement: (el) => {
      nativeElement = el;
    },
    uninstall: () => removers.forEach((remove) => remove())
  };
}
