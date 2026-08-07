import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

// Uniform error envelope for every 4xx/5xx response, per the Fase 1 "estándares
// de API REST (errores...)" requirement — correlationId lets a client hand us a
// single value that maps straight back to a log line and, for auth flows, an
// audit_logs row.
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = isHttpException ? exception.getResponse() : null;
    const message =
      typeof body === 'string'
        ? body
        : ((body as { message?: string | string[] })?.message ??
          'Internal server error');

    if (!isHttpException) {
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}: ${(exception as Error)?.message}`,
        (exception as Error)?.stack,
      );
    }

    response.status(status).json({
      statusCode: status,
      error: HttpStatus[status] ?? 'Error',
      message,
      correlationId: request.headers['x-correlation-id'] ?? null,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
