# Snapfit — Fit-to-Window Fullscreen

A Chrome extension that lets you choose whether a page's fullscreen request fills
the whole display or just the browser window, so a snapped/split-screen browser
window doesn't get covered by native fullscreen.

On Windows, `Win + ←/→` snaps a browser window to half the display. Pressing
fullscreen on a video normally takes over the **entire display**, covering
whatever's on the other half. Snapfit gives you a persistent choice, set from the
toolbar popup:

| Mode | Behavior when a page requests fullscreen |
|---|---|
| **Auto** (default) | Window maximized → native fullscreen. Window snapped/floating → fit-to-window. |
| **Fit window** | Always fills just the browser window, never the other half of the display. |
| **Full display** | Always native fullscreen (stock Chrome behavior). |

The choice persists across browser restarts and syncs across your signed-in Chrome
profiles via `chrome.storage.sync`.

## Setup

Requires Node 18+ and Chrome/Chromium 111+ (`world: "MAIN"` content scripts, which
the fullscreen hook depends on, need 111+).

```sh
npm install
npm run build      # bundles src/ into dist/
```

Then load it unpacked:

1. Visit `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this repository's root folder (the one
   containing `manifest.json`).

`npm run watch` rebuilds `dist/` on file change; reload the extension from
`chrome://extensions` (or just the affected tab) to pick up changes.

Other scripts:

```sh
npm test          # unit tests (Vitest)
npm run test:e2e  # end-to-end tests (Playwright, loads the built extension)
npm run lint      # ESLint
```

## How it works, briefly

An extension cannot make the native Fullscreen API cover only part of a display —
`Element.requestFullscreen()` always allocates the whole screen. So **Fit window**
mode isn't native fullscreen at all: it's a *pseudo-fullscreen* that promotes the
requested element to a fixed-position, viewport-filling overlay inside the page,
without ever calling the real Fullscreen API. **Full display** mode is an
unmodified passthrough to the native API.

See [`CONTEXT.md`](CONTEXT.md) for the project's domain vocabulary and
[`SPEC.md`](SPEC.md) for the full implementation spec.

## Non-goals and known limitations

These are the honest edges of what a browser extension can do here — not bugs:

- **Browser chrome stays visible in Fit window mode.** The video fills the
  viewport, not the entire half of the monitor the browser window is snapped to.
  No extension API can hide the tab strip or address bar without going to real,
  whole-display fullscreen.
- **Not in the browser's top layer.** Pseudo-fullscreen is a page-level overlay
  (`position: fixed`, maximum `z-index`), not the OS/compositor top layer that
  native fullscreen uses. A page element inserted later in the DOM with its own
  maximal `z-index` can, in rare cases, paint above it. Native fullscreen can't be
  beaten this way; this is unfixable without reparenting the player into a
  top-layer API, which breaks too many real players to attempt in v1.
- **Multi-monitor setups are out of scope.** `window.screen` reports the primary
  display's metrics in some configurations, which can misclassify the window's
  layout when the browser sits on a secondary monitor.
- **DRM-heavy custom players** (e.g. Netflix, Disney+) may fight the overlay or
  reassert their own fullscreen styling. **Auto** and **Full display** modes still
  work normally on these sites.
- **A page that captures a reference to `Element.prototype.requestFullscreen`
  before this extension's `document_start` script runs** can't be intercepted. In
  practice this doesn't happen — Snapfit's hook is guaranteed to run before any
  page script.
- **Firefox, Safari, and mobile are not supported.** Chrome/Chromium only
  (Manifest V3).

Snapfit makes no network requests, collects no analytics, and stores nothing
beyond your one mode preference.

## Store listing copy

**Single purpose:** Let the user choose whether video fullscreen fills the whole
display or just the browser window.

**Permission justifications:**

- `storage` — Persist the user's single fullscreen-mode preference (`auto` /
  `window` / `display`). Nothing else is stored.
- `host_permissions` (`<all_urls>`) — The extension must be able to intercept the
  Fullscreen API on any site the user watches video on, and there is no way to
  know in advance which sites those will be. No page content is read, stored, or
  transmitted; the extension makes no network requests of its own.

**Data disclosure:** No data is collected. No data is transmitted anywhere. Every
"does this extension collect X" checkbox in the Chrome Web Store listing should be
answered "no."
