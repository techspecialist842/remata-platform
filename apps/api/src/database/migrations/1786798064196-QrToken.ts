import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Token de retiro por QR.
 *
 * Solo el hash: quien lea la base de datos no debe poder fabricar el código que
 * autoriza entregar mercadería. El token en claro se devuelve una única vez, al
 * crear la orden.
 *
 * Nulable porque las órdenes que ya existen no tienen token, y ninguna de ellas
 * va a retirarse por QR: el índice único ignora los nulos, así que todas pueden
 * convivir sin colisionar.
 *
 * La validación por escaneo llega en Fase 4; esto es la emisión.
 */
export class QrToken1786798064196 implements MigrationInterface {
  name = 'QrToken1786798064196';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ordenes" ADD "qr_token_hash" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "ordenes" ADD "qr_usado_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_ordenes_qr_token_hash" ON "ordenes" ("qr_token_hash")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_ordenes_qr_token_hash"`);
    await queryRunner.query(`ALTER TABLE "ordenes" DROP COLUMN "qr_usado_at"`);
    await queryRunner.query(
      `ALTER TABLE "ordenes" DROP COLUMN "qr_token_hash"`,
    );
  }
}
