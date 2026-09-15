import { migrateStoredSettings, seedDefaultsIfEmpty } from '../shared/settings.js';

// MV3 service workers are killed after ~30s idle, so this file must hold no
// in-memory state — everything it does is a one-shot reaction to onInstalled.
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await seedDefaultsIfEmpty();
  } else if (details.reason === 'update') {
    await migrateStoredSettings();
  }
});
