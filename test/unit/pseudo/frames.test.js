// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLS_ACTIVE, FRAME_MSG, FRAME_NS } from '../../../src/shared/constants.js';
import {
  escalateToAncestors,
  installFrameRelay,
  releaseFromAncestors,
  uninstallFrameRelay
} from '../../../src/content/pseudo/frames.js';
import { enterPseudo, exitPseudo, isPseudoActive, pseudoElement } from '../../../src/content/pseudo/pseudo-fullscreen.js';
import { MockResizeObserver } from '../../helpers/resize-observer-mock.js';
import { makeNonTopFrame, postMessageSource, saveWindowFrameRefs } from '../../helpers/window-frame-refs-mock.js';

const restoreWindowFrameRefs = saveWindowFrameRefs();
const asNonTop = makeNonTopFrame;

function dispatchMessage(data, source) {
  window.dispatchEvent(new MessageEvent('message', { data, source }));
}

beforeEach(() => {
  document.body.innerHTML = '';
  MockResizeObserver.instances = [];
  globalThis.ResizeObserver = MockResizeObserver;
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  installFrameRelay();
});

afterEach(() => {
  if (isPseudoActive()) exitPseudo();
  uninstallFrameRelay();
  vi.restoreAllMocks();
  restoreWindowFrameRefs();
});

describe('installFrameRelay / uninstallFrameRelay', () => {
  it('is idempotent: a second install does not attach a second listener', () => {
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const child = postMessageSource();
    Object.defineProperty(iframe, 'contentWindow', { value: child, configurable: true });

    installFrameRelay(); // already installed in beforeEach; should be a no-op
    dispatchMessage({ [FRAME_NS]: FRAME_MSG.CLAIM, token: 't1' }, child);

    // Exactly one 'granted' reply, not two, proves only one listener is live.
    expect(child.postMessage).toHaveBeenCalledTimes(1);
  });

  it('uninstall stops the relay from reacting to further messages', () => {
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const child = postMessageSource();
    Object.defineProperty(iframe, 'contentWindow', { value: child, configurable: true });

    uninstallFrameRelay();
    dispatchMessage({ [FRAME_NS]: FRAME_MSG.CLAIM, token: 't1' }, child);

    expect(child.postMessage).not.toHaveBeenCalled();
    expect(isPseudoActive()).toBe(false);
  });
});

describe('top frame handling a claim', () => {
  it('applies pseudo-fullscreen to the local iframe and replies granted', () => {
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const child = postMessageSource();
    Object.defineProperty(iframe, 'contentWindow', { value: child, configurable: true });

    dispatchMessage({ [FRAME_NS]: FRAME_MSG.CLAIM, token: 'abc' }, child);

    expect(isPseudoActive()).toBe(true);
    expect(pseudoElement()).toBe(iframe);
    expect(iframe.classList.contains(CLS_ACTIVE)).toBe(true);
    expect(child.postMessage).toHaveBeenCalledWith({ [FRAME_NS]: FRAME_MSG.GRANTED, token: 'abc' }, '*');
  });

  it('ignores a claim whose source does not resolve to a real local iframe', () => {
    const stranger = postMessageSource();

    dispatchMessage({ [FRAME_NS]: FRAME_MSG.CLAIM, token: 'abc' }, stranger);

    expect(isPseudoActive()).toBe(false);
    expect(stranger.postMessage).not.toHaveBeenCalled();
  });

  it('ignores malformed payloads (missing token, wrong namespace value)', () => {
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const child = postMessageSource();
    Object.defineProperty(iframe, 'contentWindow', { value: child, configurable: true });

    dispatchMessage({ [FRAME_NS]: FRAME_MSG.CLAIM }, child);
    dispatchMessage({ [FRAME_NS]: 'not-a-real-kind', token: 'abc' }, child);
    dispatchMessage('not even an object', child);

    expect(isPseudoActive()).toBe(false);
    expect(child.postMessage).not.toHaveBeenCalled();
  });
});

describe('intermediate frame handling a claim', () => {
  it('forwards the claim to its own parent instead of acting locally, remembering the local iframe', () => {
    asNonTop();
    const parent = postMessageSource();
    Object.defineProperty(window, 'parent', { value: parent, configurable: true });

    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const child = postMessageSource();
    Object.defineProperty(iframe, 'contentWindow', { value: child, configurable: true });

    dispatchMessage({ [FRAME_NS]: FRAME_MSG.CLAIM, token: 'tok' }, child);

    expect(isPseudoActive()).toBe(false); // not yet granted
    expect(parent.postMessage).toHaveBeenCalledWith({ [FRAME_NS]: FRAME_MSG.CLAIM, token: 'tok' }, '*');
    expect(child.postMessage).not.toHaveBeenCalled();
  });

  it('applies pseudo-fullscreen to its stored iframe and forwards granted downward once the parent grants', () => {
    asNonTop();
    const parent = postMessageSource();
    Object.defineProperty(window, 'parent', { value: parent, configurable: true });

    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const child = postMessageSource();
    Object.defineProperty(iframe, 'contentWindow', { value: child, configurable: true });

    dispatchMessage({ [FRAME_NS]: FRAME_MSG.CLAIM, token: 'tok' }, child);
    dispatchMessage({ [FRAME_NS]: FRAME_MSG.GRANTED, token: 'tok' }, parent);

    expect(isPseudoActive()).toBe(true);
    expect(pseudoElement()).toBe(iframe);
    expect(child.postMessage).toHaveBeenCalledWith({ [FRAME_NS]: FRAME_MSG.GRANTED, token: 'tok' }, '*');
  });

  it('ignores a granted message that does not come from its real parent', () => {
    asNonTop();
    const parent = postMessageSource();
    Object.defineProperty(window, 'parent', { value: parent, configurable: true });

    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const child = postMessageSource();
    Object.defineProperty(iframe, 'contentWindow', { value: child, configurable: true });

    dispatchMessage({ [FRAME_NS]: FRAME_MSG.CLAIM, token: 'tok' }, child);

    const impostor = postMessageSource();
    dispatchMessage({ [FRAME_NS]: FRAME_MSG.GRANTED, token: 'tok' }, impostor);

    expect(isPseudoActive()).toBe(false);
    expect(child.postMessage).not.toHaveBeenCalled();
  });

  it('ignores a granted message for an unknown token', () => {
    asNonTop();
    const parent = postMessageSource();
    Object.defineProperty(window, 'parent', { value: parent, configurable: true });

    dispatchMessage({ [FRAME_NS]: FRAME_MSG.GRANTED, token: 'never-claimed' }, parent);

    expect(isPseudoActive()).toBe(false);
  });
});

describe('release', () => {
  it('top frame exits pseudo-fullscreen on release from the granted source', () => {
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const child = postMessageSource();
    Object.defineProperty(iframe, 'contentWindow', { value: child, configurable: true });

    dispatchMessage({ [FRAME_NS]: FRAME_MSG.CLAIM, token: 'tok' }, child);
    expect(isPseudoActive()).toBe(true);

    dispatchMessage({ [FRAME_NS]: FRAME_MSG.RELEASE, token: 'tok' }, child);

    expect(isPseudoActive()).toBe(false);
  });

  it('intermediate frame exits pseudo-fullscreen and forwards release upward', () => {
    asNonTop();
    const parent = postMessageSource();
    Object.defineProperty(window, 'parent', { value: parent, configurable: true });

    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const child = postMessageSource();
    Object.defineProperty(iframe, 'contentWindow', { value: child, configurable: true });

    dispatchMessage({ [FRAME_NS]: FRAME_MSG.CLAIM, token: 'tok' }, child);
    dispatchMessage({ [FRAME_NS]: FRAME_MSG.GRANTED, token: 'tok' }, parent);
    expect(isPseudoActive()).toBe(true);

    parent.postMessage.mockClear();
    dispatchMessage({ [FRAME_NS]: FRAME_MSG.RELEASE, token: 'tok' }, child);

    expect(isPseudoActive()).toBe(false);
    expect(parent.postMessage).toHaveBeenCalledWith({ [FRAME_NS]: FRAME_MSG.RELEASE, token: 'tok' }, '*');
  });

  it('releasing a still-pending (not yet granted) claim cleans up without exiting anything', () => {
    asNonTop();
    const parent = postMessageSource();
    Object.defineProperty(window, 'parent', { value: parent, configurable: true });

    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const child = postMessageSource();
    Object.defineProperty(iframe, 'contentWindow', { value: child, configurable: true });

    dispatchMessage({ [FRAME_NS]: FRAME_MSG.CLAIM, token: 'tok' }, child);
    expect(isPseudoActive()).toBe(false);

    expect(() => dispatchMessage({ [FRAME_NS]: FRAME_MSG.RELEASE, token: 'tok' }, child)).not.toThrow();
    expect(isPseudoActive()).toBe(false);

    // The late grant should now be a no-op: the pending entry was cleared by release.
    dispatchMessage({ [FRAME_NS]: FRAME_MSG.GRANTED, token: 'tok' }, parent);
    expect(isPseudoActive()).toBe(false);
  });

  it('ignores a release whose source does not match the tracked claimant', () => {
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const child = postMessageSource();
    Object.defineProperty(iframe, 'contentWindow', { value: child, configurable: true });

    dispatchMessage({ [FRAME_NS]: FRAME_MSG.CLAIM, token: 'tok' }, child);
    expect(isPseudoActive()).toBe(true);

    const impostor = postMessageSource();
    dispatchMessage({ [FRAME_NS]: FRAME_MSG.RELEASE, token: 'tok' }, impostor);

    expect(isPseudoActive()).toBe(true);
  });

  // A page's own "exit fullscreen" control, or Escape landing on a frame
  // that isn't the original requester, exits pseudo-fullscreen at that
  // frame directly (via exitPseudo(), not via an inbound 'release'
  // message) — this must still cascade to every other level, not just the
  // frame where it happened (issue #7 AC4: "Exit propagates the same way
  // and restores every level").
  it('top frame exiting locally (not via an inbound release) pushes release down to the granted child', () => {
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const child = postMessageSource();
    Object.defineProperty(iframe, 'contentWindow', { value: child, configurable: true });

    dispatchMessage({ [FRAME_NS]: FRAME_MSG.CLAIM, token: 'tok' }, child);
    expect(isPseudoActive()).toBe(true);
    child.postMessage.mockClear();

    exitPseudo(); // top's own Escape handler / exitFullscreen() shim — no incoming message

    expect(isPseudoActive()).toBe(false);
    expect(child.postMessage).toHaveBeenCalledWith({ [FRAME_NS]: FRAME_MSG.RELEASE, token: 'tok' }, '*');
  });

  it('intermediate frame exiting locally pushes release both up to its parent and down to its child', () => {
    asNonTop();
    const parent = postMessageSource();
    Object.defineProperty(window, 'parent', { value: parent, configurable: true });

    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const child = postMessageSource();
    Object.defineProperty(iframe, 'contentWindow', { value: child, configurable: true });

    dispatchMessage({ [FRAME_NS]: FRAME_MSG.CLAIM, token: 'tok' }, child);
    dispatchMessage({ [FRAME_NS]: FRAME_MSG.GRANTED, token: 'tok' }, parent);
    expect(isPseudoActive()).toBe(true);
    parent.postMessage.mockClear();
    child.postMessage.mockClear();

    exitPseudo(); // this frame's own Escape handler — no incoming message

    expect(isPseudoActive()).toBe(false);
    expect(parent.postMessage).toHaveBeenCalledWith({ [FRAME_NS]: FRAME_MSG.RELEASE, token: 'tok' }, '*');
    expect(child.postMessage).toHaveBeenCalledWith({ [FRAME_NS]: FRAME_MSG.RELEASE, token: 'tok' }, '*');
  });

  it('an intermediate pushing release down to its child does not also bounce it back upward', () => {
    asNonTop();
    const parent = postMessageSource();
    Object.defineProperty(window, 'parent', { value: parent, configurable: true });

    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const child = postMessageSource();
    Object.defineProperty(iframe, 'contentWindow', { value: child, configurable: true });

    dispatchMessage({ [FRAME_NS]: FRAME_MSG.CLAIM, token: 'tok' }, child);
    dispatchMessage({ [FRAME_NS]: FRAME_MSG.GRANTED, token: 'tok' }, parent);
    parent.postMessage.mockClear();

    // Parent decided to collapse first and pushes release down to us.
    dispatchMessage({ [FRAME_NS]: FRAME_MSG.RELEASE, token: 'tok' }, parent);

    expect(isPseudoActive()).toBe(false);
    expect(child.postMessage).toHaveBeenCalledWith({ [FRAME_NS]: FRAME_MSG.RELEASE, token: 'tok' }, '*');
    expect(parent.postMessage).not.toHaveBeenCalled(); // no echo back to the sender
  });
});

describe('escalateToAncestors', () => {
  it('returns null and posts nothing when already top', () => {
    const token = escalateToAncestors();
    expect(token).toBe(null);
  });

  it('posts a claim to window.parent and returns the token when nested', () => {
    asNonTop();
    const parent = postMessageSource();
    Object.defineProperty(window, 'parent', { value: parent, configurable: true });

    const token = escalateToAncestors();

    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
    expect(parent.postMessage).toHaveBeenCalledWith({ [FRAME_NS]: FRAME_MSG.CLAIM, token }, '*');
  });
});

describe('releaseFromAncestors', () => {
  it('is a no-op with a falsy token, an untracked token, or at the top frame', () => {
    const parent = postMessageSource();
    Object.defineProperty(window, 'parent', { value: parent, configurable: true });

    releaseFromAncestors(null);
    releaseFromAncestors('never-escalated'); // no matching proxies entry

    expect(parent.postMessage).not.toHaveBeenCalled();
  });

  it('posts a release to window.parent for a token this frame actually escalated', () => {
    asNonTop();
    const parent = postMessageSource();
    Object.defineProperty(window, 'parent', { value: parent, configurable: true });

    const token = escalateToAncestors();
    parent.postMessage.mockClear();

    releaseFromAncestors(token);

    expect(parent.postMessage).toHaveBeenCalledWith({ [FRAME_NS]: FRAME_MSG.RELEASE, token }, '*');
  });

  it('an inbound release from the parent exits this origin frame\'s own pseudo-fullscreen (an ancestor collapsed first)', () => {
    asNonTop();
    const parent = postMessageSource();
    Object.defineProperty(window, 'parent', { value: parent, configurable: true });
    document.body.innerHTML = '<div id="real-target"></div>';

    enterPseudo(document.getElementById('real-target'), {
      onExit: () => releaseFromAncestors(token)
    });
    const token = escalateToAncestors();
    parent.postMessage.mockClear();

    dispatchMessage({ [FRAME_NS]: FRAME_MSG.RELEASE, token }, parent);

    expect(isPseudoActive()).toBe(false);
    expect(parent.postMessage).not.toHaveBeenCalled(); // no echo back up to the sender
  });
});
