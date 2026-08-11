import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CrearOrdenDto {
  @IsUUID()
  rescateId: string;

  /**
   * Tope de 20 por orden: es un marketplace de excedentes, no mayorista, y
   * limita el daño de una reserva masiva que después se abandona.
   */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  cantidad: number;

  @IsOptional()
  @IsString()
  cuponCodigo?: string;
}
