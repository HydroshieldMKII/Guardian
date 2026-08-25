import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { StrongPassword } from '@/modules/auth/dto/strong-password.decorator';

export class UpdatePasswordDto {
  @IsString()
  currentPassword: string;

  @StrongPassword()
  newPassword: string;

  @IsString()
  confirmPassword: string;

  @IsOptional()
  @IsBoolean()
  clearSessions?: boolean;
}
