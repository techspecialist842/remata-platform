import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdempotencyKey } from '../entities/idempotency-key.entity';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { IdempotencyInterceptor } from './interceptors/idempotency.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([IdempotencyKey])],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
})
export class CommonModule {}
