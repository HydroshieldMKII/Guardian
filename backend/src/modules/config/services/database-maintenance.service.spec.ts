import { AppSettings } from '@/entities/app-settings.entity';
import { DatabaseMaintenanceService } from '@/modules/config/services/database-maintenance.service';
import {
  ConfigTestbed,
  createConfigTestbed,
} from '@/modules/config/services/config-testbed.fixture';
import type { ImportRules } from '@/modules/config/services/database-import.service';
import { callArgs } from '@/test-matchers';

describe('DatabaseMaintenanceService', () => {
  let testbed: ConfigTestbed;
  let service: DatabaseMaintenanceService;
  let store: Map<string, AppSettings>;
  let settingsRepo: ConfigTestbed['settingsRepo'];
  let databaseService: ConfigTestbed['databaseService'];
  let databaseImportService: ConfigTestbed['databaseImportService'];
  let versionService: ConfigTestbed['versionService'];

  const build = async () =>
    (await testbed.build()).get(DatabaseMaintenanceService);

  beforeEach(async () => {
    testbed = createConfigTestbed();
    ({
      store,
      settingsRepo,
      databaseService,
      databaseImportService,
      versionService,
    } = testbed);
    service = await build();
  });

  describe('database management', () => {
    it('exports with the stored app version', async () => {
      await expect(service.exportDatabase()).resolves.toBe('{"settings":[]}');
      expect(databaseService.exportDatabase).toHaveBeenCalledWith('1.3.5');
    });

    it('imports and reloads the cache', async () => {
      settingsRepo.find.mockClear();

      await expect(
        service.importDatabase({ data: { settings: [] } }),
      ).resolves.toEqual({
        imported: 5,
        skipped: 1,
      });
      expect(settingsRepo.find).toHaveBeenCalled();
    });

    it('hands the importer the running version and a comparator', async () => {
      await service.importDatabase({ data: { settings: [] } });

      const [, rules] = callArgs<[unknown, ImportRules]>(
        databaseImportService.importDatabase,
      );
      expect(rules.currentAppVersion).toBe('1.3.5');
      rules.compareVersions('1.0.0', '1.3.5');
      expect(versionService.compareVersions).toHaveBeenCalledWith(
        '1.0.0',
        '1.3.5',
      );
    });

    it('hands the importer the same rules the settings page uses', async () => {
      await service.importDatabase({ data: { settings: [] } });

      const [, { validateSetting: validate }] = callArgs<
        [unknown, ImportRules]
      >(databaseImportService.importDatabase);
      expect(() => validate('PLEXGUARD_REFRESH_INTERVAL', '7.5')).toThrow(
        'whole number of seconds',
      );
      expect(() => validate('PLEXGUARD_REFRESH_INTERVAL', '2')).toThrow(
        'at least 5 seconds',
      );
      expect(() => validate('PLEXGUARD_REFRESH_INTERVAL', '30')).not.toThrow();
      expect(() => validate('RETIRED_SETTING', 'x')).not.toThrow();
    });

    it('re-seeds the defaults after a reset', async () => {
      store.clear();
      await service.resetDatabase();

      expect(databaseService.resetDatabase).toHaveBeenCalled();
      expect(store.has('PLEX_TOKEN')).toBe(true);
    });
  });

  describe('settings that were never written', () => {
    it('exports with an empty version rather than a null', async () => {
      settingsRepo.find.mockResolvedValueOnce([]);
      const fresh = await build();
      settingsRepo.findOne.mockResolvedValue(null);

      await fresh.exportDatabase();

      expect(databaseService.exportDatabase).toHaveBeenCalledWith('');
    });
  });
});
