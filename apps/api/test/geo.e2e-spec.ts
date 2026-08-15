import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/bootstrap';

// Búsqueda por cercanía.
//
// Las coordenadas son puntos reales de Ciudad de Panamá y las distancias
// esperadas están medidas, no inventadas: una fórmula de distancia que se
// prueba contra sus propios supuestos no prueba nada.
//
//   Cinta Costera        8.9800, -79.5200
//   Casco Antiguo        8.9530, -79.5370   ~3,54 km de la Cinta Costera
//   Aeropuerto Tocumen   9.0714, -79.3835   ~18,1 km de la Cinta Costera
//
// Comprobación a mano del primero, para que las cifras de abajo no sean solo
// «lo que devolvió el código»:
//   Δlat 0,027° × 111,32           = 3,006 km
//   Δlng 0,017° × 111,32 × cos(9°) = 1,869 km
//   √(3,006² + 1,869²)             = 3,54 km

const CINTA = { lat: 8.98, lng: -79.52 };
const CASCO = { lat: 8.953, lng: -79.537 };
const TOCUMEN = { lat: 9.0714, lng: -79.3835 };

interface TokensBody {
  accessToken: string;
}
interface RescateBody {
  id: string;
}
interface Pagina {
  items: { id: string; titulo: string; distanciaKm?: number }[];
  total: number;
}

describe('Catálogo por cercanía (e2e)', () => {
  let app: INestApplication<App>;
  const runId = Date.now();
  const key = (s: string) => `geo-${runId}-${s}`;
  const http = () => request(app.getHttpServer());

  /** Un comercio con su punto de retiro y un rescate publicado. */
  const comercioEn = async (
    sufijo: string,
    punto: { lat: number; lng: number } | null,
  ) => {
    const reg = await http()
      .post('/api/v1/auth/register')
      .set('Idempotency-Key', key(`reg-${sufijo}`))
      .send({
        email: `geo-${sufijo}-${runId}@test.com`,
        password: 'password123',
        displayName: `Comercio ${sufijo}`,
        role: 'comercio',
      })
      .expect(201);
    const token = (reg.body as TokensBody).accessToken;

    if (punto) {
      await http()
        .patch('/api/v1/catalogo/mi-comercio/ubicacion')
        .set('Authorization', `Bearer ${token}`)
        .send({
          direccion: `Local ${sufijo}`,
          latitud: punto.lat,
          longitud: punto.lng,
        })
        .expect(200);
    }

    const ahora = Date.now();
    const creado = await http()
      .post('/api/v1/catalogo/rescates')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key(`resc-${sufijo}`))
      .send({
        titulo: `Geo ${sufijo} ${runId}`,
        precioCentavos: 500,
        cantidadTotal: 5,
        validoDesde: new Date(ahora - 60_000).toISOString(),
        validoHasta: new Date(ahora + 3_600_000).toISOString(),
      })
      .expect(201);

    const id = (creado.body as RescateBody).id;
    await http()
      .patch(`/api/v1/catalogo/rescates/${id}/publicar`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return { token, rescateId: id };
  };

  const buscarCerca = async (
    punto: { lat: number; lng: number },
    radioKm: number,
  ) => {
    const r = await http()
      .get('/api/v1/catalogo/rescates')
      .query({ q: `Geo `, lat: punto.lat, lng: punto.lng, radioKm })
      .expect(200);
    return r.body as Pagina;
  };

  let cerca: { rescateId: string };
  let lejos: { rescateId: string };
  let sinUbicacion: { rescateId: string };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.init();

    cerca = await comercioEn('casco', CASCO);
    lejos = await comercioEn('tocumen', TOCUMEN);
    sinUbicacion = await comercioEn('sinubi', null);
  });

  afterAll(async () => {
    await app.close();
  });

  const idsDe = (p: Pagina) => p.items.map((i) => i.id);

  it('un radio corto trae el local cercano y descarta el lejano', async () => {
    const p = await buscarCerca(CINTA, 5);

    expect(idsDe(p)).toContain(cerca.rescateId);
    expect(idsDe(p)).not.toContain(lejos.rescateId);
  });

  it('un radio amplio alcanza también el local lejano', async () => {
    const p = await buscarCerca(CINTA, 25);

    expect(idsDe(p)).toContain(cerca.rescateId);
    expect(idsDe(p)).toContain(lejos.rescateId);
  });

  // Es el fallo clásico de la caja delimitadora: el cuadrado que envuelve al
  // círculo mete las esquinas, hasta un 41% más lejos de lo pedido. Tocumen
  // está a ~18 km de la Cinta Costera, dentro de la caja de 17 km pero fuera
  // del círculo, así que no debe aparecer.
  it('no cuela los puntos de las esquinas de la caja', async () => {
    const p = await buscarCerca(CINTA, 17);

    expect(idsDe(p)).not.toContain(lejos.rescateId);
  });

  it('calcula la distancia con precisión razonable', async () => {
    const p = await buscarCerca(CINTA, 25);

    const casco = p.items.find((i) => i.id === cerca.rescateId);
    const tocumen = p.items.find((i) => i.id === lejos.rescateId);

    // Medidas contra las coordenadas reales, con holgura para la aproximación
    // esférica frente al elipsoide.
    expect(casco!.distanciaKm).toBeGreaterThan(3.4);
    expect(casco!.distanciaKm).toBeLessThan(3.7);
    expect(tocumen!.distanciaKm).toBeGreaterThan(17.8);
    expect(tocumen!.distanciaKm).toBeLessThan(18.5);
  });

  it('ordena por distancia, no por vencimiento', async () => {
    const p = await buscarCerca(CINTA, 25);
    const distancias = p.items.map((i) => i.distanciaKm!);

    expect(distancias).toEqual([...distancias].sort((a, b) => a - b));
  });

  // Un comercio sin coordenadas sigue vendiendo: simplemente no participa de
  // las búsquedas por cercanía. Quedaría invisible si lo devolviéramos con
  // distancia nula, y sería mentira si le inventáramos una.
  it('deja fuera a los comercios sin ubicación fijada', async () => {
    const p = await buscarCerca(CINTA, 100);
    expect(idsDe(p)).not.toContain(sinUbicacion.rescateId);

    const sinGeo = await http()
      .get('/api/v1/catalogo/rescates')
      .query({ q: `Geo sinubi ${runId}` })
      .expect(200);
    // Pero sí aparece en la búsqueda normal.
    expect(idsDe(sinGeo.body as Pagina)).toContain(sinUbicacion.rescateId);
  });

  it('sin cercanía pedida no devuelve distancia inventada', async () => {
    const r = await http()
      .get('/api/v1/catalogo/rescates')
      .query({ q: `Geo casco ${runId}` })
      .expect(200);

    expect((r.body as Pagina).items[0]).not.toHaveProperty('distanciaKm');
  });

  it('rechaza media coordenada en la búsqueda', async () => {
    await http()
      .get('/api/v1/catalogo/rescates')
      .query({ lat: CINTA.lat, radioKm: 5 })
      .expect(400);
  });

  it('rechaza guardar media coordenada en el comercio', async () => {
    const reg = await http()
      .post('/api/v1/auth/register')
      .set('Idempotency-Key', key('reg-media'))
      .send({
        email: `geo-media-${runId}@test.com`,
        password: 'password123',
        role: 'comercio',
      })
      .expect(201);

    await http()
      .patch('/api/v1/catalogo/mi-comercio/ubicacion')
      .set('Authorization', `Bearer ${(reg.body as TokensBody).accessToken}`)
      .send({ latitud: CINTA.lat })
      .expect(400);
  });

  it('rechaza coordenadas fuera del planeta', async () => {
    await http()
      .get('/api/v1/catalogo/rescates')
      .query({ lat: 91, lng: 0, radioKm: 5 })
      .expect(400);
  });
});
