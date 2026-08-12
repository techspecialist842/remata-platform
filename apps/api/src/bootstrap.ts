import helmet from 'helmet';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { json, urlencoded } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { correlationId } from './common/middleware/correlation-id.middleware';

// Single source of truth for how the HTTP layer is wired. Both main.ts and the
// e2e suite call this, so the tests exercise the same middleware order,
// validation rules and versioning as production — otherwise a change here
// could pass every test and still break the deployed service.
//
// NOTE: callers must create the app with `{ bodyParser: false }`, since the
// body parsers are installed below in a deliberate order.
export function configureApp(app: INestApplication): void {
  // Correlation id FIRST, before body parsing: a malformed JSON body throws
  // inside the parser, and without this ordering that error response would
  // carry no traceable id.
  app.use(correlationId);
  app.use(json());
  app.use(urlencoded({ extended: true }));

  // Cross-origin access is closed unless an environment names the origins it
  // trusts, e.g. CORS_ORIGINS=https://admin.remata.app,http://localhost:8080.
  // An allowlist rather than '*': with '*' any site a user visits could call
  // this API with their session. Native mobile builds are unaffected either
  // way — CORS is a browser policy — but the web build and the coming admin
  // panel need it.
  const origenes = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (origenes.length > 0) {
    app.enableCors({
      origin: origenes,
      credentials: true,
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Idempotency-Key',
        'X-Correlation-Id',
      ],
      exposedHeaders: ['X-Correlation-Id'],
    });
  }

  // No HTTPS listener exists until a domain is configured (see
  // infra/terraform modules/alb), so two of Helmet's secure-by-default
  // behaviors actively break the plain-HTTP site rather than harmlessly
  // no-op:
  //   - hsts: tells the browser to force every FUTURE request on this
  //     origin to HTTPS.
  //   - CSP's default `upgrade-insecure-requests` directive: tells the
  //     browser to force every sub-resource request on the CURRENT page
  //     to HTTPS, immediately, with no prior visit or cached state
  //     needed.
  // Both silently fail every sub-resource fetch with
  // net::ERR_CONNECTION_REFUSED against :443 -- invisible to curl/HTTP
  // status-code checks, only visible via actual browser network errors.
  // Both are disabled here until HTTPS is actually activated.
  //
  // swagger-ui-bundle.js also uses `new Function(...)` internally, which
  // CSP treats like eval() -- strict default CSP silently breaks Swagger
  // UI rendering. Loosen CSP only under /api/docs; keep strict defaults
  // everywhere else.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- discarded on purpose
  const { 'upgrade-insecure-requests': _upgrade, ...baseCsp } =
    helmet.contentSecurityPolicy.getDefaultDirectives();
  const strictHelmet = helmet({
    hsts: false,
    contentSecurityPolicy: { useDefaults: false, directives: baseCsp },
  });
  const relaxedHelmet = helmet({
    hsts: false,
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        ...baseCsp,
        'default-src': [`'self'`],
        'script-src': [`'self'`, `'unsafe-inline'`, `'unsafe-eval'`],
        'style-src': [`'self'`, `'unsafe-inline'`, 'https:'],
        'img-src': [`'self'`, 'data:'],
      },
    },
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    const relaxed = req.path.startsWith('/api/docs');
    (relaxed ? relaxedHelmet : strictHelmet)(req, res, next);
  });

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
}
