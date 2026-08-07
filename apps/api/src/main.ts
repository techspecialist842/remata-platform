import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

async function bootstrap() {
  // bodyParser: false so configureApp() controls middleware order — Nest would
  // otherwise install the JSON parser ahead of the correlation-id middleware.
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  configureApp(app);
  app.enableShutdownHooks();

  const config = new DocumentBuilder()
    .setTitle('REMATA API')
    .setDescription(
      'Núcleo de la plataforma: autenticación, roles (usuario/comercio/admin), ' +
        'MFA para administradores, notificaciones y auditoría.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}
void bootstrap();
