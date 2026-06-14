import { Test } from '@nestjs/testing';
import { AgentToolsContextService } from './agent-tools-context.service';
import { UsersService } from '../users/users.service';
import { I18nService } from '../i18n/i18n.service';

/**
 * DI regression test.
 *
 * Guards against the boot crash where `private readonly i18n: Pick<I18nService, 't'>`
 * made Nest emit the runtime token `Object` (via emitDecoratorMetadata), which is
 * not a provider — so resolving AgentToolsContextService threw at bootstrap and
 * crashed the ENTIRE API (AgentToolsApiModule is imported in AppModule).
 *
 * Unit tests using `new` cannot catch this; only Nest DI resolution does.
 * We compile a minimal module (NOT AppModule, which needs a real DB) and assert
 * the service resolves without throwing.
 *
 * This FAILS against the `Pick<>` version and PASSES with the concrete I18nService.
 */
describe('AgentToolsContextService — Nest DI resolution', () => {
  it('resolves via Nest DI without throwing', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AgentToolsContextService,
        { provide: UsersService, useValue: { findById: jest.fn() } },
        { provide: I18nService, useValue: { t: jest.fn() } },
      ],
    }).compile();

    const service = moduleRef.get(AgentToolsContextService);
    expect(service).toBeInstanceOf(AgentToolsContextService);

    await moduleRef.close();
  });
});
