import {
  IsString,
  MinLength,
  Matches,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class UpdatePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(12)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};:'",./<>?\\|~])[A-Za-z\d!@#$%^&*()_+\-=[\]{};:'",./<>?\\|~]{12,128}$/,
    {
      message:
        'Password must contain uppercase, lowercase, number, and special character. Minimum length is 12 characters.',
    },
  )
  newPassword: string;

  @IsString()
  confirmPassword: string;

  @IsOptional()
  @IsBoolean()
  clearSessions?: boolean;
}
