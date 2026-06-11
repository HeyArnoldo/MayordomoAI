import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSourceOptions } from './config/typeorm.config';
import { validateEnv } from './config/env.validation';
import { UsersModule } from './users/users.module';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { BoxesModule } from './boxes/boxes.module';
import { TransactionsModule } from './transactions/transactions.module';
import { AgentModule } from './agent/agent.module';
import { ChatModule } from './chat/chat.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    // El .env ya fue cargado por load-env (main.ts, primera línea).
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate: validateEnv }),
    TypeOrmModule.forRoot(dataSourceOptions),
    UsersModule,
    AdminModule,
    AuthModule,
    BoxesModule,
    TransactionsModule,
    AgentModule,
    ChatModule,
    WhatsappModule,
    HealthModule,
  ],
})
export class AppModule {}
