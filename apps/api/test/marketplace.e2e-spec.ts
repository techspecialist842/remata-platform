import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/bootstrap';

// Fase 2 acceptance coverage: the full marketplace journey plus the two things
// that cannot be verified by reading the code — that concurrent buyers cannot
// oversell the last unit, and that cancelling really returns stock.
//
// Runs against a real PostgreSQL (see ci.yml). The oversell test in particular
// is meaningless against a mock: it is the database that arbitrates.

interface TokensBody {
  accessToken: string;
  userId: string;
}
interface RescateBody {
  id: string;
  status: string;
  cantidadDisponible: number;
}
interface OrdenBody {
  id: string;
  numero: string;
  status: string;
  subtotalCentavos: number;
  descuentoCentavos: number;
  totalCentavos: number;
}

const asTokens = (b: unknown) => b as TokensBody;
const asRescate = (b: unknown) => b as RescateBody;
const asOrden = (b: unknown) => b as OrdenBody;

describe('Marketplace (e2e)', () => {
  let app: INestApplication<App>;
  const runId = Date.now();
  const key = (s: string) => `mk-${runId}-${s}`;

  let comercioToken: string;
  let compradorToken: string;
  let compradorBToken: string;

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.init();

    const registrar = async (
      email: string,
      role: string | undefined,
      k: string,
    ) => {
      const res = await http()
        .post('/api/v1/auth/register')
        .set('Idempotency-Key', key(k))
        .send({ email, password: 'password123', displayName: email, role })
        .expect(201);
      return asTokens(res.body).accessToken;
    };

    comercioToken = await registrar(`com-${runId}@test.com`, 'comercio', 'com');
    compradorToken = await registrar(`cmp-${runId}@test.com`, undefined, 'cmp');
    compradorBToken = await registrar(
      `cmpb-${runId}@test.com`,
      undefined,
      'cmpb',
    );
  });

  afterAll(async () => {
    await app.close();
  });

  /** Creates a published listing with the given stock and returns its id. */
  const publicarRescate = async (
    cantidad: number,
    precio = 1000,
    sufijo = 'r',
  ) => {
    const ahora = Date.now();
    const creado = await http()
      .post('/api/v1/catalogo/rescates')
      .set('Authorization', `Bearer ${comercioToken}`)
      .set('Idempotency-Key', key(sufijo))
      .send({
        titulo: `Rescate ${sufijo} ${runId}`,
        precioCentavos: precio,
        cantidadTotal: cantidad,
        validoDesde: new Date(ahora - 60_000).toISOString(),
        validoHasta: new Date(ahora + 3_600_000).toISOString(),
      })
      .expect(201);

    const id = asRescate(creado.body).id;
    await http()
      .patch(`/api/v1/catalogo/rescates/${id}/publicar`)
      .set('Authorization', `Bearer ${comercioToken}`)
      .expect(200);
    return id;
  };

  it('recorre el ciclo completo: publicar, comprar, confirmar, cumplir, reseñar', async () => {
    const rescateId = await publicarRescate(5, 2500, 'ciclo');

    // Aparece en el catálogo público, sin autenticación.
    const catalogo = await http()
      .get('/api/v1/catalogo/rescates')
      .query({ q: `Rescate ciclo ${runId}` })
      .expect(200);
    expect((catalogo.body as { total: number }).total).toBe(1);

    const ordenRes = await http()
      .post('/api/v1/ordenes')
      .set('Authorization', `Bearer ${compradorToken}`)
      .set('Idempotency-Key', key('orden-ciclo'))
      .send({ rescateId, cantidad: 2 })
      .expect(201);

    const orden = asOrden(ordenRes.body);
    expect(orden.status).toBe('creada');
    expect(orden.subtotalCentavos).toBe(5000);
    expect(orden.totalCentavos).toBe(5000);
    expect(orden.numero).toMatch(/^R-\d{6}-[0-9A-F]{8}$/);

    await http()
      .patch(`/api/v1/ordenes/${orden.id}/confirmar`)
      .set('Authorization', `Bearer ${comercioToken}`)
      .expect(200);

    await http()
      .patch(`/api/v1/ordenes/${orden.id}/cumplir`)
      .set('Authorization', `Bearer ${comercioToken}`)
      .expect(200);

    await http()
      .post(`/api/v1/ordenes/${orden.id}/resena`)
      .set('Authorization', `Bearer ${compradorToken}`)
      .send({ calificacion: 5, comentario: 'Todo perfecto' })
      .expect(201);

    // Reseñar dos veces la misma orden no se permite.
    await http()
      .post(`/api/v1/ordenes/${orden.id}/resena`)
      .set('Authorization', `Bearer ${compradorToken}`)
      .send({ calificacion: 1 })
      .expect(409);

    // El listado dice que ya está reseñada, y con qué nota. Sin esto la app no
    // puede distinguir una orden calificada de una pendiente de calificar, y
    // acabaría ofreciendo un botón que solo puede devolver 409.
    const mias = await http()
      .get('/api/v1/ordenes/mias')
      .set('Authorization', `Bearer ${compradorToken}`)
      .expect(200);

    const enListado = (
      mias.body as {
        items: {
          id: string;
          resena: { calificacion: number; comentario: string | null } | null;
        }[];
      }
    ).items.find((o) => o.id === orden.id);
    expect(enListado?.resena?.calificacion).toBe(5);
    expect(enListado?.resena?.comentario).toBe('Todo perfecto');
  });

  it('una orden sin reseñar se distingue de una reseñada', async () => {
    const rescateId = await publicarRescate(1, 900, 'sinresena');
    await http()
      .post('/api/v1/ordenes')
      .set('Authorization', `Bearer ${compradorToken}`)
      .set('Idempotency-Key', key('orden-sinresena'))
      .send({ rescateId, cantidad: 1 })
      .expect(201);

    const mias = await http()
      .get('/api/v1/ordenes/mias')
      .set('Authorization', `Bearer ${compradorToken}`)
      .expect(200);

    const sinResenar = (
      mias.body as { items: { numero: string; resena: unknown }[] }
    ).items.filter((o) => o.resena === null);
    expect(sinResenar.length).toBeGreaterThan(0);
  });

  // El caso que justifica la reserva atómica: sin ella, ambos compradores
  // leerían "1 disponible" y ambos crearían su orden, vendiendo dos veces la
  // misma unidad. Es el fallo que sólo aparece bajo concurrencia real.
  it('no permite sobrevender la última unidad ante dos compras simultáneas', async () => {
    const rescateId = await publicarRescate(1, 1000, 'carrera');

    const compra = (token: string, k: string) =>
      http()
        .post('/api/v1/ordenes')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', key(k))
        .send({ rescateId, cantidad: 1 });

    const [a, b] = await Promise.all([
      compra(compradorToken, 'carrera-a'),
      compra(compradorBToken, 'carrera-b'),
    ]);

    const codigos = [a.status, b.status].sort();
    expect(codigos).toEqual([201, 409]); // exactamente uno gana

    const rescate = await http()
      .get(`/api/v1/catalogo/rescates/${rescateId}`)
      .expect(404); // agotado: ya no figura como comprable
    expect(rescate.body).toBeDefined();
  });

  it('devuelve el inventario al cancelar', async () => {
    const rescateId = await publicarRescate(3, 1500, 'cancel');

    const ordenRes = await http()
      .post('/api/v1/ordenes')
      .set('Authorization', `Bearer ${compradorToken}`)
      .set('Idempotency-Key', key('orden-cancel'))
      .send({ rescateId, cantidad: 3 })
      .expect(201);

    // Reservó todo: sale del catálogo.
    await http().get(`/api/v1/catalogo/rescates/${rescateId}`).expect(404);

    await http()
      .patch(`/api/v1/ordenes/${asOrden(ordenRes.body).id}/cancelar`)
      .set('Authorization', `Bearer ${compradorToken}`)
      .send({ motivo: 'comprador' })
      .expect(200);

    // Vuelve a estar disponible, con su stock restituido.
    const vuelto = await http()
      .get(`/api/v1/catalogo/rescates/${rescateId}`)
      .expect(200);
    expect(asRescate(vuelto.body).cantidadDisponible).toBe(3);
  });

  it('rechaza transiciones inválidas de la orden', async () => {
    const rescateId = await publicarRescate(2, 800, 'estados');

    const ordenRes = await http()
      .post('/api/v1/ordenes')
      .set('Authorization', `Bearer ${compradorToken}`)
      .set('Idempotency-Key', key('orden-estados'))
      .send({ rescateId, cantidad: 1 })
      .expect(201);
    const ordenId = asOrden(ordenRes.body).id;

    // Cumplir sin confirmar antes: creada -> cumplida no está permitido.
    await http()
      .patch(`/api/v1/ordenes/${ordenId}/cumplir`)
      .set('Authorization', `Bearer ${comercioToken}`)
      .expect(400);

    await http()
      .patch(`/api/v1/ordenes/${ordenId}/confirmar`)
      .set('Authorization', `Bearer ${comercioToken}`)
      .expect(200);
    await http()
      .patch(`/api/v1/ordenes/${ordenId}/cumplir`)
      .set('Authorization', `Bearer ${comercioToken}`)
      .expect(200);

    // Una orden cumplida es terminal.
    await http()
      .patch(`/api/v1/ordenes/${ordenId}/cancelar`)
      .set('Authorization', `Bearer ${compradorToken}`)
      .send({ motivo: 'comprador' })
      .expect(400);
  });

  it('impide que un comprador marque no-show', async () => {
    const rescateId = await publicarRescate(1, 700, 'noshow');
    const ordenRes = await http()
      .post('/api/v1/ordenes')
      .set('Authorization', `Bearer ${compradorToken}`)
      .set('Idempotency-Key', key('orden-noshow'))
      .send({ rescateId, cantidad: 1 })
      .expect(201);

    await http()
      .patch(`/api/v1/ordenes/${asOrden(ordenRes.body).id}/cancelar`)
      .set('Authorization', `Bearer ${compradorToken}`)
      .send({ motivo: 'no_show' })
      .expect(403);
  });

  it('no deja comprar un rescate en borrador', async () => {
    const creado = await http()
      .post('/api/v1/catalogo/rescates')
      .set('Authorization', `Bearer ${comercioToken}`)
      .set('Idempotency-Key', key('borrador'))
      .send({
        titulo: `Borrador ${runId}`,
        precioCentavos: 500,
        cantidadTotal: 5,
        validoDesde: new Date(Date.now() - 60_000).toISOString(),
        validoHasta: new Date(Date.now() + 3_600_000).toISOString(),
      })
      .expect(201);

    await http()
      .post('/api/v1/ordenes')
      .set('Authorization', `Bearer ${compradorToken}`)
      .set('Idempotency-Key', key('orden-borrador'))
      .send({ rescateId: asRescate(creado.body).id, cantidad: 1 })
      .expect(400);
  });

  // Sin las líneas, una orden es un número y un importe: el comercio no sabe
  // qué preparar y quien compró no reconoce su propia reserva.
  it('ambos listados de órdenes dicen qué se compró', async () => {
    const rescateId = await publicarRescate(4, 1200, 'lineas');
    await http()
      .post('/api/v1/ordenes')
      .set('Authorization', `Bearer ${compradorToken}`)
      .set('Idempotency-Key', key('orden-lineas'))
      .send({ rescateId, cantidad: 2 })
      .expect(201);

    const titulo = `Rescate lineas ${runId}`;
    const lineaDe = (cuerpo: unknown) =>
      (cuerpo as { items: { items: { tituloSnapshot: string }[] }[] }).items
        .flatMap((o) => o.items)
        .find((l) => l.tituloSnapshot === titulo);

    const mias = await http()
      .get('/api/v1/ordenes/mias')
      .set('Authorization', `Bearer ${compradorToken}`)
      .expect(200);
    expect(lineaDe(mias.body)).toBeDefined();

    const recibidas = await http()
      .get('/api/v1/ordenes/recibidas')
      .set('Authorization', `Bearer ${comercioToken}`)
      .expect(200);
    const linea = lineaDe(recibidas.body) as unknown as {
      cantidad: number;
      precioUnitarioCentavos: number;
    };
    expect(linea).toBeDefined();
    expect(linea.cantidad).toBe(2);
    // Copia tomada en la compra: el precio de la línea no sigue al de la
    // publicación si esta cambia después.
    expect(linea.precioUnitarioCentavos).toBe(1200);
  });

  // La garantía que promete Idempotency-Key: un reintento inmediato —el caso
  // real, tras un corte de red— no debe crear una segunda orden ni consumir
  // stock dos veces. El reintento se lanza en cuanto vuelve la primera
  // respuesta, que es exactamente la ventana que dejaba abierta guardar el
  // registro sin esperar.
  //
  // Dos peticiones *simultáneas* con la misma clave son otro problema: ambas
  // consultan antes de que exista registro alguno, así que ninguna cachea a la
  // otra. Ahí lo que protege el inventario es la reserva atómica, cubierta por
  // la prueba de sobreventa.
  it('un reintento inmediato con la misma clave no duplica la orden', async () => {
    const rescateId = await publicarRescate(5, 1000, 'reintento');
    const clave = key('orden-reintento');

    const enviar = () =>
      http()
        .post('/api/v1/ordenes')
        .set('Authorization', `Bearer ${compradorToken}`)
        .set('Idempotency-Key', clave)
        .send({ rescateId, cantidad: 2 });

    const primera = await enviar().expect(201);
    const reintento = await enviar().expect(201);

    // Misma orden devuelta, no una nueva.
    expect(asOrden(reintento.body).id).toBe(asOrden(primera.body).id);
    expect(asOrden(reintento.body).numero).toBe(asOrden(primera.body).numero);

    // Y el inventario se tocó una sola vez: 5 - 2 = 3.
    const rescate = await http()
      .get(`/api/v1/catalogo/rescates/${rescateId}`)
      .expect(200);
    expect(asRescate(rescate.body).cantidadDisponible).toBe(3);
  });

  // La sesión solo lleva el userId, pero la reputación se indexa por
  // merchantId. Sin este endpoint un comercio no puede preguntar por lo suyo.
  it('un comercio puede consultar su perfil y con él su reputación', async () => {
    const perfil = await http()
      .get('/api/v1/catalogo/mi-comercio')
      .set('Authorization', `Bearer ${comercioToken}`)
      .expect(200);

    const merchant = perfil.body as { id: string; legalName: string };
    expect(merchant.id).toEqual(expect.any(String));
    expect(merchant.legalName).toBe(`com-${runId}@test.com`);

    // La reputación exige sesión: los guards están en el controlador entero.
    const reputacion = await http()
      .get(`/api/v1/ordenes/reputacion/${merchant.id}`)
      .set('Authorization', `Bearer ${comercioToken}`)
      .expect(200);
    // Este comercio cumplió órdenes durante la suite, así que el contador no
    // puede seguir en cero: comprueba que el id devuelto es el correcto y no
    // uno cualquiera que simplemente exista.
    expect(
      (reputacion.body as { ordenesCumplidas: number }).ordenesCumplidas,
    ).toBeGreaterThan(0);
  });

  it('un comprador no puede pedir un perfil de comercio', async () => {
    await http()
      .get('/api/v1/catalogo/mi-comercio')
      .set('Authorization', `Bearer ${compradorToken}`)
      .expect(403);
  });

  // El código autoriza entregar mercadería, así que lo que se comprueba no es
  // que exista, sino que no se pueda reconstruir desde nada que la API entregue.
  it('emite un token de retiro que solo viaja al crear la orden', async () => {
    const rescateId = await publicarRescate(2, 600, 'qr');
    const creada = await http()
      .post('/api/v1/ordenes')
      .set('Authorization', `Bearer ${compradorToken}`)
      .set('Idempotency-Key', key('orden-qr'))
      .send({ rescateId, cantidad: 1 })
      .expect(201);

    const cuerpo = creada.body as { id: string; qrToken: string };
    expect(cuerpo.qrToken).toEqual(expect.any(String));
    // 32 bytes en base64url son 43 caracteres: adivinarlo tiene que ser
    // inviable, no meramente improbable.
    expect(cuerpo.qrToken.length).toBeGreaterThanOrEqual(43);
    expect(creada.body).not.toHaveProperty('qrTokenHash');

    // Y no reaparece en ningún listado, ni al comprador ni al comercio.
    const mias = await http()
      .get('/api/v1/ordenes/mias')
      .set('Authorization', `Bearer ${compradorToken}`)
      .expect(200);
    expect(JSON.stringify(mias.body)).not.toContain(cuerpo.qrToken);
    expect(JSON.stringify(mias.body)).not.toContain('qrTokenHash');

    const recibidas = await http()
      .get('/api/v1/ordenes/recibidas')
      .set('Authorization', `Bearer ${comercioToken}`)
      .expect(200);
    expect(JSON.stringify(recibidas.body)).not.toContain('qrTokenHash');
  });

  it('dos órdenes no comparten token de retiro', async () => {
    const rescateId = await publicarRescate(2, 600, 'qr2');
    const tokens: string[] = [];
    for (const k of ['qr2-a', 'qr2-b']) {
      const r = await http()
        .post('/api/v1/ordenes')
        .set('Authorization', `Bearer ${compradorToken}`)
        .set('Idempotency-Key', key(k))
        .send({ rescateId, cantidad: 1 })
        .expect(201);
      tokens.push((r.body as { qrToken: string }).qrToken);
    }
    expect(tokens[0]).not.toBe(tokens[1]);
  });

  it('clasifica las ofertas por tipo y permite filtrarlas', async () => {
    const ahora = Date.now();
    const crearTipo = async (tipo: string, sufijo: string) => {
      const r = await http()
        .post('/api/v1/catalogo/rescates')
        .set('Authorization', `Bearer ${comercioToken}`)
        .set('Idempotency-Key', key(`tipo-${sufijo}`))
        .send({
          titulo: `Tipo ${sufijo} ${runId}`,
          tipo,
          precioCentavos: 700,
          cantidadTotal: 2,
          validoDesde: new Date(ahora - 60_000).toISOString(),
          validoHasta: new Date(ahora + 3_600_000).toISOString(),
        })
        .expect(201);
      const id = (r.body as { id: string; tipo: string }).id;
      expect((r.body as { tipo: string }).tipo).toBe(tipo);
      await http()
        .patch(`/api/v1/catalogo/rescates/${id}/publicar`)
        .set('Authorization', `Bearer ${comercioToken}`)
        .expect(200);
      return id;
    };

    const caja = await crearTipo('caja_sorpresa', 'caja');
    await crearTipo('lote', 'lote');

    const soloCajas = await http()
      .get('/api/v1/catalogo/rescates')
      .query({ q: `Tipo `, tipo: 'caja_sorpresa' })
      .expect(200);
    const ids = (soloCajas.body as { items: { id: string }[] }).items.map(
      (i) => i.id,
    );
    expect(ids).toContain(caja);
    expect(ids).toHaveLength(1);
  });

  // Todo lo creado antes de que existiera el campo es un artículo suelto; el
  // default lo clasifica sin tener que tocar una sola fila.
  it('una oferta sin tipo declarado es unitaria', async () => {
    const ahora = Date.now();
    const r = await http()
      .post('/api/v1/catalogo/rescates')
      .set('Authorization', `Bearer ${comercioToken}`)
      .set('Idempotency-Key', key('tipo-defecto'))
      .send({
        titulo: `Sin tipo ${runId}`,
        precioCentavos: 400,
        cantidadTotal: 1,
        validoDesde: new Date(ahora - 60_000).toISOString(),
        validoHasta: new Date(ahora + 3_600_000).toISOString(),
      })
      .expect(201);

    expect((r.body as { tipo: string }).tipo).toBe('unitario');
  });

  it('rechaza un tipo de oferta inventado', async () => {
    const ahora = Date.now();
    await http()
      .post('/api/v1/catalogo/rescates')
      .set('Authorization', `Bearer ${comercioToken}`)
      .set('Idempotency-Key', key('tipo-malo'))
      .send({
        titulo: `Tipo malo ${runId}`,
        tipo: 'combo_familiar',
        precioCentavos: 400,
        cantidadTotal: 1,
        validoDesde: new Date(ahora - 60_000).toISOString(),
        validoHasta: new Date(ahora + 3_600_000).toISOString(),
      })
      .expect(400);
  });

  it('impide que un comprador publique rescates (control de rol)', async () => {
    await http()
      .post('/api/v1/catalogo/rescates')
      .set('Authorization', `Bearer ${compradorToken}`)
      .set('Idempotency-Key', key('rol'))
      .send({
        titulo: 'No deberia crearse',
        precioCentavos: 100,
        cantidadTotal: 1,
        validoDesde: new Date().toISOString(),
        validoHasta: new Date(Date.now() + 3_600_000).toISOString(),
      })
      .expect(403);
  });
});
