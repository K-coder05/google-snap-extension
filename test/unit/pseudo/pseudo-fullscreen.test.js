// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLS_ACTIVE, CLS_LOCK, CLS_NEUTRALIZED } from '../../../src/shared/constants.js';
import { enterPseudo, exitPseudo, isPseudoActive, pseudoElement } from '../../../src/content/pseudo/pseudo-fullscreen.js';
import { MockResizeObserver } from '../../helpers/resize-observer-mock.js';

beforeEach(() => {
  MockResizeObserver.instances = [];
  globalThis.ResizeObserver = MockResizeObserver;
  document.body.innerHTML = '<div id="target"></div>';
  // jsdom doesn't implement scrollTo; stub it so exitPseudo's restore call
  // doesn't log noise in tests that aren't asserting on it directly.
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

afterEach(() => {
  if (isPseudoActive()) exitPseudo();
  vi.restoreAllMocks();
});

function target() {
  return document.getElementById('target');
}

describe('enterPseudo', () => {
  it('adds the active class to the element and lock classes to html/body', () => {
    enterPseudo(target());

    expect(target().classList.contains(CLS_ACTIVE)).toBe(true);
    expect(document.documentElement.classList.contains(CLS_LOCK)).toBe(true);
    expect(document.body.classList.contains(CLS_LOCK)).toBe(true);
  });

  it('reports itself active and exposes the current element', () => {
    enterPseudo(target());

    expect(isPseudoActive()).toBe(true);
    expect(pseudoElement()).toBe(target());
  });

  it('dispatches fullscreenchange and webkitfullscreenchange exactly once each', () => {
    const fsChange = vi.fn();
    const webkitFsChange = vi.fn();
    document.addEventListener('fullscreenchange', fsChange);
    document.addEventListener('webkitfullscreenchange', webkitFsChange);

    enterPseudo(target());

    expect(fsChange).toHaveBeenCalledTimes(1);
    expect(webkitFsChange).toHaveBeenCalledTimes(1);
  });

  it('neutralizes trapping ancestors', () => {
    document.body.innerHTML = '<div id="trap" style="transform: translateZ(0)"><div id="target"></div></div>';

    enterPseudo(target());

    expect(document.getElementById('trap').classList.contains(CLS_NEUTRALIZED)).toBe(true);
  });

  it('re-neutralizes live when the ResizeObserver fires', () => {
    document.body.innerHTML = '<div id="trap"><div id="target"></div></div>';
    enterPseudo(target());

    expect(document.getElementById('trap').classList.contains(CLS_NEUTRALIZED)).toBe(false);

    document.getElementById('trap').style.transform = 'translateZ(0)';
    MockResizeObserver.instances.at(-1).trigger();

    expect(document.getElementById('trap').classList.contains(CLS_NEUTRALIZED)).toBe(true);
  });

  // ResizeObserver only fires on box-size changes, which a bare restyle
  // (no layout impact) never triggers — this is the actual acceptance
  // criterion ("re-evaluates live if the page re-styles ancestors"), backed
  // by a real jsdom MutationObserver rather than the ResizeObserver mock.
  it('re-neutralizes live when an ancestor is restyled, via MutationObserver', async () => {
    document.body.innerHTML = '<div id="trap"><div id="target"></div></div>';
    enterPseudo(target());

    expect(document.getElementById('trap').classList.contains(CLS_NEUTRALIZED)).toBe(false);

    document.getElementById('trap').style.transform = 'translateZ(0)';
    await Promise.resolve();
    await Promise.resolve();

    expect(document.getElementById('trap').classList.contains(CLS_NEUTRALIZED)).toBe(true);
  });

  it('does not re-trigger itself off its own neutralization class writes', async () => {
    document.body.innerHTML = '<div id="trap" style="transform: translateZ(0)"><div id="target"></div></div>';
    enterPseudo(target());

    // If the observer weren't disconnected during reneutralize's own class
    // writes, this would loop; give it a few microtask turns to settle.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(document.getElementById('trap').classList.contains(CLS_NEUTRALIZED)).toBe(true);
  });

  it('exits any previously active element first', () => {
    document.body.innerHTML = '<div id="target"></div><div id="other"></div>';
    const first = document.getElementById('target');
    const second = document.getElementById('other');

    enterPseudo(first);
    enterPseudo(second);

    expect(first.classList.contains(CLS_ACTIVE)).toBe(false);
    expect(second.classList.contains(CLS_ACTIVE)).toBe(true);
    expect(pseudoElement()).toBe(second);
  });
});

describe('exitPseudo', () => {
  it('removes the active and lock classes and clears state', () => {
    enterPseudo(target());

    exitPseudo();

    expect(target().classList.contains(CLS_ACTIVE)).toBe(false);
    expect(document.documentElement.classList.contains(CLS_LOCK)).toBe(false);
    expect(document.body.classList.contains(CLS_LOCK)).toBe(false);
    expect(isPseudoActive()).toBe(false);
    expect(pseudoElement()).toBe(null);
  });

  it('restores neutralized ancestors', () => {
    document.body.innerHTML = '<div id="trap" style="transform: translateZ(0)"><div id="target"></div></div>';
    enterPseudo(target());

    exitPseudo();

    expect(document.getElementById('trap').classList.contains(CLS_NEUTRALIZED)).toBe(false);
  });

  it('dispatches fullscreenchange and webkitfullscreenchange exactly once each', () => {
    enterPseudo(target());
    const fsChange = vi.fn();
    const webkitFsChange = vi.fn();
    document.addEventListener('fullscreenchange', fsChange);
    document.addEventListener('webkitfullscreenchange', webkitFsChange);

    exitPseudo();

    expect(fsChange).toHaveBeenCalledTimes(1);
    expect(webkitFsChange).toHaveBeenCalledTimes(1);
  });

  it('restores the scroll position recorded at enter time', () => {
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    Object.defineProperty(window, 'scrollX', { value: 120, configurable: true });
    Object.defineProperty(window, 'scrollY', { value: 340, configurable: true });

    enterPseudo(target());
    exitPseudo();

    expect(scrollToSpy).toHaveBeenCalledWith(120, 340);
  });

  it('disconnects the ResizeObserver', () => {
    enterPseudo(target());
    const observer = MockResizeObserver.instances.at(-1);

    exitPseudo();

    expect(observer.disconnected).toBe(true);
  });

  it('is a no-op when nothing is active', () => {
    expect(() => exitPseudo()).not.toThrow();
    expect(isPseudoActive()).toBe(false);
  });
});

describe('Escape handling', () => {
  it('exits on Escape and the page does not observe the keydown', () => {
    const pageListener = vi.fn();
    document.addEventListener('keydown', pageListener);

    enterPseudo(target());
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

    expect(isPseudoActive()).toBe(false);
    expect(pageListener).not.toHaveBeenCalled();
  });

  it('ignores non-Escape keys', () => {
    enterPseudo(target());

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));

    expect(isPseudoActive()).toBe(true);
  });

  it('removes its listener after exit so a later Escape reaches the page', () => {
    const pageListener = vi.fn();
    document.addEventListener('keydown', pageListener);

    enterPseudo(target());
    exitPseudo();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

    expect(pageListener).toHaveBeenCalledTimes(1);
  });
});
