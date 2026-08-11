import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Orden } from '../entities/orden.entity';
import { OrdenItem } from '../entities/orden-item.entity';
import { Rescate } from '../entities/rescate.entity';
import { Merchant } from '../entities/merchant.entity';
import { Cupon } from '../entities/cupon.entity';
import { Resena } from '../entities/resena.entity';
import { Reputacion } from '../entities/reputacion.entity';
import { OrdenesService } from './ordenes.service';
import { CuponesService } from './cupones.service';
import { ResenasService } from './resenas.service';
import { ReputacionService } from './reputacion.service';
import { OrdenesController } from './ordenes.controller';
import { OrdenesProcessor } from './ordenes.processor';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CatalogoModule } from '../catalogo/catalogo.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Orden,
      OrdenItem,
      Rescate,
      Merchant,
      Cupon,
      Resena,
      Reputacion,
    ]),
    AuditModule,
    NotificationsModule,
    CatalogoModule,
  ],
  controllers: [OrdenesController],
  providers: [
    OrdenesService,
    CuponesService,
    ResenasService,
    ReputacionService,
    OrdenesProcessor,
  ],
  exports: [OrdenesService, CuponesService, ReputacionService],
})
export class OrdenesModule {}
