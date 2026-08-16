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

  // `upgrade-insecure-requests` sigue fuera del CSP a propósito: obliga al
  // navegador a pedir por HTTPS cada sub-recurso de la página actual, de
  // inmediato y sin visita previa. Cuando un entorno corre en HTTP plano —el
  // desarrollo local, sin ir más lejos— eso falla cada petición contra un 443
  // inexistente, y lo hace en silencio: curl y los códigos de estado no lo
  // ven, solo los errores de red del navegador.
  //
  // HSTS sí se reactivó; ver más abajo.
  //
  // swagger-ui-bundle.js also uses `new Function(...)` internally, which
  // CSP treats like eval() -- strict default CSP silently breaks Swagger
  // UI rendering. Loosen CSP only under /api/docs; keep strict defaults
  // everywhere else.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- discarded on purpose
  const { 'upgrade-insecure-requests': _upgrade, ...baseCsp } =
    helmet.contentSecurityPolicy.getDefaultDirectives();

  // HSTS (hallazgo 2 de la revisión de seguridad).
  //
  // Se deshabilitó en Fase 0, cuando los ambientes eran solo HTTP y HSTS
  // rompía el sitio forzando al navegador contra un 443 inexistente. HTTPS
  // está activo y verificado en los tres ambientes desde el 2026-08-04, así
  // que esa razón caducó.
  //
  // Se reactiva ESCALONADO, no de golpe: la política queda cacheada en el
  // navegador durante max-age, y si HTTPS llegara a fallar los usuarios se
  // quedan sin acceso y no hay forma de avisarles. Se arranca en una hora —
  // suficiente para proteger y corto para revertir— y se sube a un año cuando
  // haya semanas de HTTPS estable. Se controla por entorno para poder subirlo
  // sin desplegar código.
  //
  // Nada de includeSubDomains ni preload hasta llegar al año: preload es
  // prácticamente irreversible.
  const hstsSegundos = Number(process.env.HSTS_MAX_AGE ?? 3600);
  const hsts =
    hstsSegundos > 0
      ? { maxAge: hstsSegundos, includeSubDomains: false, preload: false }
      : false;

  const strictHelmet = helmet({
    hsts,
    contentSecurityPolicy: { useDefaults: false, directives: baseCsp },
  });
  const relaxedHelmet = helmet({
    hsts,
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
