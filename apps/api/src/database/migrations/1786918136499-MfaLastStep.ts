import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Último paso temporal TOTP consumido por cada administrador.
 *
 * Impide reutilizar un código dentro de su ventana de validez (hallazgo 3 de
 * la revisión de seguridad de Fase 1).
 *
 * Nulable: las cuentas existentes no tienen historial y su primer código
 * posterior a esta migración establecerá el punto de partida. `integer` basta
 * —el paso es el epoch dividido entre 30, y no se acerca al límite de int32
 * hasta bien entrado el próximo milenio—.
 *
 * Como en las migraciones anteriores, se descarta el renombrado de claves
 * foráneas que propone el generador sobre merchants y refresh_tokens.
 */
export class MfaLastStep1786918136499 implements MigrationInterface {
  name = 'MfaLastStep1786918136499';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "mfa_last_step" integer`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "mfa_last_step"`);
  }
}
