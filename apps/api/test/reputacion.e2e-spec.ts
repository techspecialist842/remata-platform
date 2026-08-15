import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/bootstrap';

// Reputación: nota ponderada y derecho de réplica.
//
// La ponderación existe para que una sola opinión no valga lo mismo que
// doscientas. Las cifras esperadas están calculadas a mano con la fórmula
// bayesiana —(4,0 × 5 + suma) / (5 + n)— para que la prueba compruebe el
// cálculo y no se limite a repetir lo que devuelve el código.

interface TokensBody {
  accessToken: string;
}
interface Resumen {
  promedio: number | null;
  promedioPonderado: number | null;
  totalResenas: number;
}

describe('Reputación (e2e)', () => {
  let app: INestApplication<App>;
  const runId = Date.now();
  const key = (s: string) => `rep-${runId}-${s}`;
  const http = () => request(app.getHttpServer());

  let comercioToken: string;
  let merchantId: string;
  const compradores: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.init();

    const registrar = async (sufijo: string, role?: string) => {
      const r = await http()
        .post('/api/v1/auth/register')
        .set('Idempotency-Key', key(sufijo))
        .send({
          email: `rep-${sufijo}-${runId}@test.com`,
          password: 'password123',
          role,
        })
        .expect(201);
      return (r.body as TokensBody).accessToken;
    };

    comercioToken = await registrar('com', 'comercio');
    for (let i = 0; i < 4; i++) {
      compradores.push(await registrar(`c${i}`));
    }

    const perfil = await http()
      .get('/api/v1/catalogo/mi-comercio')
      .set('Authorization', `Bearer ${comercioToken}`)
      .expect(200);
    merchantId = (perfil.body as { id: string }).id;
  });

  afterAll(async () => {
    await app.close();
  });

  /** Compra, entrega y reseña con la nota indicada. Devuelve la reseña. */
  const cicloConNota = async (
    compradorToken: string,
    sufijo: string,
    calificacion: number,
  ) => {
    const ahora = Date.now();
    const creado = await http()
      .post('/api/v1/catalogo/rescates')
      .set('Authorization', `Bearer ${comercioToken}`)
      .set('Idempotency-Key', key(`r-${sufijo}`))
      .send({
        titulo: `Rep ${sufijo} ${runId}`,
        precioCentavos: 400,
        cantidadTotal: 1,
        validoDesde: new Date(ahora - 60_000).toISOString(),
        validoHasta: new Date(ahora + 3_600_000).toISOString(),
      })
      .expect(201);
    const rescateId = (creado.body as { id: string }).id;

    await http()
      .patch(`/api/v1/catalogo/rescates/${rescateId}/publicar`)
      .set('Authorization', `Bearer ${comercioToken}`)
      .expect(200);

    const orden = await http()
      .post('/api/v1/ordenes')
      .set('Authorization', `Bearer ${compradorToken}`)
      .set('Idempotency-Key', key(`o-${sufijo}`))
      .send({ rescateId, cantidad: 1 })
      .expect(201);
    const ordenId = (orden.body as { id: string }).id;

    for (const accion of ['confirmar', 'cumplir']) {
      await http()
        .patch(`/api/v1/ordenes/${ordenId}/${accion}`)
        .set('Authorization', `Bearer ${comercioToken}`)
        .expect(200);
    }

    const resena = await http()
      .post(`/api/v1/ordenes/${ordenId}/resena`)
      .set('Authorization', `Bearer ${compradorToken}`)
      .send({ calificacion, comentario: `nota ${calificacion}` })
      .expect(201);
    return (resena.body as { id: string }).id;
  };

  const resumen = async () => {
    const r = await http()
      .get(`/api/v1/ordenes/reputacion/${merchantId}`)
      .set('Authorization', `Bearer ${comercioToken}`)
      .expect(200);
    return r.body as Resumen;
  };

  it('sin reseñas no hay nota, ni cruda ni ponderada', async () => {
    const r = await resumen();
    expect(r.promedio).toBeNull();
    expect(r.promedioPonderado).toBeNull();
    expect(r.totalResenas).toBe(0);
  });

  // El caso que justifica todo esto: un único 5 no puede valer lo mismo que
  // doscientas reseñas de 4,8.
  it('una sola reseña de 5 no da una nota de 5', async () => {
    await cicloConNota(compradores[0], 'uno', 5);
    const r = await resumen();

    expect(r.promedio).toBe(5);
    // (4,0 × 5 + 5) / (5 + 1) = 25/6 = 4,17
    expect(r.promedioPonderado).toBe(4.17);
    expect(r.promedioPonderado!).toBeLessThan(r.promedio!);
  });

  it('la ponderada se acerca a la cruda a medida que llegan reseñas', async () => {
    const antes = await resumen();
    await cicloConNota(compradores[1], 'dos', 5);
    await cicloConNota(compradores[2], 'tres', 5);
    const despues = await resumen();

    // (4,0 × 5 + 15) / (5 + 3) = 35/8 = 4,375 -> 4,38
    expect(despues.promedio).toBe(5);
    expect(despues.promedioPonderado).toBe(4.38);
    // Se acerca, no se aleja.
    expect(despues.promedioPonderado!).toBeGreaterThan(
      antes.promedioPonderado!,
    );
  });

  it('una nota mala baja la ponderada de inmediato', async () => {
    const antes = await resumen();
    await cicloConNota(compradores[3], 'mala', 1);
    const despues = await resumen();

    // (4,0 × 5 + 16) / (5 + 4) = 36/9 = 4,00
    expect(despues.promedio).toBe(4);
    expect(despues.promedioPonderado).toBe(4);
    expect(despues.promedioPonderado!).toBeLessThan(antes.promedioPonderado!);
  });

  describe('derecho de réplica', () => {
    let resenaId: string;
    let otroComercio: string;

    beforeAll(async () => {
      resenaId = await cicloConNota(compradores[0], 'replica', 2);

      const r = await http()
        .post('/api/v1/auth/register')
        .set('Idempotency-Key', key('otrocom'))
        .send({
          email: `rep-otro-${runId}@test.com`,
          password: 'password123',
          role: 'comercio',
        })
        .expect(201);
      otroComercio = (r.body as TokensBody).accessToken;
    });

    it('el comercio reseñado puede responder una vez', async () => {
      await http()
        .post(`/api/v1/ordenes/resenas/${resenaId}/responder`)
        .set('Authorization', `Bearer ${comercioToken}`)
        .send({ texto: 'Lamentamos la demora, ese día tuvimos un imprevisto.' })
        .expect(201);

      await http()
        .post(`/api/v1/ordenes/resenas/${resenaId}/responder`)
        .set('Authorization', `Bearer ${comercioToken}`)
        .send({ texto: 'Segunda vez' })
        .expect(409);
    });

    // 404 y no 403: un 403 confirmaría que la reseña existe a quien vaya
    // probando identificadores.
    it('otro comercio no puede responder ni enterarse de que existe', async () => {
      const otra = await cicloConNota(compradores[1], 'ajena', 3);
      await http()
        .post(`/api/v1/ordenes/resenas/${otra}/responder`)
        .set('Authorization', `Bearer ${otroComercio}`)
        .send({ texto: 'No es mía' })
        .expect(404);
    });

    it('un comprador no puede responder reseñas', async () => {
      const otra = await cicloConNota(compradores[2], 'comprador-resp', 3);
      await http()
        .post(`/api/v1/ordenes/resenas/${otra}/responder`)
        .set('Authorization', `Bearer ${compradores[2]}`)
        .send({ texto: 'Respondo a mi propia reseña' })
        .expect(403);
    });

    it('rechaza una respuesta vacía o de un carácter', async () => {
      const otra = await cicloConNota(compradores[3], 'vacia', 3);
      for (const texto of ['', '.', ' ']) {
        await http()
          .post(`/api/v1/ordenes/resenas/${otra}/responder`)
          .set('Authorization', `Bearer ${comercioToken}`)
          .send({ texto })
          .expect(400);
      }
    });

    it('responder no cambia la nota: la calificación es de quien compró', async () => {
      const antes = await resumen();
      const otra = await cicloConNota(compradores[0], 'nota-intacta', 1);
      const conNota = await resumen();

      await http()
        .post(`/api/v1/ordenes/resenas/${otra}/responder`)
        .set('Authorization', `Bearer ${comercioToken}`)
        .send({ texto: 'No estamos de acuerdo, pero lo tomamos en cuenta.' })
        .expect(201);

      const despues = await resumen();
      expect(despues.promedio).toBe(conNota.promedio);
      expect(despues.promedioPonderado).toBe(conNota.promedioPonderado);
      expect(despues.totalResenas).toBe(antes.totalResenas + 1);
    });
  });
});
