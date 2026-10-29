import { HttpException, HttpStatus } from '@nestjs/common';
import { errorMessage } from '@/common/utils/error-types';

export interface FailureOptions {
  status?: HttpStatus;
  exposeCause?: boolean;
}

export const respondOrFail = async <T>(
  work: () => Promise<T>,
  fallback: string,
  {
    status = HttpStatus.INTERNAL_SERVER_ERROR,
    exposeCause = false,
  }: FailureOptions = {},
): Promise<T> => {
  try {
    return await work();
  } catch (error) {
    if (error instanceof HttpException) throw error;
    throw new HttpException(
      (exposeCause && errorMessage(error)) || fallback,
      status,
    );
  }
};
