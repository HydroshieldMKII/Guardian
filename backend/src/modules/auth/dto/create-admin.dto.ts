import {
  IsEmail,
  IsString,
  MinLength,
  Matches,
  ValidateIf,
} from 'class-validator';

export class CreateAdminDto {
  @IsString()
  @MinLength(3)
  username: string;

  @ValidateIf(
    (o: CreateAdminDto) =>
      o.email !== undefined && o.email !== null && o.email !== '',
  )
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(12)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};:'",./<>?\\|~])[A-Za-z\d!@#$%^&*()_+\-=[\]{};:'",./<>?\\|~]{12,128}$/,
    {
      message:
        'Password must contain uppercase, lowercase, number, and special character. Minimum length is 12 characters.',
    },
  )
  password: string;

  @IsString()
  confirmPassword: string;
}
