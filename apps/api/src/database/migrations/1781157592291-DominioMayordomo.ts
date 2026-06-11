import { MigrationInterface, QueryRunner } from 'typeorm';

export class DominioMayordomo1781157592291 implements MigrationInterface {
  name = 'DominioMayordomo1781157592291';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "wa_inbound_log" ("waMessageId" character varying(120) NOT NULL, "payload" jsonb NOT NULL, "processedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_916af9b9a79df2bb4784fae5593" PRIMARY KEY ("waMessageId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "numeros" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "e164" character varying(20) NOT NULL, "verificado" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_2803ad8d3584ad310050caddcb9" UNIQUE ("e164"), CONSTRAINT "PK_afc7d4916c4ae1472683de49489" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE TYPE "public"."cajas_tipo_enum" AS ENUM('gasto', 'fondo')`);
    await queryRunner.query(
      `CREATE TYPE "public"."cajas_ambito_enum" AS ENUM('personal', 'empresa')`,
    );
    await queryRunner.query(
      `CREATE TABLE "cajas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "nombre" character varying(60) NOT NULL, "pct" numeric(5,2) NOT NULL, "tipo" "public"."cajas_tipo_enum" NOT NULL DEFAULT 'gasto', "ambito" "public"."cajas_ambito_enum" NOT NULL DEFAULT 'personal', "orden" integer NOT NULL DEFAULT '0', "activa" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_92b27e5f4ab36a544f37bf45e09" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."movimientos_tipo_enum" AS ENUM('ingreso', 'gasto', 'transito')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."movimientos_origen_enum" AS ENUM('whatsapp', 'pwa', 'import')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."movimientos_estado_enum" AS ENUM('confirmado', 'pendiente', 'anulado')`,
    );
    await queryRunner.query(
      `CREATE TABLE "movimientos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "tipo" "public"."movimientos_tipo_enum" NOT NULL, "cajaId" uuid, "monto" numeric(12,2) NOT NULL, "moneda" character varying(3) NOT NULL DEFAULT 'PEN', "fecha" date NOT NULL, "ocurridoAt" TIMESTAMP WITH TIME ZONE NOT NULL, "nota" character varying(300), "origen" "public"."movimientos_origen_enum" NOT NULL, "estado" "public"."movimientos_estado_enum" NOT NULL DEFAULT 'confirmado', "split" jsonb, "voz" boolean NOT NULL DEFAULT false, "waMessageId" character varying(120), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "UQ_6d72a9d00f6cc0c4ddb2071d5a5" UNIQUE ("waMessageId"), CONSTRAINT "PK_519702aa97def3e7c1b6cc5e2f9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d5425e52f6ea5714ba8df46ccc" ON "movimientos" ("userId", "cajaId", "fecha") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b93960118c979999d91206bab9" ON "movimientos" ("userId", "fecha") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."pendientes_estado_enum" AS ENUM('abierto', 'resuelto', 'expirado')`,
    );
    await queryRunner.query(
      `CREATE TABLE "pendientes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "conversacionId" uuid, "descripcion" character varying(300) NOT NULL, "payload" jsonb, "estado" "public"."pendientes_estado_enum" NOT NULL DEFAULT 'abierto', "expiraAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_210745864fb2008d7708024d110" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9c0bbd60731b4e607e8f856f65" ON "pendientes" ("userId", "estado") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."conversaciones_canal_enum" AS ENUM('whatsapp', 'web')`,
    );
    await queryRunner.query(
      `CREATE TABLE "conversaciones" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "canal" "public"."conversaciones_canal_enum" NOT NULL, "titulo" character varying(120) NOT NULL DEFAULT 'Nueva conversación', "sistema" boolean NOT NULL DEFAULT false, "fijada" boolean NOT NULL DEFAULT false, "abierta" boolean NOT NULL DEFAULT true, "lastAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f66299f2c12dd08b4ae19feefc5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_edd343e07b28db97e4b35bab43" ON "conversaciones" ("userId", "lastAt") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."mensajes_rol_enum" AS ENUM('user', 'assistant', 'tool')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."mensajes_canal_enum" AS ENUM('whatsapp', 'web')`,
    );
    await queryRunner.query(
      `CREATE TABLE "mensajes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conversacionId" uuid NOT NULL, "rol" "public"."mensajes_rol_enum" NOT NULL, "contenido" text NOT NULL, "canal" "public"."mensajes_canal_enum" NOT NULL, "toolCalls" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_20c919d08249bb93d84ce01beb4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f0c71d318468aec8a966554db8" ON "mensajes" ("conversacionId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "audit_tools" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "conversacionId" uuid, "tool" character varying(80) NOT NULL, "args" jsonb NOT NULL, "resultado" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_34dd905bd30d4e23c782dc1d9fb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_82fec94337e1aa017430080474" ON "audit_tools" ("userId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_estado_enum" AS ENUM('pendiente', 'activa', 'suspendida')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "estado" "public"."users_estado_enum" NOT NULL DEFAULT 'pendiente'`,
    );
    await queryRunner.query(
      `ALTER TABLE "numeros" ADD CONSTRAINT "FK_64a3b802b01e9333225b7f3292c" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cajas" ADD CONSTRAINT "FK_c03733efe3496afd4f0622f8a11" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos" ADD CONSTRAINT "FK_33f5a5c5576ccb1b2dd76cca40f" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos" ADD CONSTRAINT "FK_c85e67a67af511a7e11ae3404cc" FOREIGN KEY ("cajaId") REFERENCES "cajas"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "pendientes" ADD CONSTRAINT "FK_89e6f16555cb095f348ccc62889" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversaciones" ADD CONSTRAINT "FK_f94320f96e58f1587d9ec78dae8" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "mensajes" ADD CONSTRAINT "FK_8f80944c63e2f571092225f4dce" FOREIGN KEY ("conversacionId") REFERENCES "conversaciones"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_tools" ADD CONSTRAINT "FK_f6ad37411392c940ff9ac62bf50" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "audit_tools" DROP CONSTRAINT "FK_f6ad37411392c940ff9ac62bf50"`,
    );
    await queryRunner.query(
      `ALTER TABLE "mensajes" DROP CONSTRAINT "FK_8f80944c63e2f571092225f4dce"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversaciones" DROP CONSTRAINT "FK_f94320f96e58f1587d9ec78dae8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pendientes" DROP CONSTRAINT "FK_89e6f16555cb095f348ccc62889"`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos" DROP CONSTRAINT "FK_c85e67a67af511a7e11ae3404cc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "movimientos" DROP CONSTRAINT "FK_33f5a5c5576ccb1b2dd76cca40f"`,
    );
    await queryRunner.query(`ALTER TABLE "cajas" DROP CONSTRAINT "FK_c03733efe3496afd4f0622f8a11"`);
    await queryRunner.query(
      `ALTER TABLE "numeros" DROP CONSTRAINT "FK_64a3b802b01e9333225b7f3292c"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "estado"`);
    await queryRunner.query(`DROP TYPE "public"."users_estado_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_82fec94337e1aa017430080474"`);
    await queryRunner.query(`DROP TABLE "audit_tools"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_f0c71d318468aec8a966554db8"`);
    await queryRunner.query(`DROP TABLE "mensajes"`);
    await queryRunner.query(`DROP TYPE "public"."mensajes_canal_enum"`);
    await queryRunner.query(`DROP TYPE "public"."mensajes_rol_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_edd343e07b28db97e4b35bab43"`);
    await queryRunner.query(`DROP TABLE "conversaciones"`);
    await queryRunner.query(`DROP TYPE "public"."conversaciones_canal_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_9c0bbd60731b4e607e8f856f65"`);
    await queryRunner.query(`DROP TABLE "pendientes"`);
    await queryRunner.query(`DROP TYPE "public"."pendientes_estado_enum"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_b93960118c979999d91206bab9"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_d5425e52f6ea5714ba8df46ccc"`);
    await queryRunner.query(`DROP TABLE "movimientos"`);
    await queryRunner.query(`DROP TYPE "public"."movimientos_estado_enum"`);
    await queryRunner.query(`DROP TYPE "public"."movimientos_origen_enum"`);
    await queryRunner.query(`DROP TYPE "public"."movimientos_tipo_enum"`);
    await queryRunner.query(`DROP TABLE "cajas"`);
    await queryRunner.query(`DROP TYPE "public"."cajas_ambito_enum"`);
    await queryRunner.query(`DROP TYPE "public"."cajas_tipo_enum"`);
    await queryRunner.query(`DROP TABLE "numeros"`);
    await queryRunner.query(`DROP TABLE "wa_inbound_log"`);
  }
}
