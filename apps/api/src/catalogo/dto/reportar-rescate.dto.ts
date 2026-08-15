import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { ReporteMotivo } from '../../common/enums/marketplace.enum';

export class ReportarRescateDto {
  @IsEnum(ReporteMotivo)
  motivo: ReporteMotivo;

  /** Detalle libre. Es lo único que hace útil el motivo «otro». */
  @IsOptional()
  @IsString()
  @Length(1, 500)
  nota?: string;
}
