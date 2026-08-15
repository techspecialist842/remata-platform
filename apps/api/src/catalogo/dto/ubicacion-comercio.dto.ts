import { Type } from 'class-transformer';
import {
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

/**
 * Punto de retiro del comercio.
 *
 * Las coordenadas van juntas: una latitud sin su longitud no ubica nada, y
 * guardar media coordenada dejaría al comercio invisible en las búsquedas por
 * cercanía sin que nada avisara. El servicio lo rechaza.
 */
export class UbicacionComercioDto {
  @IsOptional()
  @IsString()
  @Length(3, 300)
  direccion?: string;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitud?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitud?: number;
}
