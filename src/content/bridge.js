// ISOLATED world entry. Runs alongside the page's DOM but in its own JS
// realm, with access to chrome.* APIs the MAIN-world hook cannot reach.
import { MODE_ATTR, READY_ATTR, STATE_MESSAGE_TYPE, STATE_PORT_NAME } from '../shared/constants.js';
import { getSettings, onSettingsChanged } from '../shared/settings.js';
import { classifyWindow } from '../shared/snap.js';

console.debug('[Snapfit] bridge loaded (ISOLATED world)');

// Live status readout for the popup (SPEC.md §7.3). Layout only for now —
// videoCount/pseudoActive are added once the hook (MAIN world) exists to ask.
function currentState() {
  const { layout, wRatio, hRatio } = classifyWindow({
    availWidth: screen.availWidth,
    availHeight: screen.availHeight,
    availLeft: screen.availLeft ?? 0,
    availTop: screen.availTop ?? 0,
    outerWidth: window.outerWidth,
    outerHeight: window.outerHeight,
    screenX: window.screenX,
    screenY: window.screenY
  });
  return { ok: true, layout, wRatio, hRatio, inIframe: window !== window.top };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== STATE_MESSAGE_TYPE) return undefined;
  sendResponse(currentState());
  return undefined;
});

// Pushed on resize (an event, not a poll) so the popup's status line tracks
// Win+←/→/↑ snapping live without the popup having to poll for it.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== STATE_PORT_NAME) return;
  const onResize = () => port.postMessage(currentState());
  window.addEventListener('resize', onResize);
  port.onDisconnect.addListener(() => window.removeEventListener('resize', onResize));
});

// At document_start, document.documentElement may not exist yet.
function whenDocumentElement() {
  if (document.documentElement) return Promise.resolve();
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      if (document.documentElement) {
        observer.disconnect();
        resolve();
      }
    });
    observer.observe(document, { childList: true });
  });
}

async function publish() {
  const { mode } = await getSettings();
  await whenDocumentElement();
  document.documentElement.setAttribute(MODE_ATTR, mode);
  document.documentElement.setAttribute(READY_ATTR, '1');
}

publish();
onSettingsChanged(publish);
