import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Helmet's HSTS header (Strict-Transport-Security) tells browsers to
  // force every future request on this origin to HTTPS -- but there is no
  // HTTPS listener until a domain is configured (see infra/terraform
  // modules/alb). Sending it anyway silently breaks the site: the first
  // response's header makes the browser upgrade every subsequent
  // sub-resource request to :443, which then fails outright with
  // net::ERR_CONNECTION_REFUSED. Disabled until HTTPS actually exists.
  //
  // swagger-ui-bundle.js also uses `new Function(...)` internally, which
  // CSP treats like eval() -- strict default CSP silently breaks Swagger
  // UI rendering. Loosen CSP only under /api/docs; keep strict defaults
  // everywhere else.
  const strictHelmet = helmet({ hsts: false });
  const relaxedHelmet = helmet({
    hsts: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: [`'self'`],
        scriptSrc: [`'self'`, `'unsafe-inline'`, `'unsafe-eval'`],
        styleSrc: [`'self'`, `'unsafe-inline'`, 'https:'],
        imgSrc: [`'self'`, 'data:'],
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
