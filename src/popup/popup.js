import { STATE_MESSAGE_TYPE, STATE_PORT_NAME } from '../shared/constants.js';
import { getSettings, onSettingsChanged, setMode } from '../shared/settings.js';
import { LAYOUT } from '../shared/snap.js';

const form = document.getElementById('mode-form');
const warning = document.getElementById('sync-warning');
const statusLine = document.getElementById('status-line');

const LAYOUT_LABELS = {
  [LAYOUT.MAXIMIZED]: 'This window: maximized',
  [LAYOUT.HALF_LEFT]: 'This window: snapped left half',
  [LAYOUT.HALF_RIGHT]: 'This window: snapped right half',
  [LAYOUT.HALF_TOP]: 'This window: snapped top half',
  [LAYOUT.HALF_BOTTOM]: 'This window: snapped bottom half',
  [LAYOUT.QUARTER]: 'This window: snapped to a quarter',
  [LAYOUT.FLOATING]: 'This window: floating'
};

function applyMode(mode) {
  const input = form.querySelector(`input[value="${mode}"]`);
  if (input) input.checked = true;
}

function renderLayout(layout) {
  statusLine.textContent = LAYOUT_LABELS[layout] ?? 'This window: unknown arrangement';
  statusLine.hidden = false;
}

function renderStatusUnavailable() {
  statusLine.textContent = 'Not available on this page.';
  statusLine.hidden = false;
}

async function initStatus() {
  let tab;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch {
    // chrome.tabs.query is effectively infallible for this call shape, but
    // guard it anyway rather than let an unhandled rejection reach the popup.
    renderStatusUnavailable();
    return;
  }
  if (!tab?.id) {
    renderStatusUnavailable();
    return;
  }

  // frameId: 0 pins this to the top-level frame — bridge.js runs in every
  // frame (all_frames: true), and a nested frame's window geometry isn't the
  // browser window's, so letting any frame answer could report the wrong Layout.
  let state;
  try {
    state = await chrome.tabs.sendMessage(tab.id, { type: STATE_MESSAGE_TYPE }, { frameId: 0 });
  } catch {
    // No content script in this tab (chrome://, the Web Store, the PDF viewer, ...).
    renderStatusUnavailable();
    return;
  }
  if (!state?.ok) {
    renderStatusUnavailable();
    return;
  }
  renderLayout(state.layout);

  // Live updates while the popup stays open, e.g. the user snaps the window
  // with Win+←/→/↑ without closing the popup or reloading the page.
  try {
    const port = chrome.tabs.connect(tab.id, { name: STATE_PORT_NAME, frameId: 0 });
    port.onMessage.addListener((state) => renderLayout(state.layout));
  } catch {
    // Live updates are a nice-to-have; the initial read above already succeeded.
  }
}

form.addEventListener('change', async (event) => {
  if (event.target.name !== 'mode') return;
  const { store } = await setMode(event.target.value);
  // Deliberately sticky rather than a timed auto-dismiss: while sync stays
  // unavailable the user's choice keeps landing in local storage only, and
  // that's worth surfacing until a write actually reaches sync again.
  warning.hidden = store !== 'local';
});

onSettingsChanged((settings) => applyMode(settings.mode));

getSettings().then((settings) => applyMode(settings.mode));
initStatus();
