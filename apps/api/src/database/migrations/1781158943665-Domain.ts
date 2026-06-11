import { MigrationInterface, QueryRunner } from 'typeorm';

export class Domain1781158943665 implements MigrationInterface {
  name = 'Domain1781158943665';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "wa_inbound_log" ("waMessageId" character varying(120) NOT NULL, "payload" jsonb NOT NULL, "processedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_916af9b9a79df2bb4784fae5593" PRIMARY KEY ("waMessageId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "phone_numbers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "e164" character varying(20) NOT NULL, "verified" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_f1fa02ebc5845fd9c96ed58b150" UNIQUE ("e164"), CONSTRAINT "PK_a72cf9a1834a1417e195fdd2c02" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE TYPE "public"."boxes_type_enum" AS ENUM('expense', 'fund')`);
    await queryRunner.query(
      `CREATE TYPE "public"."boxes_scope_enum" AS ENUM('personal', 'business')`,
    );
    await queryRunner.query(
      `CREATE TABLE "boxes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "name" character varying(60) NOT NULL, "pct" numeric(5,2) NOT NULL, "type" "public"."boxes_type_enum" NOT NULL DEFAULT 'expense', "scope" "public"."boxes_scope_enum" NOT NULL DEFAULT 'personal', "sortOrder" integer NOT NULL DEFAULT '0', "active" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_749574b01e0038dae8464fcb445" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transactions_type_enum" AS ENUM('income', 'expense', 'transit')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transactions_source_enum" AS ENUM('whatsapp', 'pwa', 'import')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transactions_status_enum" AS ENUM('confirmed', 'pending', 'voided')`,
    );
    await queryRunner.query(
      `CREATE TABLE "transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "type" "public"."transactions_type_enum" NOT NULL, "boxId" uuid, "amount" numeric(12,2) NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'PEN', "date" date NOT NULL, "occurredAt" TIMESTAMP WITH TIME ZONE NOT NULL, "note" character varying(300), "source" "public"."transactions_source_enum" NOT NULL, "status" "public"."transactions_status_enum" NOT NULL DEFAULT 'confirmed', "split" jsonb, "voice" boolean NOT NULL DEFAULT false, "waMessageId" character varying(120), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "UQ_a035d85bb0b5eb2461ad6c91e62" UNIQUE ("waMessageId"), CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_37b152d79fb7b740450c5a7f97" ON "transactions" ("userId", "boxId", "date") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_31c0fafe7c59f688d0e7e7e322" ON "transactions" ("userId", "date") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."conversations_channel_enum" AS ENUM('whatsapp', 'web')`,
    );
    await queryRunner.query(
      `CREATE TABLE "conversations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "channel" "public"."conversations_channel_enum" NOT NULL, "title" character varying(120) NOT NULL DEFAULT 'Nueva conversación', "isSystem" boolean NOT NULL DEFAULT false, "pinned" boolean NOT NULL DEFAULT false, "open" boolean NOT NULL DEFAULT true, "lastAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ee34f4f7ced4ec8681f26bf04ef" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b5a1bb5daf21aebeb5dab2ad61" ON "conversations" ("userId", "lastAt") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."messages_role_enum" AS ENUM('user', 'assistant', 'tool')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."messages_channel_enum" AS ENUM('whatsapp', 'web')`,
    );
    await queryRunner.query(
      `CREATE TABLE "messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conversationId" uuid NOT NULL, "role" "public"."messages_role_enum" NOT NULL, "content" text NOT NULL, "channel" "public"."messages_channel_enum" NOT NULL, "toolCalls" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_751332fc6cc6fc576c6975cd07" ON "messages" ("conversationId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."clarifications_status_enum" AS ENUM('open', 'resolved', 'expired')`,
    );
    await queryRunner.query(
      `CREATE TABLE "clarifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "conversationId" uuid, "description" character varying(300) NOT NULL, "payload" jsonb, "status" "public"."clarifications_status_enum" NOT NULL DEFAULT 'open', "expiresAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_13bbcd97792a5c1663fcd28136f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f07403525216f52e31bf6038a2" ON "clarifications" ("userId", "status") `,
    );
    await queryRunner.query(
      `CREATE TABLE "tool_audits" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "conversationId" uuid, "tool" character varying(80) NOT NULL, "args" jsonb NOT NULL, "result" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d08ac902e3dbc2504cf1321f0c3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ae322a50758e74d94e0d8129f0" ON "tool_audits" ("userId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_status_enum" AS ENUM('pending', 'active', 'suspended')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "status" "public"."users_status_enum" NOT NULL DEFAULT 'pending'`,
    );
    await queryRunner.query(
      `ALTER TABLE "phone_numbers" ADD CONSTRAINT "FK_61f0aacd415edcd3268eab0a4b4" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "boxes" ADD CONSTRAINT "FK_ff2c1d85fc1de34b12fb184e516" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "FK_6bb58f2b6e30cb51a6504599f41" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "FK_d46d39c6b9b06f5ac2d4a291c2c" FOREIGN KEY ("boxId") REFERENCES "boxes"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD CONSTRAINT "FK_a9b3b5d51da1c75242055338b59" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD CONSTRAINT "FK_e5663ce0c730b2de83445e2fd19" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "clarifications" ADD CONSTRAINT "FK_39ced210661048c509c9b2abe44" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tool_audits" ADD CONSTRAINT "FK_c51d99a4dbf745fa7cfcd80af50" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tool_audits" DROP CONSTRAINT "FK_c51d99a4dbf745fa7cfcd80af50"`,
    );
    await queryRunner.query(
      `ALTER TABLE "clarifications" DROP CONSTRAINT "FK_39ced210661048c509c9b2abe44"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "FK_e5663ce0c730b2de83445e2fd19"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP CONSTRAINT "FK_a9b3b5d51da1c75242055338b59"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "FK_d46d39c6b9b06f5ac2d4a291c2c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "FK_6bb58f2b6e30cb51a6504599f41"`,
    );
    await queryRunner.query(`ALTER TABLE "boxes" DROP CONSTRAINT "FK_ff2c1d85fc1de34b12fb184e516"`);
    await queryRunner.query(
      `ALTER TABLE "phone_numbers" DROP CONSTRAINT "FK_61f0aacd415edcd3268eab0a4b4"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "status"`);
    await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ae322a50758e74d94e0d8129f0"`);
    await queryRunner.query(`DROP TABLE "tool_audits"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f07403525216f52e31bf6038a2"`);
    await queryRunner.query(`DROP TABLE "clarifications"`);
    await queryRunner.query(`DROP TYPE "public"."clarifications_status_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_751332fc6cc6fc576c6975cd07"`);
    await queryRunner.query(`DROP TABLE "messages"`);
    await queryRunner.query(`DROP TYPE "public"."messages_channel_enum"`);
    await queryRunner.query(`DROP TYPE "public"."messages_role_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_b5a1bb5daf21aebeb5dab2ad61"`);
    await queryRunner.query(`DROP TABLE "conversations"`);
    await queryRunner.query(`DROP TYPE "public"."conversations_channel_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_31c0fafe7c59f688d0e7e7e322"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_37b152d79fb7b740450c5a7f97"`);
    await queryRunner.query(`DROP TABLE "transactions"`);
    await queryRunner.query(`DROP TYPE "public"."transactions_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."transactions_source_enum"`);
    await queryRunner.query(`DROP TYPE "public"."transactions_type_enum"`);
    await queryRunner.query(`DROP TABLE "boxes"`);
    await queryRunner.query(`DROP TYPE "public"."boxes_scope_enum"`);
    await queryRunner.query(`DROP TYPE "public"."boxes_type_enum"`);
    await queryRunner.query(`DROP TABLE "phone_numbers"`);
    await queryRunner.query(`DROP TABLE "wa_inbound_log"`);
  }
}
