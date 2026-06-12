import { HttpStatus } from '@nestjs/common';
import { AppException } from './app.exception';

describe('AppException', () => {
  describe('body shape', () => {
    it('produces the canonical { statusCode, code, message } body', () => {
      const ex = new AppException(
        'auth.invalid_credentials',
        HttpStatus.UNAUTHORIZED,
        'Invalid credentials',
      );

      expect(ex.getStatus()).toBe(401);
      const body = ex.getResponse() as Record<string, unknown>;
      expect(body).toEqual({
        statusCode: 401,
        code: 'auth.invalid_credentials',
        message: 'Invalid credentials',
      });
    });

    it('omits params from body when not provided', () => {
      const ex = new AppException(
        'server.internal_error',
        HttpStatus.INTERNAL_SERVER_ERROR,
        'Oops',
      );
      const body = ex.getResponse() as Record<string, unknown>;
      expect(body).not.toHaveProperty('params');
    });
  });

  describe('params passthrough', () => {
    it('includes params in the body when provided', () => {
      const ex = new AppException(
        'phone.resend_too_soon',
        HttpStatus.BAD_REQUEST,
        'Wait before resending',
        { seconds: 30 },
      );

      const body = ex.getResponse() as Record<string, unknown>;
      expect(body).toEqual({
        statusCode: 400,
        code: 'phone.resend_too_soon',
        message: 'Wait before resending',
        params: { seconds: 30 },
      });
    });

    it('exposes the code via the public readonly property', () => {
      const ex = new AppException('chat.audio_missing', HttpStatus.BAD_REQUEST, 'Audio missing');
      expect(ex.code).toBe('chat.audio_missing');
    });

    it('exposes params via the public readonly property', () => {
      const ex = new AppException('phone.resend_too_soon', HttpStatus.BAD_REQUEST, 'Too soon', {
        seconds: 60,
      });
      expect(ex.params).toEqual({ seconds: 60 });
    });
  });

  describe('HttpExceptionFilter regression', () => {
    it('getResponse() returns an object (not a string), so the filter passes it through verbatim', () => {
      const ex = new AppException('auth.forbidden', HttpStatus.FORBIDDEN, 'Forbidden');
      expect(typeof ex.getResponse()).toBe('object');
    });
  });
});
