import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class CrearRescateDto {
  @IsString()
  @Length(3, 160)
  titulo: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  descripcion?: string;

  @IsOptional()
  @IsString()
  @Length(1, 60)
  categoria?: string;

  /** Precio de venta en centavos. Entero: nunca coma flotante para dinero. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  precioCentavos: number;

  /** Precio de referencia previo al descuento, solo para mostrar. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  precioOriginalCentavos?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidadTotal: number;

  @IsDateString()
  validoDesde: string;

  @IsDateString()
  validoHasta: string;
}
