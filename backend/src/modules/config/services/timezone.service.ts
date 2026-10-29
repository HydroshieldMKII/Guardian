import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TimezoneService {
  private readonly logger = new Logger(TimezoneService.name);

  getCurrentTimeInTimezone(timezoneOffset: string, now = new Date()): Date {
    const offsetMatch = timezoneOffset.match(/^([+-])(\d{2}):(\d{2})$/);
    if (!offsetMatch) {
      this.logger.warn(
        `Invalid timezone offset format ${timezoneOffset}, falling back to UTC`,
      );
      return new Date(now.getTime());
    }

    const sign = offsetMatch[1] === '+' ? 1 : -1;
    const hours = parseInt(offsetMatch[2], 10);
    const minutes = parseInt(offsetMatch[3], 10);
    const offsetMs = sign * (hours * 60 + minutes) * 60 * 1000;

    return new Date(now.getTime() + offsetMs);
  }

  formatTimestamp(date: Date): string {
    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = date.getUTCFullYear();
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');

    return `${day}/${month}/${year} ${hours}h${minutes}`;
  }
}
