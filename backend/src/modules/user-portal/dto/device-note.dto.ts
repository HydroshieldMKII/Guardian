import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export const DEVICE_NOTE_MAX_LENGTH = 500;

export class DeviceNoteDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(DEVICE_NOTE_MAX_LENGTH)
  description?: string;
}
