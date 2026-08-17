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
import type { Request, Response } from 'express';
import { Observable, of } from 'rxjs';
import { concatMap } from 'rxjs/operators';
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
        `Falta la cabecera ${HEADER}, obligatoria en esta operación`,
      );
    }

    const routePath = request.route?.path ?? request.path;
    const compositeKey = `${request.method}:${routePath}:${rawKey}`;
    const requestHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(request.body ?? {}))
      .digest('hex');

    const response = context.switchToHttp().getResponse<Response>();

    const existing = await this.repo.findOne({ where: { key: compositeKey } });
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new ConflictException(
          'Esa Idempotency-Key ya se usó con un contenido distinto',
        );
      }
      // Replay the original status too, not just the body: without this the
      // replay would carry the route's default status, so a 200 handler would
      // answer 201 the second time and callers keyed on the code would diverge.
      response.status(existing.responseStatus);
      return of(existing.responseBody);
    }

    return next.handle().pipe(
      // The record is written BEFORE the response is emitted, deliberately.
      //
      // Saving it fire-and-forget leaves a window between answering and
      // committing: a retry arriving inside that window finds no record and
      // runs the operation a second time. That is precisely when clients
      // retry — right after a dropped connection — and for POST /ordenes it
      // would mean a duplicate order consuming stock twice. Paying for one
      // synchronous write is the price of the guarantee this decorator makes.
      concatMap(async (responseBody: unknown) => {
        const entry = this.repo.create({
          key: compositeKey,
          requestHash,
          responseStatus: response.statusCode,
          responseBody: responseBody ?? null,
        });
        try {
          await this.repo.save(entry);
        } catch {
          // A genuinely concurrent retry won the insert. The stored row
          // reflects the same request, so answering normally is correct.
        }
        return responseBody;
      }),
    );
  }
}
