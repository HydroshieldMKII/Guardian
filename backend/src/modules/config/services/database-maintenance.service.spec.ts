import { AppSettings } from '@/entities/app-settings.entity';
import { ConfigService } from '@/modules/config/services/config.service';
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

      const [, { prepareSetting: prepare }] = callArgs<[unknown, ImportRules]>(
        databaseImportService.importDatabase,
      );
      expect(() => prepare('PLEXGUARD_REFRESH_INTERVAL', '7.5')).toThrow(
        'whole number of seconds',
      );
      expect(() => prepare('SMTP_FROM_EMAIL', 'not-an-email')).toThrow(
        'valid email address',
      );
      expect(prepare('PLEXGUARD_REFRESH_INTERVAL', '30')).toBe('30');
      expect(prepare('RETIRED_SETTING', 'x')).toBe('x');
    });

    it('clamps an imported number into the range the settings page allows', async () => {
      await service.importDatabase({ data: { settings: [] } });

      const [, { prepareSetting: prepare }] = callArgs<[unknown, ImportRules]>(
        databaseImportService.importDatabase,
      );
      expect(prepare('PLEXGUARD_REFRESH_INTERVAL', '2')).toBe('5');
      expect(prepare('SMTP_PORT', '70000')).toBe('65535');
      expect(prepare('DEVICE_CLEANUP_INTERVAL_DAYS', '0')).toBe('1');
    });

    it('keeps the extra outcome fields out of the result', async () => {
      databaseImportService.importDatabase.mockResolvedValue({
        imported: 1,
        skipped: 0,
        changedSettings: [],
      });

      await expect(service.importDatabase({ data: {} })).resolves.toEqual({
        imported: 1,
        skipped: 0,
      });
    });

    it('notifies the listeners of every setting the import changed', async () => {
      const listener = jest.fn();
      const module = await testbed.build();
      const configService = module.get(ConfigService);
      const maintenance = module.get(DatabaseMaintenanceService);
      configService.addConfigChangeListener(
        'PLEXGUARD_REFRESH_INTERVAL',
        listener,
      );
      store.set(
        'PLEXGUARD_REFRESH_INTERVAL',
        testbed.row('PLEXGUARD_REFRESH_INTERVAL', '60', 'number'),
      );
      databaseImportService.importDatabase.mockResolvedValue({
        imported: 2,
        skipped: 0,
        changedSettings: [
          { key: 'PLEXGUARD_REFRESH_INTERVAL', value: '60' },
          { key: 'RETIRED_SETTING', value: 'x' },
        ],
      });
      settingsRepo.save.mockClear();

      await maintenance.importDatabase({ data: {} });

      expect(listener).toHaveBeenCalledTimes(1);
      await expect(
        configService.getSetting('PLEXGUARD_REFRESH_INTERVAL'),
      ).resolves.toBe(60);
      expect(settingsRepo.save).not.toHaveBeenCalledWith(
        expect.objectContaining({ key: 'PLEXGUARD_REFRESH_INTERVAL' }),
      );
    });

    it('notifies listeners again when a reset restores the defaults', async () => {
      const module = await testbed.build();
      const listener = jest.fn();
      module
        .get(ConfigService)
        .addConfigChangeListener('PLEXGUARD_REFRESH_INTERVAL', listener);

      await module.get(DatabaseMaintenanceService).resetDatabase();

      expect(listener).toHaveBeenCalledTimes(1);
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
