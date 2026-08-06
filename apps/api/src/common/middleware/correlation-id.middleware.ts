import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

const HEADER = 'x-correlation-id';

// Plain Express middleware (not a NestMiddleware class) so it can be registered
// via app.use() in main.ts BEFORE the body parser. Registering it through
// MiddlewareConsumer would place it after body parsing, which means a malformed
// JSON body throws inside the parser and the response comes back with no
// correlation id — the one class of error you most want to be able to trace.
export function correlationId(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.headers[HEADER];
  const value =
    (Array.isArray(incoming) ? incoming[0] : incoming) || randomUUID();
  req.headers[HEADER] = value;
  res.setHeader('X-Correlation-Id', value);
  next();
}
