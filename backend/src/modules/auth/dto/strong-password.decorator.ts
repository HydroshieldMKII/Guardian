import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MinLength } from 'class-validator';

const STRONG_PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};:'",./<>?\\|~])[A-Za-z\d!@#$%^&*()_+\-=[\]{};:'",./<>?\\|~]{12,128}$/;

const STRONG_PASSWORD_MESSAGE =
  'Password must contain uppercase, lowercase, number, and special character. Minimum length is 12 characters.';

export const StrongPassword = () =>
  applyDecorators(
    IsString(),
    MinLength(12),
    Matches(STRONG_PASSWORD_PATTERN, { message: STRONG_PASSWORD_MESSAGE }),
  );
