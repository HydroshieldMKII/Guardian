import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export const MAX_DEVICE_NAME_LENGTH = 100;

export class RenameDeviceDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_DEVICE_NAME_LENGTH)
  newName: string;
}
