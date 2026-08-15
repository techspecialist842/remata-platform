import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Rescate } from '../entities/rescate.entity';
import { Merchant } from '../entities/merchant.entity';
import { Reporte } from '../entities/reporte.entity';
import { CatalogoService } from './catalogo.service';
import { ReportesService } from './reportes.service';
import { CatalogoController } from './catalogo.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Rescate, Merchant, Reporte]),
    AuditModule,
  ],
  controllers: [CatalogoController],
  providers: [CatalogoService, ReportesService],
  exports: [CatalogoService, ReportesService],
})
export class CatalogoModule {}
