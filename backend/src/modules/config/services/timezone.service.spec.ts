import { Test } from '@nestjs/testing';
import { TimezoneService } from './timezone.service';

describe('TimezoneService', () => {
  let service: TimezoneService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [TimezoneService],
    }).compile();

    service = module.get(TimezoneService);
  });

  describe('getCurrentTimeInTimezone', () => {
    const utcNow = () => {
      const now = new Date();
      return now.getTime() + now.getTimezoneOffset() * 60000;
    };

    it('returns UTC for a zero offset', () => {
      const result = service.getCurrentTimeInTimezone('+00:00');
      expect(Math.abs(result.getTime() - utcNow())).toBeLessThan(2000);
    });

    it('applies a positive whole-hour offset', () => {
      const result = service.getCurrentTimeInTimezone('+02:00');
      expect(result.getTime() - utcNow()).toBeGreaterThan(2 * 3600_000 - 2000);
      expect(result.getTime() - utcNow()).toBeLessThan(2 * 3600_000 + 2000);
    });

    it('applies a negative offset', () => {
      const result = service.getCurrentTimeInTimezone('-05:00');
      expect(utcNow() - result.getTime()).toBeGreaterThan(5 * 3600_000 - 2000);
    });

    it('applies a half-hour offset', () => {
      const result = service.getCurrentTimeInTimezone('+05:30');
      const delta = result.getTime() - utcNow();
      expect(delta).toBeGreaterThan(5.5 * 3600_000 - 2000);
      expect(delta).toBeLessThan(5.5 * 3600_000 + 2000);
    });

    it.each(['', 'UTC', '+2:00', '2:00', 'Europe/Paris', '+02:00:00'])(
      'falls back to server time for the malformed offset %s',
      (offset) => {
        const result = service.getCurrentTimeInTimezone(offset);
        expect(Math.abs(result.getTime() - Date.now())).toBeLessThan(2000);
      },
    );
  });

  describe('formatTimestamp', () => {
    it('formats a date as dd/mm/yyyy hHmm', () => {
      expect(service.formatTimestamp(new Date(2026, 0, 5, 9, 7))).toBe(
        '05/01/2026 9h07',
      );
    });

    it('pads the day and month', () => {
      expect(service.formatTimestamp(new Date(2026, 8, 3, 14, 30))).toBe(
        '03/09/2026 14h30',
      );
    });

    it('pads the minutes but not the hour', () => {
      expect(service.formatTimestamp(new Date(2026, 11, 25, 0, 5))).toBe(
        '25/12/2026 0h05',
      );
    });

    it('handles the last minute of the year', () => {
      expect(service.formatTimestamp(new Date(2026, 11, 31, 23, 59))).toBe(
        '31/12/2026 23h59',
      );
    });
  });
});
