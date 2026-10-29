import { Test } from '@nestjs/testing';
import { TimezoneService } from '@/modules/config/services/timezone.service';

describe('TimezoneService', () => {
  let service: TimezoneService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [TimezoneService],
    }).compile();

    service = module.get(TimezoneService);
  });

  describe('getCurrentTimeInTimezone', () => {
    const instant = new Date('2026-01-05T18:33:00.000Z');

    it('returns the same wall clock for a zero offset', () => {
      const result = service.getCurrentTimeInTimezone('+00:00', instant);
      expect(result.toISOString()).toBe('2026-01-05T18:33:00.000Z');
    });

    it('applies a positive whole-hour offset', () => {
      const result = service.getCurrentTimeInTimezone('+02:00', instant);
      expect(result.toISOString()).toBe('2026-01-05T20:33:00.000Z');
    });

    it('applies a negative offset across midnight', () => {
      const result = service.getCurrentTimeInTimezone('-19:00', instant);
      expect(result.toISOString()).toBe('2026-01-04T23:33:00.000Z');
    });

    it('applies a half-hour offset', () => {
      const result = service.getCurrentTimeInTimezone('+05:30', instant);
      expect(result.toISOString()).toBe('2026-01-06T00:03:00.000Z');
    });

    it('falls back to the real instant for an invalid format', () => {
      const result = service.getCurrentTimeInTimezone('Europe/Paris', instant);
      expect(result.toISOString()).toBe(instant.toISOString());
    });

    it('defaults to the current time', () => {
      const result = service.getCurrentTimeInTimezone('+00:00');
      expect(Math.abs(result.getTime() - Date.now())).toBeLessThan(2000);
    });

    describe('under a non-UTC process zone', () => {
      const originalZone = process.env.TZ;

      afterEach(() => {
        if (originalZone === undefined) {
          delete process.env.TZ;
        } else {
          process.env.TZ = originalZone;
        }
      });

      it.each(['America/New_York', 'Asia/Kolkata', 'Pacific/Auckland'])(
        'gives the same wall clock under %s',
        (zone) => {
          process.env.TZ = zone;
          const result = service.getCurrentTimeInTimezone('+00:00', instant);
          expect(result.getUTCDay()).toBe(1);
          expect(result.getUTCHours()).toBe(18);
          expect(result.getUTCMinutes()).toBe(33);
          expect(service.formatTimestamp(result)).toBe('05/01/2026 18h33');
        },
      );
    });
  });

  describe('formatTimestamp', () => {
    it('formats a date as dd/mm/yyyy hHmm', () => {
      expect(
        service.formatTimestamp(new Date(Date.UTC(2026, 7, 21, 9, 7))),
      ).toBe('21/08/2026 9h07');
    });

    it('pads the day and month', () => {
      expect(
        service.formatTimestamp(new Date(Date.UTC(2026, 8, 3, 14, 30))),
      ).toBe('03/09/2026 14h30');
    });

    it('pads the minutes but not the hour', () => {
      expect(
        service.formatTimestamp(new Date(Date.UTC(2026, 11, 25, 0, 5))),
      ).toBe('25/12/2026 0h05');
    });

    it('handles the last minute of the year', () => {
      expect(
        service.formatTimestamp(new Date(Date.UTC(2026, 11, 31, 23, 59))),
      ).toBe('31/12/2026 23h59');
    });
  });
});
