import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Señales de posible amaño en una reseña.
 *
 * `senales` es jsonb y nulable: la mayoría de las reseñas no dispara ninguna, y
 * guardar `[]` en todas ellas ocuparía sitio para decir lo mismo que un NULL.
 * Se guardan en vez de recalcularse porque describen el momento de la compra, y
 * ese momento no vuelve.
 *
 * `sospechosa` nace en false, así que las reseñas que ya existen quedan sin
 * marcar. Es lo correcto: no se evaluaron cuando se crearon y evaluarlas ahora
 * daría un resultado falso —ninguna cuenta sigue siendo nueva—.
 *
 * El índice es parcial, sobre las marcadas. La cola de revisión solo pregunta
 * por ellas, y serán una fracción mínima de la tabla.
 *
 * Como en las migraciones anteriores, se descarta el renombrado de claves
 * foráneas que propone el generador sobre merchants y refresh_tokens.
 */
export class SenalesResena1786933978568 implements MigrationInterface {
  name = 'SenalesResena1786933978568';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "resenas" ADD "senales" jsonb`);
    await queryRunner.query(
      `ALTER TABLE "resenas" ADD "sospechosa" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_resenas_sospechosa" ON "resenas" ("sospechosa") WHERE "sospechosa"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_resenas_sospechosa"`);
    await queryRunner.query(`ALTER TABLE "resenas" DROP COLUMN "sospechosa"`);
    await queryRunner.query(`ALTER TABLE "resenas" DROP COLUMN "senales"`);
  }
}
