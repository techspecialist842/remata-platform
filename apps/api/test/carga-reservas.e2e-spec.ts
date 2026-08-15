import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/bootstrap';

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

interface TokensBody {
  accessToken: string;
}

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
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureApp(app);

    // listen(), no solo init(): supertest levanta un servidor efímero por cada
    // request() cuando el servidor no está escuchando. Con treinta peticiones a
    // la vez eso son treinta servidores yendo y viniendo, y en un runner
    // limitado algunas conexiones se cortan (ECONNRESET). Con el servidor ya
    // escuchando, las treinta comparten uno solo y lo que se mide es la
    // concurrencia sobre la base de datos, que es de lo que trata esta prueba.
    await app.listen(0);

    const registrar = async (sufijo: string, role?: string) => {
      const r = await http()
        .post('/api/v1/auth/register')
        .set('Idempotency-Key', key(sufijo))
        .send({
          email: `carga-${sufijo}-${runId}@test.com`,
          password: 'password123',
          role,
        })
        .expect(201);
      return (r.body as TokensBody).accessToken;
    };

    comercioToken = await registrar('com', 'comercio');
    // En serie: registrar en paralelo mide el registro, no las reservas.
    for (let i = 0; i < COMPRADORES; i++) {
      compradores.push(await registrar(`c${i}`));
    }
  }, 120_000);

  afterAll(async () => {
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
