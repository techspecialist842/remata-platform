import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/bootstrap';
import { ReportesService } from './../src/catalogo/reportes.service';
import { ModeracionService } from './../src/admin/moderacion.service';
import { DataSource } from 'typeorm';

// Moderación reactiva.
//
// Lo que se prueba no es que se pueda reportar, sino lo contrario: que reportar
// NO tumbe nada por sí solo. Si bastara una denuncia para sacar una oferta del
// catálogo, hundir a la competencia costaría un clic.

interface TokensBody {
  accessToken: string;
}
interface Cola {
  items: {
    rescate: { id: string } | null;
    reportes: number;
    motivos: { motivo: string; nota: string | null }[];
  }[];
  total: number;
}

describe('Moderación (e2e)', () => {
  let app: INestApplication<App>;
  const runId = Date.now();
  const key = (s: string) => `mod-${runId}-${s}`;
  const http = () => request(app.getHttpServer());

  let comercioToken: string;
  let compradorA: string;
  let compradorB: string;
  let ds: DataSource;
  let reportes: ReportesService;
  let moderacion: ModeracionService;

  const registrar = async (sufijo: string, role?: string) => {
    const r = await http()
      .post('/api/v1/auth/register')
      .set('Idempotency-Key', key(sufijo))
      .send({
        email: `mod-${sufijo}-${runId}@test.com`,
        password: 'password123',
        role,
      })
      .expect(201);
    return (r.body as TokensBody).accessToken;
  };

  const publicar = async (sufijo: string) => {
    const ahora = Date.now();
    const r = await http()
      .post('/api/v1/catalogo/rescates')
      .set('Authorization', `Bearer ${comercioToken}`)
      .set('Idempotency-Key', key(`resc-${sufijo}`))
      .send({
        titulo: `Moderar ${sufijo} ${runId}`,
        precioCentavos: 500,
        cantidadTotal: 3,
        validoDesde: new Date(ahora - 60_000).toISOString(),
        validoHasta: new Date(ahora + 3_600_000).toISOString(),
      })
      .expect(201);
    const id = (r.body as { id: string }).id;
    await http()
      .patch(`/api/v1/catalogo/rescates/${id}/publicar`)
      .set('Authorization', `Bearer ${comercioToken}`)
      .expect(200);
    return id;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.init();

    ds = app.get(DataSource);
    reportes = app.get(ReportesService);
    moderacion = app.get(ModeracionService);

    comercioToken = await registrar('com', 'comercio');
    compradorA = await registrar('cmpa');
    compradorB = await registrar('cmpb');
  });

  afterAll(async () => {
    // La suite limpia lo suyo: sin esto la cola crece sin límite entre
    // ejecuciones y acaba empujando fuera de las primeras páginas justo lo que
    // la siguiente corrida quiere comprobar.
    // SQL directo: el constructor de consultas espera nombres de propiedad de
    // la entidad y aquí se razona en columnas, que es lo natural para una
    // limpieza.
    await ds.query(
      `UPDATE reportes SET revisado_at = now()
        WHERE revisado_at IS NULL
          AND rescate_id IN (SELECT id FROM rescates WHERE titulo LIKE $1)`,
      [`Moderar %${runId}`],
    );

    await app.close();
  });

  // El corazón del diseño: la denuncia abre un expediente, no ejecuta la pena.
  it('reportar no saca la publicación del catálogo', async () => {
    const rescateId = await publicar('sigue');

    await http()
      .post(`/api/v1/catalogo/rescates/${rescateId}/reportar`)
      .set('Authorization', `Bearer ${compradorA}`)
      .send({ motivo: 'enganoso', nota: 'La foto no corresponde' })
      .expect(201);

    // Sigue comprable.
    await http().get(`/api/v1/catalogo/rescates/${rescateId}`).expect(200);
  });

  it('la misma persona no puede reportar dos veces lo mismo', async () => {
    const rescateId = await publicar('doble');

    await http()
      .post(`/api/v1/catalogo/rescates/${rescateId}/reportar`)
      .set('Authorization', `Bearer ${compradorA}`)
      .send({ motivo: 'precio_incorrecto' })
      .expect(201);

    await http()
      .post(`/api/v1/catalogo/rescates/${rescateId}/reportar`)
      .set('Authorization', `Bearer ${compradorA}`)
      .send({ motivo: 'inseguro' })
      .expect(409);
  });

  it('personas distintas sí suman al mismo expediente', async () => {
    const rescateId = await publicar('dos');

    for (const t of [compradorA, compradorB]) {
      await http()
        .post(`/api/v1/catalogo/rescates/${rescateId}/reportar`)
        .set('Authorization', `Bearer ${t}`)
        .send({ motivo: 'inseguro' })
        .expect(201);
    }
  });

  it('reportar exige sesión', async () => {
    const rescateId = await publicar('anon');
    await http()
      .post(`/api/v1/catalogo/rescates/${rescateId}/reportar`)
      .send({ motivo: 'otro', nota: 'sin sesión' })
      .expect(401);
  });

  it('rechaza un motivo inventado', async () => {
    const rescateId = await publicar('motivo');
    await http()
      .post(`/api/v1/catalogo/rescates/${rescateId}/reportar`)
      .set('Authorization', `Bearer ${compradorA}`)
      .send({ motivo: 'no_me_gusta' })
      .expect(400);
  });

  it('no se puede reportar algo que no existe', async () => {
    await http()
      .post(
        '/api/v1/catalogo/rescates/00000000-0000-4000-8000-000000000000/reportar',
      )
      .set('Authorization', `Bearer ${compradorA}`)
      .send({ motivo: 'otro' })
      .expect(404);
  });

  it('un comprador no puede ver la cola de moderación', async () => {
    await http()
      .get('/api/v1/admin/reportes')
      .set('Authorization', `Bearer ${compradorA}`)
      .expect(403);
  });

  it('la cola exige sesión', async () => {
    await http().get('/api/v1/admin/reportes').expect(401);
  });

  // La cola se ejercita contra el servicio, no por HTTP: crear un
  // administrador exige el ciclo completo de alta de MFA, y lo que hay que
  // verificar acá es la agrupación y el orden, no el control de acceso —eso ya
  // lo cubren los dos casos de arriba.
  describe('la cola de revisión', () => {
    const ADMIN = '00000000-0000-4000-8000-00000000ad11';

    it('agrupa por publicación y ordena por número de denuncias', async () => {
      const unaVez = await publicar('cola-una');
      const dosVeces = await publicar('cola-dos');

      await http()
        .post(`/api/v1/catalogo/rescates/${unaVez}/reportar`)
        .set('Authorization', `Bearer ${compradorA}`)
        .send({ motivo: 'otro', nota: 'una sola' })
        .expect(201);

      for (const t of [compradorA, compradorB]) {
        await http()
          .post(`/api/v1/catalogo/rescates/${dosVeces}/reportar`)
          .set('Authorization', `Bearer ${t}`)
          .send({ motivo: 'enganoso' })
          .expect(201);
      }

      // La cola es global y acumula lo de ejecuciones anteriores, así que no
      // se puede dar por hecho que lo de esta corrida caiga en la primera
      // página. Se recorren páginas conservando el orden que devuelve la API,
      // que es justamente lo que se quiere comprobar.
      const items: Cola['items'] = [];
      for (let pagina = 1; pagina <= 20; pagina++) {
        const p = (await reportes.cola(pagina, 50)) as Cola;
        items.push(...p.items);
        if (p.items.length < 50) break;
      }

      const cola = { items } as Cola;
      const conDos = cola.items.find((i) => i.rescate?.id === dosVeces);
      const conUna = cola.items.find((i) => i.rescate?.id === unaVez);

      expect(conDos?.reportes).toBe(2);
      expect(conUna?.reportes).toBe(1);
      // Dos denuncias pesan más que una: aparece antes en la cola.
      expect(cola.items.indexOf(conDos!)).toBeLessThan(
        cola.items.indexOf(conUna!),
      );
      // Las notas llegan para poder decidir sin abrir cada reporte.
      expect(conUna?.motivos).toContainEqual({
        motivo: 'otro',
        nota: 'una sola',
      });
    });

    it('descartar saca la publicación de la cola', async () => {
      const rescateId = await publicar('cola-descartar');
      await http()
        .post(`/api/v1/catalogo/rescates/${rescateId}/reportar`)
        .set('Authorization', `Bearer ${compradorA}`)
        .send({ motivo: 'no_disponible' })
        .expect(201);

      const enCola = () =>
        reportes
          .cola(1, 100)
          .then((c) =>
            (c as Cola).items.some((i) => i.rescate?.id === rescateId),
          );

      expect(await enCola()).toBe(true);
      await reportes.descartar(ADMIN, rescateId);
      expect(await enCola()).toBe(false);

      // Y la publicación sigue viva: se revisó, no había motivo.
      await http().get(`/api/v1/catalogo/rescates/${rescateId}`).expect(200);
    });

    it('descartar dos veces falla: ya no hay nada abierto', async () => {
      const rescateId = await publicar('cola-doble-descarte');
      await http()
        .post(`/api/v1/catalogo/rescates/${rescateId}/reportar`)
        .set('Authorization', `Bearer ${compradorB}`)
        .send({ motivo: 'otro' })
        .expect(201);

      await reportes.descartar(ADMIN, rescateId);
      await expect(reportes.descartar(ADMIN, rescateId)).rejects.toThrow();
    });

    // Sin esto la publicación retirada seguiría en la cola para siempre, y la
    // cola dejaría de significar «pendiente de mirar».
    it('retirar la publicación también cierra sus denuncias', async () => {
      const rescateId = await publicar('cola-retirar');
      await http()
        .post(`/api/v1/catalogo/rescates/${rescateId}/reportar`)
        .set('Authorization', `Bearer ${compradorA}`)
        .send({ motivo: 'inseguro' })
        .expect(201);

      await moderacion.retirar(ADMIN, rescateId, 'Producto en mal estado');

      const cola = (await reportes.cola(1, 100)) as Cola;
      expect(cola.items.some((i) => i.rescate?.id === rescateId)).toBe(false);
    });
  });
});
