import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULTS, SCHEMA_VERSION } from '../../src/shared/settings.js';
import { installChromeMock, makeStorageArea } from '../helpers/chrome-mock.js';

beforeEach(() => {
  delete globalThis.chrome;
  vi.resetModules();
});

describe('service worker onInstalled', () => {
  it('seeds DEFAULTS into sync storage on a fresh install when nothing is stored', async () => {
    const { fireInstalled, sync } = installChromeMock();
    await import('../../src/background/service-worker.js');

    await fireInstalled({ reason: 'install' });

    expect(sync._dump()).toEqual(DEFAULTS);
  });

  it('does not overwrite existing settings on install', async () => {
    const { fireInstalled, sync } = installChromeMock({ sync: makeStorageArea({ mode: 'window' }) });
    await import('../../src/background/service-worker.js');

    await fireInstalled({ reason: 'install' });

    expect(sync._dump()).toEqual({ mode: 'window' });
  });

  it('falls back to local storage when the sync write fails during seeding', async () => {
    const sync = makeStorageArea();
    sync.set = vi.fn(async () => {
      throw new Error('quota exceeded');
    });
    const { fireInstalled, local } = installChromeMock({ sync });
    await import('../../src/background/service-worker.js');

    await fireInstalled({ reason: 'install' });

    expect(local._dump()).toEqual(DEFAULTS);
  });

  it('runs migrate on an update, stamping the current schema version', async () => {
    const { fireInstalled, sync } = installChromeMock({ sync: makeStorageArea({ mode: 'display' }) });
    await import('../../src/background/service-worker.js');

    await fireInstalled({ reason: 'update' });

    expect(sync._dump().schemaVersion).toBe(SCHEMA_VERSION);
    expect(sync._dump().mode).toBe('display');
  });
});
