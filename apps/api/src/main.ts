import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
  app.enableShutdownHooks();

  const config = new DocumentBuilder()
    .setTitle('REMATA API')
    .setDescription('Platform core API — Fase 0 skeleton')
    .setVersion('0.0.1')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}
void bootstrap();
