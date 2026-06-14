import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module';
import { UsersModule } from '../users/users.module';
import { AgentToolsController } from './agent-tools.controller';
import { AgentToolsAuthGuard } from './agent-tools-auth.guard';
import { AgentToolsContextService } from './agent-tools-context.service';

/**
 * Internal REST layer for agent tools exposed to the MCP server.
 *
 * Imports AgentModule to access AgentToolExecutorService (exported from there).
 * UsersModule provides UsersService for context resolution.
 * I18nModule is @Global() so I18nService is available without explicit import.
 */
@Module({
  imports: [AgentModule, UsersModule],
  controllers: [AgentToolsController],
  providers: [AgentToolsAuthGuard, AgentToolsContextService],
})
export class AgentToolsApiModule {}
