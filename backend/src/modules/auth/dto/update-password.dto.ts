import { IsString, MinLength, Matches } from 'class-validator';

export class UpdatePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(12)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};:'",./<>?\\|~])[A-Za-z\d!@#$%^&*()_+\-=\[\]{};:'",./<>?\\|~]{12,128}$/,
    {
      message:
        'Password must contain uppercase, lowercase, number, and special character. Minimum length is 12 characters and maximum length is 128 characters.',
    },
  )
  newPassword: string;

  @IsString()
  confirmPassword: string;
}
