// Cross-frame escalation relay (SPEC.md §9, Phase 5). A `window`-mode
// fullscreen request from a nested frame (an embedded YouTube iframe on a
// third-party blog) must expand all the way to the top-level viewport, not
// just the requesting frame's own box. Every frame in the ancestor chain
// runs this module (all_frames: true) and relays a three-message protocol
// via postMessage: 'claim' travels up from the requester to the top frame,
// 'granted' travels back down applying enterPseudo to each frame's local
// iframe element along the way, and 'release' travels along the same chain
// on exit — in *either* direction, since exit can be triggered at any level
// (the requester's own Escape/exitFullscreen(), but just as validly the top
// page's own "exit fullscreen" button, or Escape landing on an intermediate
// frame that happens to have focus).
//
// Origin is always '*' — an ancestor's origin is unknowable from here — so
// every payload is inert (a namespace tag + random token) and every handler
// verifies event.source resolves to a real iframe already in its own DOM
// (or, going the other way, to this frame's own window.parent) before
// acting on it. Never trust the message contents beyond that.
import { FRAME_MSG, FRAME_NS } from '../../shared/constants.js';
import { enterPseudo, exitPseudo } from './pseudo-fullscreen.js';

function post(target, kind, token) {
  target.postMessage({ [FRAME_NS]: kind, token }, '*');
}

// token -> { sourceWindow, iframeElement, granted }. One entry per escalation
// this frame participates in, whether as the originating requester (no local
// iframe proxy — sourceWindow is null, there's nothing "below" it) or as a
// relay standing in for a child frame (sourceWindow/iframeElement set).
// `granted` means this frame has actually called enterPseudo for the token
// (always true for the requester and for the top frame's direct grant;
// false at an intermediate still waiting on its own parent's 'granted').
const proxies = new Map();

let listenerInstalled = false;

function createToken() {
  return typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

// Security check shared by every inbound handler: a message claiming to
// come from a child frame is only actionable if its source really is the
// contentWindow of an iframe present in this frame's own DOM right now.
function findLocalIframe(sourceWindow) {
  const iframes = document.querySelectorAll('iframe');
  for (const iframe of iframes) {
    if (iframe.contentWindow === sourceWindow) return iframe;
  }
  return null;
}

// Tears down this frame's participation in `token` and forwards 'release'
// onward — but only in the direction(s) the message hasn't already come
// from, so a release never echoes back the way it arrived. `arrivedFrom` is
// 'below' (a child relayed it up), 'above' (our parent pushed it down), or
// null (this frame is the one deciding to exit, so both neighbors need to
// hear about it). Safe to call for a token that's already gone — every
// caller already checked `proxies.has(token)` first — and exitPseudo() is
// itself a no-op when nothing is active, so a stray duplicate delivery (the
// self-triggered case always fires one direction that then bounces back
// here once the neighbor's own entry is already deleted) never double-fires.
function collapse(token, arrivedFrom) {
  const entry = proxies.get(token);
  if (!entry) return;
  proxies.delete(token);

  if (entry.granted) exitPseudo();
  if (arrivedFrom !== 'below' && entry.sourceWindow) post(entry.sourceWindow, FRAME_MSG.RELEASE, token);
  if (arrivedFrom !== 'above' && window !== window.top) post(window.parent, FRAME_MSG.RELEASE, token);
}

function handleClaim(token, sourceWindow) {
  const iframeElement = findLocalIframe(sourceWindow);
  if (!iframeElement) return;

  if (window === window.top) {
    proxies.set(token, { sourceWindow, iframeElement, granted: true });
    enterPseudo(iframeElement, { onExit: () => collapse(token, null) });
    post(sourceWindow, FRAME_MSG.GRANTED, token);
    return;
  }

  proxies.set(token, { sourceWindow, iframeElement, granted: false });
  post(window.parent, FRAME_MSG.CLAIM, token);
}

function handleGranted(token, sourceWindow) {
  // Only our own parent can grant what we asked it for.
  if (sourceWindow !== window.parent) return;
  const entry = proxies.get(token);
  if (!entry || entry.granted) return;

  entry.granted = true;
  enterPseudo(entry.iframeElement, { onExit: () => collapse(token, null) });
  post(entry.sourceWindow, FRAME_MSG.GRANTED, token);
}

function handleRelease(token, sourceWindow) {
  const entry = proxies.get(token);
  if (!entry) return;

  if (sourceWindow === entry.sourceWindow) return collapse(token, 'below');
  if (window !== window.top && sourceWindow === window.parent) return collapse(token, 'above');
  // Source matches neither known neighbor for this token — ignore.
}

function onMessage(event) {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  const kind = data[FRAME_NS];
  const token = data.token;
  if (typeof token !== 'string' || !token) return;
  if (!event.source) return;

  if (kind === FRAME_MSG.CLAIM) return handleClaim(token, event.source);
  if (kind === FRAME_MSG.GRANTED) return handleGranted(token, event.source);
  if (kind === FRAME_MSG.RELEASE) return handleRelease(token, event.source);
}

export function installFrameRelay() {
  if (listenerInstalled) return;
  listenerInstalled = true;
  window.addEventListener('message', onMessage);
}

export function uninstallFrameRelay() {
  if (!listenerInstalled) return;
  listenerInstalled = false;
  window.removeEventListener('message', onMessage);
  proxies.clear();
}

// Called by the frame that owns the actual fullscreen-requesting element,
// once it has already entered pseudo-fullscreen locally. Registers itself
// as the chain's origin (sourceWindow: null — there's no child below it)
// and kicks off the upward 'claim' relay. Returns a token to pass to
// releaseFromAncestors later, or null when already top (nothing to escalate).
export function escalateToAncestors() {
  if (window === window.top) return null;
  const token = createToken();
  proxies.set(token, { sourceWindow: null, iframeElement: null, granted: true });
  post(window.parent, FRAME_MSG.CLAIM, token);
  return token;
}

// Called whenever this frame's own pseudo-fullscreen exits, however that
// exit was triggered — collapses this frame's participation in `token` and
// propagates 'release' to every neighbor that doesn't already know.
export function releaseFromAncestors(token) {
  if (!token) return;
  collapse(token, null);
}
