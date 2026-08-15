import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Rescate } from '../entities/rescate.entity';
import { Orden } from '../entities/orden.entity';
import { AdminService } from './admin.service';
import { ModeracionService } from './moderacion.service';
import { CatalogoModule } from '../catalogo/catalogo.module';
import { AdminController } from './admin.controller';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Rescate, Orden]),
    AuthModule,
    CatalogoModule,
    AuditModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, ModeracionService],
})
export class AdminModule {}
