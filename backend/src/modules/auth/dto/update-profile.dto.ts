import { IsOptional } from 'class-validator';
import {
  AccountUsername,
  OptionalAccountEmail,
  OptionalAvatarSource,
} from '@/modules/auth/dto/account-fields.decorator';

export class UpdateProfileDto {
  @IsOptional()
  @AccountUsername()
  username?: string;

  @OptionalAccountEmail('email')
  email?: string | null;

  @OptionalAvatarSource('avatarUrl')
  avatarUrl?: string | null;
}
