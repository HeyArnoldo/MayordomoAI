import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { AppException } from './app.exception';
import { HttpExceptionFilter } from '../filters/http-exception.filter';

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
    it('passes the { statusCode, code, message } body through verbatim', () => {
      const ex = new AppException('auth.forbidden', HttpStatus.FORBIDDEN, 'Forbidden');

      const json = jest.fn();
      const status = jest.fn().mockReturnValue({ json });
      const host = {
        switchToHttp: () => ({ getResponse: () => ({ status }) }),
      } as unknown as ArgumentsHost;

      new HttpExceptionFilter().catch(ex, host);

      expect(status).toHaveBeenCalledWith(403);
      expect(json).toHaveBeenCalledWith({
        statusCode: 403,
        code: 'auth.forbidden',
        message: 'Forbidden',
      });
    });

    it('emits a coded 500 fallback for uncaught non-HttpException errors', () => {
      const json = jest.fn();
      const status = jest.fn().mockReturnValue({ json });
      const host = {
        switchToHttp: () => ({ getResponse: () => ({ status }) }),
      } as unknown as ArgumentsHost;

      new HttpExceptionFilter().catch(new Error('boom'), host);

      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith({
        statusCode: 500,
        code: 'server.internal_error',
        message: 'Internal server error',
      });
    });
  });
});
