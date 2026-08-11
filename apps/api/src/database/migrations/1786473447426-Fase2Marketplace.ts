import { MigrationInterface, QueryRunner } from 'typeorm';

export class Fase2Marketplace1786473447426 implements MigrationInterface {
  name = 'Fase2Marketplace1786473447426';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_users_email"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_merchants_user_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_refresh_tokens_user_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_refresh_tokens_token_hash"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_audit_logs_action"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_audit_logs_correlation_id"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_notifications_user_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_notifications_status_priority"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_notification_preferences_user_channel"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."rescates_status_enum" AS ENUM('borrador', 'publicado', 'pausado', 'agotado', 'vencido', 'retirado')`,
    );
    await queryRunner.query(
      `CREATE TABLE "rescates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "merchant_id" uuid NOT NULL, "titulo" character varying NOT NULL, "descripcion" text, "categoria" character varying, "precio_centavos" integer NOT NULL, "precio_original_centavos" integer, "moneda" character varying(3) NOT NULL DEFAULT 'USD', "cantidad_total" integer NOT NULL, "cantidad_disponible" integer NOT NULL, "valido_desde" TIMESTAMP WITH TIME ZONE NOT NULL, "valido_hasta" TIMESTAMP WITH TIME ZONE NOT NULL, "status" "public"."rescates_status_enum" NOT NULL DEFAULT 'borrador', "motivo_moderacion" character varying, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_2f8c5c2bc9f7a8935d2613f3af3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_877e84da4f5ed08656d1a9f623" ON "rescates"  ("merchant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cb0068af2682d0b44d9ce35c08" ON "rescates"  ("categoria") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8b045d22634e14aaf1c08b8ddd" ON "rescates"  ("status", "valido_hasta") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."ordenes_status_enum" AS ENUM('creada', 'confirmada', 'cumplida', 'cancelada')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."ordenes_cancelacion_motivo_enum" AS ENUM('comprador', 'comercio', 'no_show', 'expirada', 'admin')`,
    );
    await queryRunner.query(
      `CREATE TABLE "ordenes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "numero" character varying NOT NULL, "comprador_id" uuid NOT NULL, "merchant_id" uuid NOT NULL, "status" "public"."ordenes_status_enum" NOT NULL DEFAULT 'creada', "subtotal_centavos" integer NOT NULL, "descuento_centavos" integer NOT NULL DEFAULT '0', "total_centavos" integer NOT NULL, "moneda" character varying(3) NOT NULL DEFAULT 'USD', "cupon_id" uuid, "cupon_codigo" character varying, "confirmada_at" TIMESTAMP WITH TIME ZONE, "cumplida_at" TIMESTAMP WITH TIME ZONE, "cancelada_at" TIMESTAMP WITH TIME ZONE, "cancelacion_motivo" "public"."ordenes_cancelacion_motivo_enum", "cancelacion_nota" character varying, "expira_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_58713affeb8e3b7b30b9eeeee7a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_48604f2d4270bc3d4d0f1fd422" ON "ordenes"  ("numero") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a2072e46963f99139065af4b4e" ON "ordenes"  ("comprador_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6444af2b3bfd66b918fd9c459f" ON "ordenes"  ("merchant_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_86e9b42397e4ff9acdad0572d5" ON "ordenes"  ("merchant_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_34a4c14bc6e735ad86e94895bd" ON "ordenes"  ("comprador_id", "status") `,
    );
    await queryRunner.query(
      `CREATE TABLE "orden_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "orden_id" uuid NOT NULL, "rescate_id" uuid NOT NULL, "titulo_snapshot" character varying NOT NULL, "precio_unitario_centavos" integer NOT NULL, "cantidad" integer NOT NULL, "total_linea_centavos" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_2e5335f80323aa222772a27d13d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0338075bbe6b4213477f145d66" ON "orden_items"  ("orden_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8cf45b38191511455f016e56be" ON "orden_items"  ("rescate_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."cupones_tipo_enum" AS ENUM('porcentaje', 'monto_fijo')`,
    );
    await queryRunner.query(
      `CREATE TABLE "cupones" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "codigo" character varying NOT NULL, "tipo" "public"."cupones_tipo_enum" NOT NULL, "valor" integer NOT NULL, "moneda" character varying(3) NOT NULL DEFAULT 'USD', "merchant_id" uuid, "minimo_orden_centavos" integer NOT NULL DEFAULT '0', "valido_desde" TIMESTAMP WITH TIME ZONE NOT NULL, "valido_hasta" TIMESTAMP WITH TIME ZONE NOT NULL, "max_usos" integer, "usos" integer NOT NULL DEFAULT '0', "activo" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a1b2382c67ad787ad6316e9f0cd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_5e11e0e4e948543f97ed85d457" ON "cupones"  ("codigo") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_99f5abb549d326d12dac044dab" ON "cupones"  ("merchant_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "resenas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "orden_id" uuid NOT NULL, "autor_id" uuid NOT NULL, "merchant_id" uuid NOT NULL, "rescate_id" uuid NOT NULL, "calificacion" smallint NOT NULL, "comentario" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_8f2c05f4f9be4dfe60ef900d000" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_bee2d2fe2c698907ebaad278bb" ON "resenas"  ("orden_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_915caff28f6bb9a2f58ee37398" ON "resenas"  ("autor_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7ee4db14d29c67c26915020542" ON "resenas"  ("merchant_id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "reputaciones" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "sujeto_tipo" character varying NOT NULL, "sujeto_id" uuid NOT NULL, "suma_calificaciones" integer NOT NULL DEFAULT '0', "total_resenas" integer NOT NULL DEFAULT '0', "ordenes_cumplidas" integer NOT NULL DEFAULT '0', "no_shows" integer NOT NULL DEFAULT '0', "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_2a13bb0adbc2497793e384c007e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_5b1aac7acb386ef8ee99434791" ON "reputaciones"  ("sujeto_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users"  ("email") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_698f612a3134c503f711479a4e" ON "merchants"  ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3ddc983c5f7bcf132fd8732c3f" ON "refresh_tokens"  ("user_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a7838d2ba25be1342091b6695f" ON "refresh_tokens"  ("token_hash") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cee5459245f652b75eb2759b4c" ON "audit_logs"  ("action") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_052f6905a83dedf0d5eeb5e69d" ON "audit_logs"  ("correlation_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9a8a82462cab47c73d25f49261" ON "notifications"  ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_23d8fe4ba82dc75da6794cf366" ON "notifications"  ("status", "priority") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_acf369619023c5a9d1e0e07ff1" ON "notification_preferences"  ("user_id", "channel") `,
    );
    await queryRunner.query(
      `ALTER TABLE "rescates" ADD CONSTRAINT "FK_877e84da4f5ed08656d1a9f6231" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orden_items" ADD CONSTRAINT "FK_0338075bbe6b4213477f145d661" FOREIGN KEY ("orden_id") REFERENCES "ordenes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orden_items" DROP CONSTRAINT "FK_0338075bbe6b4213477f145d661"`,
    );
    await queryRunner.query(
      `ALTER TABLE "rescates" DROP CONSTRAINT "FK_877e84da4f5ed08656d1a9f6231"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_acf369619023c5a9d1e0e07ff1"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_23d8fe4ba82dc75da6794cf366"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9a8a82462cab47c73d25f49261"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_052f6905a83dedf0d5eeb5e69d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cee5459245f652b75eb2759b4c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a7838d2ba25be1342091b6695f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3ddc983c5f7bcf132fd8732c3f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_698f612a3134c503f711479a4e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5b1aac7acb386ef8ee99434791"`,
    );
    await queryRunner.query(`DROP TABLE "reputaciones"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7ee4db14d29c67c26915020542"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_915caff28f6bb9a2f58ee37398"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_bee2d2fe2c698907ebaad278bb"`,
    );
    await queryRunner.query(`DROP TABLE "resenas"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_99f5abb549d326d12dac044dab"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5e11e0e4e948543f97ed85d457"`,
    );
    await queryRunner.query(`DROP TABLE "cupones"`);
    await queryRunner.query(`DROP TYPE "public"."cupones_tipo_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8cf45b38191511455f016e56be"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0338075bbe6b4213477f145d66"`,
    );
    await queryRunner.query(`DROP TABLE "orden_items"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_34a4c14bc6e735ad86e94895bd"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_86e9b42397e4ff9acdad0572d5"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6444af2b3bfd66b918fd9c459f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a2072e46963f99139065af4b4e"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_48604f2d4270bc3d4d0f1fd422"`,
    );
    await queryRunner.query(`DROP TABLE "ordenes"`);
    await queryRunner.query(
      `DROP TYPE "public"."ordenes_cancelacion_motivo_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."ordenes_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8b045d22634e14aaf1c08b8ddd"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cb0068af2682d0b44d9ce35c08"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_877e84da4f5ed08656d1a9f623"`,
    );
    await queryRunner.query(`DROP TABLE "rescates"`);
    await queryRunner.query(`DROP TYPE "public"."rescates_status_enum"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_notification_preferences_user_channel" ON "notification_preferences" USING btree ("user_id", "channel") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_status_priority" ON "notifications" USING btree ("priority", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_user_id" ON "notifications" USING btree ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_correlation_id" ON "audit_logs" USING btree ("correlation_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_action" ON "audit_logs" USING btree ("action") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_refresh_tokens_token_hash" ON "refresh_tokens" USING btree ("token_hash") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_refresh_tokens_user_id" ON "refresh_tokens" USING btree ("user_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_merchants_user_id" ON "merchants" USING btree ("user_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_users_email" ON "users" USING btree ("email") `,
    );
  }
}
