import {
  IsString,
  IsEmail,
  IsOptional,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  username?: string;

  @ValidateIf(
    (o: UpdateProfileDto) =>
      o.email !== undefined && o.email !== null && o.email !== '',
  )
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
