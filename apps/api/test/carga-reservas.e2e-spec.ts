import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { configureApp } from './../src/bootstrap';
import { User } from './../src/entities/user.entity';
import { Merchant } from './../src/entities/merchant.entity';

/**
 * Criterio de aceptación de Fase 2: «las retenciones de inventario impiden la
 * sobreventa bajo una prueba de carga concurrente».
 *
 * La suite de marketplace ya cubre dos compradores simultáneos. Esto es otra
 * cosa: decenas de peticiones a la vez sobre el mismo stock. Dos hilos rara vez
 * se pisan; treinta encuentran la ventana entre el SELECT y el UPDATE si es que
 * existe.
 *
 * Lo que se afirma es una identidad contable, no una probabilidad: las unidades
 * vendidas más las disponibles tienen que dar exactamente el total, siempre. Un
 * fallo aquí no es lentitud: es mercadería vendida dos veces.
 */

describe('Reservas bajo carga (e2e)', () => {
  let app: INestApplication<App>;
  const runId = Date.now();
  const key = (s: string) => `carga-${runId}-${s}`;
  const http = () => request(app.getHttpServer());

  let comercioToken: string;
  const compradores: string[] = [];

  // 30 compradores contra 10 unidades: la mayoría debe perder, y ninguno debe
  // llevarse una unidad que no existía.
  const COMPRADORES = 30;
  const STOCK = 10;

  beforeAll(async () => {
    // Límites muy altos SOLO en esta suite: simula treinta compradores
    // distintos, que en producción vienen de treinta direcciones, mientras que
    // aquí todos salen de 127.0.0.1 y el limitador los toma por uno abusando.
    // Dejarlo activo mediría el limitador en vez de la concurrencia sobre el
    // inventario. Que el limitador funciona lo verifica seguridad.e2e-spec.
    process.env.THROTTLE_CORTA = '100000';
    process.env.THROTTLE_LARGA = '100000';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // El límite de tasa se desactiva SOLO en esta suite.
      //
      // Simula treinta compradores distintos, que en producción vienen de
      // treinta direcciones; aquí todos salen de 127.0.0.1 y el limitador los
      // toma por uno solo abusando. Dejarlo activo mediría el limitador en vez
      // de la concurrencia sobre el inventario, que es de lo que trata esta
      // prueba. Que el limitador funciona lo verifica seguridad.e2e-spec.
      .compile();
    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureApp(app);

    // listen(), no solo init(): supertest levanta un servidor efímero por cada
    // request() cuando el servidor no está escuchando. Con treinta peticiones a
    // la vez eso son treinta servidores yendo y viniendo, y en un runner
    // limitado algunas conexiones se cortan (ECONNRESET). Con el servidor ya
    // escuchando, las treinta comparten uno solo y lo que se mide es la
    // concurrencia sobre la base de datos, que es de lo que trata esta prueba.
    await app.listen(0);

    const ds = app.get(DataSource);
    const jwt = app.get(JwtService);
    const config = app.get(ConfigService);
    const usuarios = ds.getRepository(User);
    const merchants = ds.getRepository(Merchant);

    /**
     * Crea la cuenta directamente y firma su token.
     *
     * No pasa por /auth/register a propósito. Esta suite necesita treinta y una
     * cuentas y esa ruta lleva un límite de tasa estricto —correcto en
     * producción, donde treinta compradores vienen de treinta direcciones, e
     * inaplicable aquí, donde todo sale de 127.0.0.1—. Lo que se prueba es la
     * concurrencia sobre el inventario, no el alta; montar los datos por la
     * puerta de atrás mantiene la prueba centrada en su objeto, y de paso se
     * ahorra treinta y un bcrypt de doce rondas.
     */
    const crearCuenta = async (sufijo: string, rol: 'usuario' | 'comercio') => {
      const user = await usuarios.save(
        usuarios.create({
          email: `carga-${sufijo}-${runId}@test.com`,
          passwordHash: 'x'.repeat(60),
          role: rol as never,
          isActive: true,
        }),
      );
      if (rol === 'comercio') {
        await merchants.save(
          merchants.create({
            userId: user.id,
            legalName: `Comercio ${sufijo}`,
          }),
        );
      }
      return jwt.signAsync(
        { sub: user.id, email: user.email, role: rol },
        {
          secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
          expiresIn: '1h',
        },
      );
    };

    comercioToken = await crearCuenta('com', 'comercio');
    for (let i = 0; i < COMPRADORES; i++) {
      compradores.push(await crearCuenta(`c${i}`, 'usuario'));
    }
  }, 120_000);

  afterAll(async () => {
    delete process.env.THROTTLE_CORTA;
    delete process.env.THROTTLE_LARGA;
    await app.close();
  });

  const publicar = async (sufijo: string, cantidad: number) => {
    const ahora = Date.now();
    const creado = await http()
      .post('/api/v1/catalogo/rescates')
      .set('Authorization', `Bearer ${comercioToken}`)
      .set('Idempotency-Key', key(`r-${sufijo}`))
      .send({
        titulo: `Carga ${sufijo} ${runId}`,
        precioCentavos: 300,
        cantidadTotal: cantidad,
        validoDesde: new Date(ahora - 60_000).toISOString(),
        validoHasta: new Date(ahora + 3_600_000).toISOString(),
      })
      .expect(201);
    const id = (creado.body as { id: string }).id;
    await http()
      .patch(`/api/v1/catalogo/rescates/${id}/publicar`)
      .set('Authorization', `Bearer ${comercioToken}`)
      .expect(200);
    return id;
  };

  /** Lee el stock por el panel del comercio: el catálogo público oculta lo agotado. */
  const stockDe = async (rescateId: string) => {
    const r = await http()
      .get('/api/v1/catalogo/mis-rescates')
      .query({ page: 1, pageSize: 100 })
      .set('Authorization', `Bearer ${comercioToken}`)
      .expect(200);
    const encontrado = (
      r.body as {
        items: {
          id: string;
          cantidadTotal: number;
          cantidadDisponible: number;
          status: string;
        }[];
      }
    ).items.find((i) => i.id === rescateId);
    if (!encontrado) throw new Error('rescate no encontrado');
    return encontrado;
  };

  it('treinta compradores simultáneos no pueden sobrevender diez unidades', async () => {
    const rescateId = await publicar('masivo', STOCK);

    // Todas las peticiones se lanzan sin await intermedio: es la única forma
    // de que compitan de verdad por la misma fila.
    const respuestas = await Promise.all(
      compradores.map((token, i) =>
        http()
          .post('/api/v1/ordenes')
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', key(`o-masivo-${i}`))
          .send({ rescateId, cantidad: 1 }),
      ),
    );

    const creadas = respuestas.filter((r) => r.status === 201).length;
    const rechazadas = respuestas.filter((r) => r.status === 409).length;
    const otros = respuestas.filter(
      (r) => r.status !== 201 && r.status !== 409,
    );

    // Nada debe fallar por razones distintas a «no queda stock».
    expect(
      otros.map((r) => ({ status: r.status, body: r.body as unknown })),
    ).toEqual([]);

    expect(creadas).toBe(STOCK);
    expect(rechazadas).toBe(COMPRADORES - STOCK);

    // La identidad contable: vendidas + disponibles = total. Exacto.
    const rescate = await stockDe(rescateId);
    expect(rescate.cantidadDisponible).toBe(0);
    expect(rescate.cantidadTotal).toBe(STOCK);
    // Y al quedarse sin unidades sale del catálogo por sí solo.
    expect(rescate.status).toBe('agotado');
  }, 120_000);

  it('cantidades desiguales tampoco descuadran el inventario', async () => {
    // Pedidos de 1, 2 y 3 unidades mezclados: el caso de cantidad fija puede
    // pasar por casualidad si el UPDATE restara siempre uno.
    const rescateId = await publicar('mixto', STOCK);
    const cantidades = compradores.map((_, i) => (i % 3) + 1);

    const respuestas = await Promise.all(
      compradores.map((token, i) =>
        http()
          .post('/api/v1/ordenes')
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', key(`o-mixto-${i}`))
          .send({ rescateId, cantidad: cantidades[i] }),
      ),
    );

    const vendidas = respuestas.reduce(
      (suma, r, i) => (r.status === 201 ? suma + cantidades[i] : suma),
      0,
    );
    const otros = respuestas.filter(
      (r) => r.status !== 201 && r.status !== 409,
    );
    expect(otros.map((r) => r.status)).toEqual([]);

    const rescate = await stockDe(rescateId);
    expect(vendidas + rescate.cantidadDisponible).toBe(STOCK);
    // Nunca por encima del stock, ni un negativo escondido.
    expect(vendidas).toBeLessThanOrEqual(STOCK);
    expect(rescate.cantidadDisponible).toBeGreaterThanOrEqual(0);
  }, 120_000);

  it('cancelar bajo carga devuelve exactamente lo reservado', async () => {
    const rescateId = await publicar('cancel', STOCK);

    const respuestas = await Promise.all(
      compradores.slice(0, STOCK).map((token, i) =>
        http()
          .post('/api/v1/ordenes')
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', key(`o-cancel-${i}`))
          .send({ rescateId, cantidad: 1 }),
      ),
    );

    const ordenes = respuestas
      .filter((r) => r.status === 201)
      .map((r) => (r.body as { id: string }).id);
    expect(ordenes.length).toBe(STOCK);
    expect((await stockDe(rescateId)).cantidadDisponible).toBe(0);

    // Todas se cancelan a la vez: si la devolución de stock no fuera atómica,
    // se perderían incrementos y el inventario quedaría por debajo.
    await Promise.all(
      ordenes.map((id, i) =>
        http()
          .patch(`/api/v1/ordenes/${id}/cancelar`)
          .set('Authorization', `Bearer ${compradores[i]}`)
          .send({ motivo: 'comprador' })
          .expect(200),
      ),
    );

    expect((await stockDe(rescateId)).cantidadDisponible).toBe(STOCK);
  }, 120_000);
});
