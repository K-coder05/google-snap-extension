import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULTS, SCHEMA_VERSION, getSettings, migrate, migrateStoredSettings, onSettingsChanged, seedDefaultsIfEmpty, setAdvanced, setMode } from '../../src/shared/settings.js';
import { installChromeMock, makeStorageArea } from '../helpers/chrome-mock.js';

beforeEach(() => {
  delete globalThis.chrome;
});

describe('getSettings', () => {
  it('returns DEFAULTS when storage is empty', async () => {
    installChromeMock();
    await expect(getSettings()).resolves.toEqual(DEFAULTS);
  });

  it('merges a partial stored object over DEFAULTS', async () => {
    installChromeMock({ sync: makeStorageArea({ mode: 'window' }) });
    const settings = await getSettings();
    expect(settings.mode).toBe('window');
    expect(settings.advanced).toEqual(DEFAULTS.advanced);
  });

  it('merges partial advanced settings without dropping unset keys', async () => {
    installChromeMock({ sync: makeStorageArea({ advanced: { escToExit: false } }) });
    const settings = await getSettings();
    expect(settings.advanced).toEqual({ ...DEFAULTS.advanced, escToExit: false });
  });

  it('falls back to local storage when sync has nothing stored', async () => {
    const { local } = installChromeMock({
      sync: makeStorageArea(),
      local: makeStorageArea({ mode: 'display' })
    });
    const settings = await getSettings();
    expect(settings.mode).toBe('display');
    expect(local.get).toHaveBeenCalled();
  });

  it('falls back to local storage when the sync read throws', async () => {
    const sync = makeStorageArea();
    sync.get = vi.fn(async () => {
      throw new Error('sync unavailable');
    });
    installChromeMock({ sync, local: makeStorageArea({ mode: 'display' }) });
    const settings = await getSettings();
    expect(settings.mode).toBe('display');
  });

  it('ignores an invalid stored mode and falls back to the default', async () => {
    installChromeMock({ sync: makeStorageArea({ mode: 'bogus' }) });
    const settings = await getSettings();
    expect(settings.mode).toBe(DEFAULTS.mode);
  });
});

describe('setMode', () => {
  it('rejects a value outside the MODE enum', async () => {
    installChromeMock();
    await expect(setMode('bogus')).rejects.toThrow(TypeError);
  });

  it('writes a valid mode to sync storage', async () => {
    const { sync } = installChromeMock();
    const result = await setMode('window');
    expect(result.store).toBe('sync');
    expect(sync.set).toHaveBeenCalledWith({ mode: 'window' });
  });

  it('falls back to local storage and reports the fallback when the sync write fails', async () => {
    const sync = makeStorageArea();
    sync.set = vi.fn(async () => {
      throw new Error('quota exceeded');
    });
    const { local } = installChromeMock({ sync });
    const result = await setMode('display');
    expect(result.store).toBe('local');
    expect(local.set).toHaveBeenCalledWith({ mode: 'display' });
  });
});

describe('setAdvanced', () => {
  it('merges a partial update into the existing advanced settings', async () => {
    const { sync } = installChromeMock({ sync: makeStorageArea({ advanced: { escToExit: false } }) });
    const result = await setAdvanced({ blackBackground: false });
    expect(result.store).toBe('sync');
    expect(sync.set).toHaveBeenCalledWith({
      advanced: { escToExit: false, blackBackground: false, hideScrollbars: true }
    });
  });
});

describe('migrate', () => {
  it('is a no-op at the current schema version', async () => {
    const stored = { schemaVersion: SCHEMA_VERSION, mode: 'window' };
    await expect(migrate(stored)).resolves.toEqual(stored);
  });

  it('stamps a missing schemaVersion with the current version', async () => {
    const migrated = await migrate({ mode: 'window' });
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
  });
});

describe('seedDefaultsIfEmpty', () => {
  it('writes DEFAULTS when nothing is stored in either area', async () => {
    const { sync } = installChromeMock();
    const result = await seedDefaultsIfEmpty();
    expect(result.store).toBe('sync');
    expect(sync.set).toHaveBeenCalledWith(DEFAULTS);
  });

  it('does nothing when a value is already stored', async () => {
    const { sync } = installChromeMock({ sync: makeStorageArea({ mode: 'window' }) });
    const result = await seedDefaultsIfEmpty();
    expect(result).toBeNull();
    expect(sync.set).not.toHaveBeenCalled();
  });

  it('falls back to local storage when the sync write fails', async () => {
    const sync = makeStorageArea();
    sync.set = vi.fn(async () => {
      throw new Error('quota exceeded');
    });
    const { local } = installChromeMock({ sync });
    const result = await seedDefaultsIfEmpty();
    expect(result.store).toBe('local');
    expect(local.set).toHaveBeenCalledWith(DEFAULTS);
  });
});

describe('migrateStoredSettings', () => {
  it('re-persists the migrated form of whatever is currently stored', async () => {
    const { sync } = installChromeMock({ sync: makeStorageArea({ mode: 'display' }) });
    const result = await migrateStoredSettings();
    expect(result.store).toBe('sync');
    expect(sync.set).toHaveBeenCalledWith({ mode: 'display', schemaVersion: SCHEMA_VERSION });
  });
});

describe('onSettingsChanged', () => {
  it('invokes the callback with fresh merged settings when sync storage changes', async () => {
    const { sync, fireChange } = installChromeMock({ sync: makeStorageArea({ mode: 'auto' }) });
    const cb = vi.fn();
    onSettingsChanged(cb);

    await sync.set({ mode: 'window' });
    fireChange({ mode: { newValue: 'window' } }, 'sync');
    await vi.waitFor(() => expect(cb).toHaveBeenCalled());

    expect(cb.mock.calls[0][0].mode).toBe('window');
  });

  it('ignores changes to unrelated storage areas', () => {
    const { fireChange } = installChromeMock();
    const cb = vi.fn();
    onSettingsChanged(cb);
    fireChange({}, 'managed');
    expect(cb).not.toHaveBeenCalled();
  });

  it('returns an unsubscribe function that stops future callbacks', async () => {
    const { fireChange } = installChromeMock();
    const cb = vi.fn();
    const unsubscribe = onSettingsChanged(cb);
    unsubscribe();
    fireChange({}, 'sync');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(cb).not.toHaveBeenCalled();
  });
});
