import { HttpStatus, Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { Request } from 'express';
import { resolveCurrency } from '@app/contracts';
import { AppException } from '../common/errors/app.exception';
import { UsersService } from '../users/users.service';
import { I18nService } from '../i18n/i18n.service';
import type { ToolExecCtx } from '../agent/agent-tool-executor.service';

const uuidSchema = z.string().uuid();

/**
 * Builds the ToolExecCtx for each internal API request.
 *
 * SECURITY: userId is ALWAYS resolved from FOUNDRY_DEMO_USER_ID env var.
 * It is NEVER read from the request body, path params, query params, or headers.
 */
@Injectable()
export class AgentToolsContextService {
  constructor(
    private readonly users: UsersService,
    private readonly i18n: I18nService,
  ) {}

  async build(req: Request): Promise<ToolExecCtx> {
    // Fail-closed: if the env var is absent, this service is not configured.
    const userId = process.env.FOUNDRY_DEMO_USER_ID;
    if (!userId) {
      throw new AppException(
        'agent_tools.demo_user_missing',
        HttpStatus.SERVICE_UNAVAILABLE,
        'FOUNDRY_DEMO_USER_ID is not configured',
      );
    }

    const user = await this.users.findById(userId);
    if (!user) {
      throw new AppException(
        'agent_tools.demo_user_not_found',
        HttpStatus.SERVICE_UNAVAILABLE,
        'Configured demo user does not exist',
      );
    }

    // conversationId: only accept valid uuid to avoid inserting a non-uuid
    // string into the uuid column of tool_audits. Default to null.
    const threadHeader = req.headers['x-conversation-id'] ?? req.headers['x-foundry-thread-id'];
    const thread = typeof threadHeader === 'string' ? threadHeader.trim() : '';
    const conversationId = uuidSchema.safeParse(thread).success ? thread : null;

    return {
      userId: user.id,
      conversationId,
      locale: user.language,
      currency: resolveCurrency(user.currency),
      i18n: this.i18n,
    };
  }
}
