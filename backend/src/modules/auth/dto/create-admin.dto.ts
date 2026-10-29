import { IsString } from 'class-validator';
import { StrongPassword } from '@/modules/auth/dto/strong-password.decorator';
import {
  AccountUsername,
  OptionalAccountEmail,
} from '@/modules/auth/dto/account-fields.decorator';

export class CreateAdminDto {
  @AccountUsername()
  username: string;

  @OptionalAccountEmail('email')
  email?: string | null;

  @StrongPassword()
  password: string;

  @IsString()
  confirmPassword: string;
}
