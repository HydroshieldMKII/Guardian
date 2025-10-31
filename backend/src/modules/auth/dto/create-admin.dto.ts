import { IsEmail, IsString, MinLength, Matches, MaxLength } from 'class-validator';

export class CreateAdminDto {
  @IsString()
  @MinLength(3)
  username: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    {
      message:
        'Password must contain uppercase, lowercase, number, and special character. Minimum length is 12 characters and maximum length is 128 characters.',
    },
  )
  password: string;

  @IsString()
  confirmPassword: string;
}
