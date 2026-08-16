import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { CatalogoModule } from './catalogo/catalogo.module';
import { OrdenesModule } from './ordenes/ordenes.module';

/** Lee un límite del entorno; si no está o no es un número, usa el de código. */
function limite(variable: string, porDefecto: number): number {
  const n = Number(process.env[variable]);
  return Number.isFinite(n) && n > 0 ? n : porDefecto;
}

// The correlation-id middleware is deliberately NOT registered here — it is
// applied in main.ts via app.use() so it runs before the body parser. See the
// comment in common/middleware/correlation-id.middleware.ts.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Límite de tasa general (hallazgo 5 de la revisión de seguridad).
    //
    // Complementa al motor de fraude, no lo reemplaza: aquél evalúa riesgo por
    // cuenta y este frena volumen por origen. Son problemas distintos.
    //
    // Dos ventanas a la vez: la corta corta ráfagas, la larga corta el goteo
    // sostenido que se cuela por debajo de la corta. Los límites son holgados
    // a propósito —un catálogo se navega deprisa— y las rutas de autenticación
    // llevan los suyos, mucho más estrictos, con @Throttle en el controlador.
    //
    // El almacén es en memoria, igual que el motor de fraude: con una sola
    // instancia funciona, y al escalar habrá que moverlo a Redis junto con el
    // hallazgo 6. Queda dicho para que no se descubra en producción.
    // Los límites se pueden ajustar por entorno sin desplegar código: un
    // valor que ahoga a usuarios reales hay que poder subirlo en minutos, no
    // en una release.
    //
    // forRootAsync y no forRoot: con la forma síncrona el array se evalúa al
    // importar el módulo, así que la configuración quedaría congelada antes de
    // que nadie pueda ajustarla. Con la fábrica se lee al instanciar.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: 'corta',
          ttl: 10_000,
          limit: limite(config, 'THROTTLE_CORTA', 50),
        },
        {
          name: 'larga',
          ttl: 60_000,
          limit: limite(config, 'THROTTLE_LARGA', 200),
        },
      ],
    }),
    DatabaseModule,
    CommonModule,
    HealthModule,
    AuthModule,
    AdminModule,
    CatalogoModule,
    OrdenesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global: es más seguro que cada ruta nazca limitada y se exceptúe a mano
    // que confiar en que alguien se acuerde de proteger la próxima que añada.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
