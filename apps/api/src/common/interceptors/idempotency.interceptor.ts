import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request } from 'express';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import * as crypto from 'crypto';
import { IdempotencyKey } from '../../entities/idempotency-key.entity';
import { IDEMPOTENT_KEY } from '../decorators/idempotent.decorator';

const HEADER = 'idempotency-key';

// Express's own Request type declares `route` as `any` — Omit it and
// reintroduce a narrow shape so member access stays type-safe.
type RequestWithRoute = Omit<Request, 'route'> & { route?: { path?: string } };

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(IdempotencyKey)
    private readonly repo: Repository<IdempotencyKey>,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const isIdempotent = this.reflector.getAllAndOverride<boolean>(
      IDEMPOTENT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!isIdempotent) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<RequestWithRoute>();
    const headerValue = request.headers[HEADER];
    const rawKey = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    if (!rawKey) {
      throw new BadRequestException(
        `${HEADER} header is required for this operation`,
      );
    }

    const routePath = request.route?.path ?? request.path;
    const compositeKey = `${request.method}:${routePath}:${rawKey}`;
    const requestHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(request.body ?? {}))
      .digest('hex');

    const existing = await this.repo.findOne({ where: { key: compositeKey } });
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new ConflictException(
          'Idempotency-Key was already used with a different request payload',
        );
      }
      return of(existing.responseBody);
    }

    return next.handle().pipe(
      tap((responseBody: unknown) => {
        const entry = this.repo.create({
          key: compositeKey,
          requestHash,
          responseStatus: 200,
          responseBody: responseBody ?? null,
        });
        void this.repo.save(entry).catch(() => {
          // Duplicate insert from a genuinely concurrent retry with the same key
          // is fine to swallow — the stored row already reflects the same request.
        });
      }),
    );
  }
}
