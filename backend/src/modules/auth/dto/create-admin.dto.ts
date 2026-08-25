import { IsEmail, IsString, MinLength, ValidateIf } from 'class-validator';
import { StrongPassword } from '@/modules/auth/dto/strong-password.decorator';

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

  @StrongPassword()
  password: string;

  @IsString()
  confirmPassword: string;
}
