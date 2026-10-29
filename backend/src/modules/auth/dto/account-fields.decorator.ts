import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

const FIELD_MAX_LENGTH = 255;

const AVATAR_SOURCE_PATTERN =
  /^(data:image\/[a-z0-9.+-]+;base64,|https?:\/\/)/i;

const isFilled = (value: unknown) =>
  value !== undefined && value !== null && value !== '';

export const AccountUsername = () =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim() : value,
    ),
    IsString(),
    MinLength(3),
    MaxLength(FIELD_MAX_LENGTH),
  );

export const OptionalAccountEmail = (property: string) =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim() : value,
    ),
    ValidateIf((dto: Record<string, unknown>) => isFilled(dto[property])),
    IsEmail(),
    MaxLength(FIELD_MAX_LENGTH),
  );

export const OptionalAvatarSource = (property: string) =>
  applyDecorators(
    ValidateIf((dto: Record<string, unknown>) => isFilled(dto[property])),
    IsString(),
    Matches(AVATAR_SOURCE_PATTERN, {
      message: 'avatarUrl must be an image upload or an http(s) link',
    }),
  );
