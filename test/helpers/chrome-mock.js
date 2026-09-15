import { vi } from 'vitest';

export function makeStorageArea(initial = {}) {
  let data = { ...initial };
  return {
    get: vi.fn(async (keys) => {
      if (keys === null || keys === undefined) return { ...data };
      const keyList = Array.isArray(keys) ? keys : [keys];
      const result = {};
      for (const key of keyList) if (key in data) result[key] = data[key];
      return result;
    }),
    set: vi.fn(async (partial) => {
      data = { ...data, ...partial };
    }),
    _dump: () => data
  };
}

// Shared fake chrome.* surface for settings.js and service-worker.js tests:
// storage.sync/local (get/set) plus onChanged and runtime.onInstalled
// listener registries the tests can fire manually.
export function installChromeMock({ sync = makeStorageArea(), local = makeStorageArea() } = {}) {
  const changeListeners = [];
  const installedListeners = [];
  globalThis.chrome = {
    runtime: {
      onInstalled: {
        addListener: vi.fn((cb) => installedListeners.push(cb))
      }
    },
    storage: {
      sync,
      local,
      onChanged: {
        addListener: vi.fn((cb) => changeListeners.push(cb)),
        removeListener: vi.fn((cb) => {
          const i = changeListeners.indexOf(cb);
          if (i !== -1) changeListeners.splice(i, 1);
        })
      }
    }
  };
  return {
    sync,
    local,
    fireChange: (changes, areaName) => changeListeners.forEach((cb) => cb(changes, areaName)),
    fireInstalled: (details) => Promise.all(installedListeners.map((cb) => cb(details)))
  };
}
