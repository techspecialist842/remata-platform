import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { CancelacionMotivo } from '../../common/enums/marketplace.enum';

export class CancelarOrdenDto {
  @IsEnum(CancelacionMotivo)
  motivo: CancelacionMotivo;

  @IsOptional()
  @IsString()
  @Length(1, 300)
  nota?: string;
}

export class CrearResenaDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  calificacion: number;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  comentario?: string;
}
