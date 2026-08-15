import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Denuncias de publicaciones, para moderación reactiva.
 *
 * El índice único (rescate_id, autor_id) es la regla de negocio, no una
 * optimización: reportar diez veces lo mismo no debe pesar diez veces en la
 * cola. Se aplica en la base de datos porque comprobarlo solo en el servicio
 * deja la puerta abierta a dos peticiones simultáneas.
 *
 * revisado_at va indexado porque la consulta que importa —la cola— filtra
 * siempre por «sin revisar».
 *
 * Sin claves foráneas a rescates ni a users a propósito: un reporte es
 * evidencia de moderación y debe sobrevivir aunque la publicación se borre. El
 * resto del esquema sigue la misma idea con los registros de auditoría.
 *
 * Como en las migraciones anteriores, se descarta el renombrado de claves
 * foráneas que propone el generador sobre merchants y refresh_tokens.
 */
export class Reportes1786800356117 implements MigrationInterface {
  name = 'Reportes1786800356117';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."reportes_motivo_enum" AS ENUM('enganoso', 'precio_incorrecto', 'inseguro', 'no_disponible', 'otro')`,
    );
    await queryRunner.query(
      `CREATE TABLE "reportes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "rescate_id" uuid NOT NULL,
        "autor_id" uuid NOT NULL,
        "motivo" "public"."reportes_motivo_enum" NOT NULL,
        "nota" character varying,
        "revisado_at" TIMESTAMP WITH TIME ZONE,
        "revisado_por" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reportes" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reportes_rescate_id" ON "reportes" ("rescate_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reportes_revisado_at" ON "reportes" ("revisado_at")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_reportes_rescate_autor" ON "reportes" ("rescate_id", "autor_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "reportes"`);
    await queryRunner.query(`DROP TYPE "public"."reportes_motivo_enum"`);
  }
}
