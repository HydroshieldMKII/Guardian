import { BadRequestException, UnauthorizedException } from '@nestjs/common';

export function rethrowAsBadRequest(error: unknown, fallback: string): never {
  if (error instanceof UnauthorizedException) {
    throw error;
  }
  throw new BadRequestException(
    error instanceof Error ? error.message : fallback,
  );
}
