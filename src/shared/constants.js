export const MODE = Object.freeze({ AUTO: 'auto', WINDOW: 'window', DISPLAY: 'display' });

// Single switch for all debug console output (see shared/log.js). Off by
// default for the shipped build; flip to true for local development only.
export const DEBUG = false;

// DOM channel between the ISOLATED Bridge and the MAIN-world Hook (see CONTEXT.md).
export const MODE_ATTR = 'data-snapfit-mode';
export const READY_ATTR = 'data-snapfit-ready';

// Popup <-> Bridge status channel (see SPEC.md §7.3). Settings themselves
// propagate via chrome.storage.onChanged, never this channel.
export const STATE_MESSAGE_TYPE = 'SNAPFIT_GET_STATE';
export const STATE_PORT_NAME = 'snapfit-state-live';

// Pseudo-fullscreen CSS hooks (see SPEC.md §4.1, §6).
export const CLS_ACTIVE = 'snapfit-fs'; // on the fullscreened element
export const CLS_LOCK = 'snapfit-lock'; // on <html> and <body>
export const CLS_NEUTRALIZED = 'snapfit-neutralized'; // on offending ancestors

// Cross-frame escalation postMessage protocol (SPEC.md §9).
export const FRAME_NS = '__snapfit__';
export const FRAME_MSG = Object.freeze({ CLAIM: 'claim', GRANTED: 'granted', RELEASE: 'release' });
