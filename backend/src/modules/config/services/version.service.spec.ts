import { Test } from '@nestjs/testing';
import { VersionService } from './version.service';

describe('VersionService', () => {
  let service: VersionService;
  let current: string;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [VersionService],
    }).compile();

    service = module.get(VersionService);
    current = service.getCurrentAppVersion();
  });

  const bump = (version: string, delta: number) => {
    const parts = version.split('.').map((p) => parseInt(p) || 0);
    parts[0] += delta;
    return parts.join('.');
  };

  describe('getCurrentAppVersion', () => {
    it('returns a dotted version string', () => {
      expect(current).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('compareVersions', () => {
    it('reports equality', () => {
      expect(service.compareVersions('1.2.3', '1.2.3')).toBe(0);
    });

    it('compares the major segment', () => {
      expect(service.compareVersions('2.0.0', '1.9.9')).toBe(1);
      expect(service.compareVersions('1.9.9', '2.0.0')).toBe(-1);
    });

    it('compares the minor segment', () => {
      expect(service.compareVersions('1.3.0', '1.2.9')).toBe(1);
    });

    it('compares the patch segment', () => {
      expect(service.compareVersions('1.2.4', '1.2.3')).toBe(1);
    });

    it('treats missing segments as zero', () => {
      expect(service.compareVersions('1.2', '1.2.0')).toBe(0);
      expect(service.compareVersions('1.2.1', '1.2')).toBe(1);
    });

    it('compares numerically rather than lexically', () => {
      expect(service.compareVersions('1.10.0', '1.9.0')).toBe(1);
    });

    it('treats unparseable segments as zero', () => {
      expect(service.compareVersions('1.x.0', '1.0.0')).toBe(0);
    });
  });

  describe('updateAppVersionIfNewer', () => {
    it('writes the new version when the code is ahead', async () => {
      const callback = jest.fn().mockResolvedValue(undefined);
      await service.updateAppVersionIfNewer(bump(current, -1), callback);
      expect(callback).toHaveBeenCalledWith(current);
    });

    it('does nothing when the versions match', async () => {
      const callback = jest.fn().mockResolvedValue(undefined);
      await service.updateAppVersionIfNewer(current, callback);
      expect(callback).not.toHaveBeenCalled();
    });

    it('does nothing when the database is ahead', async () => {
      const callback = jest.fn().mockResolvedValue(undefined);
      await service.updateAppVersionIfNewer(bump(current, 1), callback);
      expect(callback).not.toHaveBeenCalled();
    });

    it('swallows a failing callback', async () => {
      const callback = jest.fn().mockRejectedValue(new Error('db down'));
      await expect(
        service.updateAppVersionIfNewer(bump(current, -1), callback),
      ).resolves.toBeUndefined();
    });
  });

  describe('getVersionInfo', () => {
    it('reports no mismatch when the versions match', () => {
      expect(service.getVersionInfo(current)).toEqual({
        version: current,
        databaseVersion: current,
        codeVersion: current,
        isVersionMismatch: false,
      });
    });

    it('reports no mismatch when the database is behind', () => {
      expect(service.getVersionInfo(bump(current, -1)).isVersionMismatch).toBe(
        false,
      );
    });

    it('flags a mismatch when the database is ahead', () => {
      expect(service.getVersionInfo(bump(current, 1)).isVersionMismatch).toBe(
        true,
      );
    });

    it('echoes the supplied database version', () => {
      expect(service.getVersionInfo('0.9.0').databaseVersion).toBe('0.9.0');
    });
  });
});
