import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { StrongPassword } from '@/modules/auth/dto/strong-password.decorator';

export class RequestPasswordResetDto {
  @IsEmail()
  @MaxLength(255)
  email: string;
}

export class VerifyPasswordResetDto {
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  token: string;
}

export class ConfirmPasswordResetDto {
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  token: string;

  @StrongPassword()
  password: string;

  @IsString()
  confirmPassword: string;
}
