import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Suelo del precio dinámico.
 *
 * Nulable, y esa nulabilidad es la funcionalidad: sin suelo no hay precio
 * dinámico. Las publicaciones que ya existen conservan su precio fijo, que es
 * exactamente lo que sus comercios esperan — nadie debe encontrarse con que su
 * precio empieza a bajar solo por una migración.
 *
 * Como en las anteriores, se descarta el renombrado de claves foráneas que
 * propone el generador sobre merchants y refresh_tokens.
 */
export class PrecioMinimo1786933234921 implements MigrationInterface {
  name = 'PrecioMinimo1786933234921';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rescates" ADD "precio_minimo_centavos" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "rescates" DROP COLUMN "precio_minimo_centavos"`,
    );
  }
}
