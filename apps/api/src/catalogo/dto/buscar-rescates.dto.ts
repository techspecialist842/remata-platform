import { Type } from 'class-transformer';
import {
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class BuscarRescatesDto extends PaginationQueryDto {
  /** Coincidencia parcial, sin distinguir mayúsculas, sobre el título. */
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  categoria?: string;

  @IsOptional()
  @IsString()
  merchantId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  precioMaxCentavos?: number;

  // Búsqueda por cercanía. Las tres van juntas o ninguna: sin un punto de
  // partida el radio no significa nada, y el controlador lo rechaza si llega
  // solo una parte.
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;

  /**
   * Radio en kilómetros. Por debajo de 0,1 km no tiene sentido —el propio GPS
   * del teléfono yerra más que eso— y por encima de 100 deja de ser «cerca» y
   * empieza a ser un escaneo de tabla disfrazado de búsqueda.
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(100)
  radioKm?: number;
}
