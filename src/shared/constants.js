export const MODE = Object.freeze({ AUTO: 'auto', WINDOW: 'window', DISPLAY: 'display' });

// DOM channel between the ISOLATED Bridge and the MAIN-world Hook (see CONTEXT.md).
export const MODE_ATTR = 'data-snapfit-mode';
export const READY_ATTR = 'data-snapfit-ready';

// Popup <-> Bridge status channel (see SPEC.md §7.3). Settings themselves
// propagate via chrome.storage.onChanged, never this channel.
export const STATE_MESSAGE_TYPE = 'SNAPFIT_GET_STATE';
export const STATE_PORT_NAME = 'snapfit-state-live';
