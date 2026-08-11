import { IsString, Length } from 'class-validator';

export class RetirarRescateDto {
  /** Se le muestra al comercio: retirar sin explicar no es aceptable. */
  @IsString()
  @Length(5, 300)
  motivo: string;
}
