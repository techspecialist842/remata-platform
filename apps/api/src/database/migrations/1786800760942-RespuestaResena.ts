import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Réplica del comercio a una reseña.
 *
 * Nulable: las reseñas que ya existen no tienen respuesta y su comercio puede
 * contestarlas cuando quiera. No hay columna de nota nueva porque la respuesta
 * no altera la calificación — esa es de quien compró.
 *
 * Como en las migraciones anteriores, se descarta el renombrado de claves
 * foráneas que propone el generador sobre merchants y refresh_tokens.
 */
export class RespuestaResena1786800760942 implements MigrationInterface {
  name = 'RespuestaResena1786800760942';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "resenas" ADD "respuesta" text`);
    await queryRunner.query(
      `ALTER TABLE "resenas" ADD "respondida_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "resenas" DROP COLUMN "respondida_at"`,
    );
    await queryRunner.query(`ALTER TABLE "resenas" DROP COLUMN "respuesta"`);
  }
}
