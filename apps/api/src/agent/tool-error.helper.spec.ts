import { HttpStatus } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { toolErrorMessage } from './tool-error.helper';

// Minimal I18nService stub.
const makeI18n = () => ({
  t: jest.fn((locale: string, key: string) => `[${locale}] ${key}`),
});

describe('toolErrorMessage', () => {
  let i18n: ReturnType<typeof makeI18n>;

  beforeEach(() => {
    i18n = makeI18n();
  });

  describe('when err is an AppException', () => {
    it('calls i18n.t with the errors namespace key and the user locale', () => {
      const err = new AppException(
        'transaction.not_found',
        HttpStatus.NOT_FOUND,
        'Transaction not found',
      );
      toolErrorMessage(err, 'es', i18n as never);
      expect(i18n.t).toHaveBeenCalledWith('es', 'errors:transaction.not_found', undefined);
    });

    it('returns the translated message from i18n', () => {
      const err = new AppException('box.not_found', HttpStatus.NOT_FOUND, 'Box not found');
      i18n.t.mockReturnValue('Caja no encontrada');
      const result = toolErrorMessage(err, 'es', i18n as never);
      expect(result).toBe('Caja no encontrada');
    });

    it('passes params when AppException has params', () => {
      const err = new AppException('phone.resend_too_soon', HttpStatus.BAD_REQUEST, 'Too soon', {
        seconds: 30,
      });
      toolErrorMessage(err, 'es', i18n as never);
      expect(i18n.t).toHaveBeenCalledWith('es', 'errors:phone.resend_too_soon', { seconds: 30 });
    });

    it('works in English locale', () => {
      const err = new AppException('box.not_found', HttpStatus.NOT_FOUND, 'Box not found');
      i18n.t.mockReturnValue('Box not found');
      const result = toolErrorMessage(err, 'en', i18n as never);
      expect(i18n.t).toHaveBeenCalledWith('en', 'errors:box.not_found', undefined);
      expect(result).toBe('Box not found');
    });
  });

  describe('when err is a generic Error (not AppException)', () => {
    it('returns the generic localized message and never leaks err.message', () => {
      i18n.t.mockReturnValue('Ocurrió un error inesperado');
      const err = new Error('sensitive db detail: column "secret" does not exist');
      const result = toolErrorMessage(err, 'es', i18n as never);
      expect(i18n.t).toHaveBeenCalledWith('es', 'errors:common.unexpected', undefined);
      expect(result).toBe('Ocurrió un error inesperado');
      expect(result).not.toContain('sensitive db detail');
    });

    it('falls back to a static string (not err.message) when i18n is absent', () => {
      const err = new Error('sensitive db detail');
      const result = toolErrorMessage(err, 'en', undefined);
      expect(result.length).toBeGreaterThan(0);
      expect(result).not.toContain('sensitive db detail');
    });
  });

  describe('when err is not an Error instance', () => {
    it('returns a fallback string', () => {
      const result = toolErrorMessage('string error', 'es', i18n as never);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('resolves the fallback via i18n errors:common.unexpected for the locale', () => {
      i18n.t.mockReturnValue('Ocurrió un error inesperado');
      const result = toolErrorMessage('string error', 'es', i18n as never);
      expect(i18n.t).toHaveBeenCalledWith('es', 'errors:common.unexpected', undefined);
      expect(result).toBe('Ocurrió un error inesperado');
    });

    it('falls back to a static string when i18n is absent', () => {
      const result = toolErrorMessage('string error', 'en', undefined);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
