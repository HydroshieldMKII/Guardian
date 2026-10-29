import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { AppModule } from '@/app.module';
import { DeviceTrackingService } from '@/modules/devices/services/device-tracking.service';

type ModuleClass = { name: string };

const isForwardRef = (entry: unknown): entry is { forwardRef: () => unknown } =>
  typeof entry === 'object' && entry !== null && 'forwardRef' in entry;

const moduleClass = (entry: unknown): ModuleClass | null => {
  const resolved = isForwardRef(entry) ? entry.forwardRef() : entry;
  return typeof resolved === 'function' ? resolved : null;
};

const metadataList = (target: ModuleClass, key: string): unknown[] => {
  const value: unknown = Reflect.getMetadata(key, target);
  return Array.isArray(value) ? value : [];
};

const reachableModules = (root: ModuleClass): ModuleClass[] => {
  const seen = new Set<ModuleClass>();
  const visit = (module: ModuleClass) => {
    if (seen.has(module)) return;
    seen.add(module);
    for (const entry of metadataList(module, MODULE_METADATA.IMPORTS)) {
      const imported = moduleClass(entry);
      if (imported) visit(imported);
    }
  };
  visit(root);
  return [...seen];
};

describe('AppModule wiring', () => {
  it('provides each service from exactly one module', () => {
    const owners = new Map<string, string[]>();
    for (const module of reachableModules(AppModule)) {
      for (const provider of metadataList(module, MODULE_METADATA.PROVIDERS)) {
        if (typeof provider !== 'function') continue;
        owners.set(provider.name, [
          ...(owners.get(provider.name) ?? []),
          module.name,
        ]);
      }
    }

    const duplicated = [...owners].filter(([, modules]) => modules.length > 1);
    expect(duplicated).toEqual([]);
  });

  it('builds the whole application with one device tracker', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'guardian-app-'));
    const previousPath = process.env.DATABASE_PATH;
    process.env.DATABASE_PATH = join(directory, 'guardian.db');
    try {
      const app = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      const trackers = app.get(DeviceTrackingService, {
        each: true,
        strict: false,
      });
      await app.close();

      expect(trackers).toHaveLength(1);
    } finally {
      process.env.DATABASE_PATH = previousPath;
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
