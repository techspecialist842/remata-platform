import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Punto de retiro del comercio: dirección legible y coordenadas.
 *
 * Todo nulable a propósito. Los comercios ya registrados no tienen ubicación y
 * deben seguir operando; simplemente no aparecerán en las búsquedas por
 * cercanía hasta que la fijen.
 *
 * El índice compuesto sirve al prefiltro por caja delimitadora de la búsqueda
 * geográfica: acota primero por rangos de latitud y longitud —que sí puede
 * resolver un índice— y solo después calcula la distancia real sobre el puñado
 * de filas que quedan.
 *
 * NOTA: el generador de TypeORM propone además renombrar las claves foráneas
 * de merchants y refresh_tokens a nombres con hash. Se descarta: no aporta
 * nada, y tocar restricciones de tablas ajenas a este cambio es riesgo gratis.
 */
export class GeoComercio1786796365729 implements MigrationInterface {
  name = 'GeoComercio1786796365729';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "merchants" ADD "direccion" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "merchants" ADD "latitud" numeric(9,6)`,
    );
    await queryRunner.query(
      `ALTER TABLE "merchants" ADD "longitud" numeric(9,6)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_merchants_lat_lng" ON "merchants" ("latitud", "longitud")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_merchants_lat_lng"`);
    await queryRunner.query(`ALTER TABLE "merchants" DROP COLUMN "longitud"`);
    await queryRunner.query(`ALTER TABLE "merchants" DROP COLUMN "latitud"`);
    await queryRunner.query(`ALTER TABLE "merchants" DROP COLUMN "direccion"`);
  }
}
