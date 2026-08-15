import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tipo de oferta: artículo suelto, caja sorpresa o lote de liquidación.
 *
 * NOT NULL con default 'unitario' en lugar de nulable. Las publicaciones que ya
 * existen son artículos sueltos, así que el default las clasifica bien sin
 * tocarlas y sin dejar un estado «sin tipo» que luego habría que interpretar en
 * cada consulta.
 *
 * Como en la migración anterior, se descarta el renombrado de claves foráneas
 * que propone el generador: no aporta nada y toca tablas ajenas a este cambio.
 */
export class TipoRescate1786797877810 implements MigrationInterface {
  name = 'TipoRescate1786797877810';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."rescates_tipo_enum" AS ENUM('unitario', 'caja_sorpresa', 'lote')`,
    );
    await queryRunner.query(
      `ALTER TABLE "rescates" ADD "tipo" "public"."rescates_tipo_enum" NOT NULL DEFAULT 'unitario'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "rescates" DROP COLUMN "tipo"`);
    await queryRunner.query(`DROP TYPE "public"."rescates_tipo_enum"`);
  }
}
