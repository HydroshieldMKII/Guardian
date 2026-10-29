import { IsBoolean, ValidateIf } from 'class-validator';

export class UpdateUserPreferenceDto {
  @ValidateIf((_, value) => value !== null)
  @IsBoolean()
  defaultBlock: boolean | null;
}
