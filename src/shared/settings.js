import { MODE } from './constants.js';

export const SCHEMA_VERSION = 1;

export const DEFAULTS = Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  mode: MODE.AUTO,
  advanced: Object.freeze({
    escToExit: true,
    blackBackground: true,
    hideScrollbars: true
  })
});

function isValidMode(value) {
  return Object.values(MODE).includes(value);
}

function mergeDefaults(stored) {
  return {
    schemaVersion: SCHEMA_VERSION,
    mode: isValidMode(stored.mode) ? stored.mode : DEFAULTS.mode,
    advanced: { ...DEFAULTS.advanced, ...(stored.advanced ?? {}) }
  };
}

// No-op at schema v1 — kept as a seam for future schema changes.
export async function migrate(stored) {
  if (stored.schemaVersion === SCHEMA_VERSION) return stored;
  return { ...stored, schemaVersion: SCHEMA_VERSION };
}

// Merges both areas rather than preferring sync outright: once sync has ever
// been seeded it's never empty again, so a later write that fell back to
// local (see writeStorage) would otherwise be masked by stale sync data.
// local only ever holds keys a fallback wrote, so it's the freshest source
// for those keys and safely overrides sync here.
async function readStorage() {
  let synced = {};
  let local = {};
  try {
    synced = await chrome.storage.sync.get(null);
  } catch {
    // sync unavailable; fall through with whatever local has
  }
  try {
    local = await chrome.storage.local.get(null);
  } catch {
    // local unavailable too; synced (if any) is all we have
  }
  return { ...synced, ...local };
}

// Prefers sync (roams with the profile); falls back to local if the sync
// write fails (quota exceeded, sync disabled). Callers should surface a
// warning to the user when the returned store is 'local'.
async function writeStorage(partial) {
  try {
    await chrome.storage.sync.set(partial);
    return 'sync';
  } catch {
    await chrome.storage.local.set(partial);
    return 'local';
  }
}

export async function getSettings() {
  const stored = await readStorage();
  const migrated = await migrate(stored);
  return mergeDefaults(migrated);
}

export async function setMode(mode) {
  if (!isValidMode(mode)) {
    throw new TypeError(`Invalid mode: ${mode}`);
  }
  const store = await writeStorage({ mode });
  return { store };
}

export async function setAdvanced(partial) {
  const current = await getSettings();
  const advanced = { ...current.advanced, ...partial };
  const store = await writeStorage({ advanced });
  return { store };
}

// Seeds DEFAULTS if nothing is stored yet in either area. Used by the
// service worker's onInstalled handler; goes through writeStorage so a
// failed sync write falls back to local like every other write.
export async function seedDefaultsIfEmpty() {
  const stored = await readStorage();
  if (Object.keys(stored).length > 0) return null;
  const store = await writeStorage(DEFAULTS);
  return { store };
}

// Re-persists the migrated form of whatever is currently stored. Used by
// the service worker's onInstalled handler on version bumps.
export async function migrateStoredSettings() {
  const stored = await readStorage();
  const migrated = await migrate(stored);
  const store = await writeStorage(migrated);
  return { store };
}

// Fires with fresh, merged settings whenever sync or local storage changes.
// Returns an unsubscribe function.
export function onSettingsChanged(callback) {
  const listener = (_changes, areaName) => {
    if (areaName !== 'sync' && areaName !== 'local') return;
    getSettings().then(callback);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
