import { IsString, Length } from 'class-validator';

export class ConfirmEnrollmentDto {
  /** Token de un solo uso entregado al crear la cuenta de administrador. */
  @IsString()
  enrollmentToken: string;

  /** Código TOTP de 6 dígitos de la app autenticadora. */
  @IsString()
  @Length(6, 6)
  token: string;
}
