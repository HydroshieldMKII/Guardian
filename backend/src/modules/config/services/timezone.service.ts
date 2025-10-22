import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TimezoneService {
  private readonly logger = new Logger(TimezoneService.name);

  getCurrentTimeInTimezone(timezoneOffset: string): Date {
    try {
      // Parse UTC offset format (e.g., "+02:00", "-05:30")
      const offsetMatch = timezoneOffset.match(/^([+-])(\d{2}):(\d{2})$/);
      if (!offsetMatch) {
        this.logger.warn(
          `Invalid timezone offset format ${timezoneOffset}, falling back to UTC`,
        );
        return new Date();
      }

      const sign = offsetMatch[1] === '+' ? 1 : -1;
      const hours = parseInt(offsetMatch[2], 10);
      const minutes = parseInt(offsetMatch[3], 10);

      // Calculate total offset in milliseconds
      const offsetMs = sign * (hours * 60 + minutes) * 60 * 1000;

      // Get current UTC time and apply the timezone offset
      const now = new Date();
      const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
      const localTime = new Date(utcTime + offsetMs);

      return localTime;
    } catch (error) {
      this.logger.warn(
        `Invalid timezone offset ${timezoneOffset}, falling back to UTC: ${error.message}`,
      );
      return new Date();
    }
  }

  formatTimestamp(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${day}/${month}/${year} ${hours}h${minutes}`;
  }
}