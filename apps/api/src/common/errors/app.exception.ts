import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from '@app/contracts';

/**
 * Canonical exception for all user-facing API errors.
 *
 * Guarantees the response body shape:
 *   { statusCode, code, message, params? }
 *
 * Use this for every throw that reaches the client. Never throw a raw
 * HttpException with only a string message in in-scope files.
 *
 * @example
 *   throw new AppException('auth.invalid_credentials', HttpStatus.UNAUTHORIZED, 'Invalid credentials');
 *   // → 401  { "statusCode": 401, "code": "auth.invalid_credentials", "message": "Invalid credentials" }
 */
export class AppException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    status: HttpStatus,
    message: string,
    readonly params?: Record<string, string | number>,
  ) {
    super(
      {
        statusCode: status,
        code,
        message,
        ...(params && { params }),
      },
      status,
    );
  }
}
