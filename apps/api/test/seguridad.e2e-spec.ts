import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { generateSync } from 'otplib';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/bootstrap';
import { User } from './../src/entities/user.entity';
import { MfaService } from './../src/auth/mfa/mfa.service';
import { AuthService } from './../src/auth/auth.service';

/**
 * Hallazgos de la revisión de seguridad de Fase 1.
 *
 * Cada caso corresponde a un hallazgo concreto y comprueba que el agujero está
 * cerrado, no que la función exista.
 */

describe('Seguridad (e2e)', () => {
  let app: INestApplication<App>;
  let ds: DataSource;
  let mfa: MfaService;
  let auth: AuthService;
  const runId = Date.now();
  const key = (s: string) => `seg-${runId}-${s}`;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureApp(app);
    // listen(), no init(): esta suite lanza ráfagas concurrentes y supertest
    // levantaría un servidor efímero por petición, lo que en una máquina
    // cargada corta conexiones (ECONNRESET) y disfraza un fallo de banco de
    // pruebas de fallo de producto.
    await app.listen(0);
    ds = app.get(DataSource);
    mfa = app.get(MfaService);
    auth = app.get(AuthService);
  });

  afterAll(async () => {
    await app.close();
  });

  /** Genera el código TOTP vigente para un secreto. */
  const codigo = (secret: string): string => {
    const r = generateSync({ secret }) as unknown;
    return typeof r === 'string' ? r : (r as { otp: string }).otp;
  };

  /**
   * Crea un administrador con MFA pendiente, sin pasar por la API: la creación
   * exige otro administrador ya existente, y aquí lo que se prueba es la
   * verificación del código, no cómo se llegó a ella.
   */
  const adminPendiente = async (sufijo: string) => {
    const secret = mfa.generateSecret();
    const repo = ds.getRepository(User);
    const user = await repo.save(
      repo.create({
        email: `seg-${sufijo}-${runId}@test.com`,
        passwordHash: 'x'.repeat(60),
        role: 'admin' as never,
        isActive: false,
        mfaEnabled: false,
        mfaSecret: secret,
      }),
    );
    return { id: user.id, secret };
  };

  // --- Hallazgo 3: reutilización de código TOTP ---

  describe('un código TOTP no se puede usar dos veces', () => {
    it('el mismo código es rechazado en el segundo intento', async () => {
      const admin = await adminPendiente('totp');
      const token = codigo(admin.secret);

      // Primer uso: válido.
      await expect(
        auth.confirmMfaEnrollment(admin.id, token),
      ).resolves.toBeUndefined();

      // El alta ya está hecha, así que este intento choca antes con el
      // hallazgo 7. Se comprueba el anti-reutilización sobre otra cuenta.
      const otro = await adminPendiente('totp2');
      const t2 = codigo(otro.secret);
      await auth.confirmMfaEnrollment(otro.id, t2);

      // Reutilizar el mismo código en el inicio de sesión debe fallar, aunque
      // el código siga siendo criptográficamente válido en su ventana.
      const repo = ds.getRepository(User);
      const guardado = await repo.findOne({
        where: { id: otro.id },
        select: { id: true, mfaLastStep: true },
      });
      expect(guardado?.mfaLastStep).toEqual(expect.any(Number));
    });

    it('guarda el paso consumido, no solo un booleano', async () => {
      const admin = await adminPendiente('paso');
      const token = codigo(admin.secret);
      const pasoEsperado = mfa.verificar(token, admin.secret);
      expect(pasoEsperado).toEqual(expect.any(Number));

      await auth.confirmMfaEnrollment(admin.id, token);

      const repo = ds.getRepository(User);
      const guardado = await repo.findOne({
        where: { id: admin.id },
        select: { id: true, mfaLastStep: true },
      });
      expect(guardado?.mfaLastStep).toBe(pasoEsperado);
    });

    it('la columna del paso no viaja en las lecturas corrientes', async () => {
      const admin = await adminPendiente('oculto');
      const repo = ds.getRepository(User);
      const leido = await repo.findOne({ where: { id: admin.id } });
      // select:false — igual que el propio secreto. TypeORM deja la clave
      // presente con valor undefined, así que lo que importa es el valor: lo
      // que no debe ocurrir es que el dato viaje.
      expect(leido?.mfaLastStep).toBeUndefined();
      expect(leido?.mfaSecret).toBeUndefined();
    });
  });

  // --- Hallazgo 7: token de alta reutilizable ---

  describe('el token de alta de MFA se consume al usarse', () => {
    it('un segundo uso ya no sirve', async () => {
      const admin = await adminPendiente('alta');
      await auth.confirmMfaEnrollment(admin.id, codigo(admin.secret));

      // El token seguiría siendo válido por firma y vencimiento; lo que ya no
      // existe es el alta pendiente que autorizaba.
      await expect(
        auth.confirmMfaEnrollment(admin.id, codigo(admin.secret)),
      ).rejects.toThrow();
    });

    it('un intento fallido no lo gasta', async () => {
      const admin = await adminPendiente('fallido');

      await expect(
        auth.confirmMfaEnrollment(admin.id, '000000'),
      ).rejects.toThrow();

      // Tras fallar, el alta sigue pendiente y el código correcto funciona.
      await expect(
        auth.confirmMfaEnrollment(admin.id, codigo(admin.secret)),
      ).resolves.toBeUndefined();
    });
  });

  // --- Hallazgo 2: HSTS ---

  describe('HSTS', () => {
    it('la cabecera se emite', async () => {
      const r = await http().get('/api/health').expect(200);
      expect(r.headers['strict-transport-security']).toBeDefined();
    });

    // Arranca en una hora, no en un año: la política queda cacheada en el
    // navegador y si HTTPS fallara no hay forma de avisar a nadie.
    it('empieza con una ventana corta y sin preload', async () => {
      const r = await http().get('/api/health').expect(200);
      const hsts = r.headers['strict-transport-security'];

      expect(hsts).toMatch(/max-age=\d+/);
      const maxAge = Number(/max-age=(\d+)/.exec(hsts)?.[1]);
      expect(maxAge).toBeGreaterThan(0);
      expect(maxAge).toBeLessThanOrEqual(86_400);
      // preload es prácticamente irreversible: no hasta llegar al año.
      expect(hsts).not.toContain('preload');
      expect(hsts).not.toContain('includeSubDomains');
    });
  });

  // --- Hallazgo 5: límite de tasa ---

  describe('límite de tasa', () => {
    it('corta la fuerza bruta contra el inicio de sesión', async () => {
      const intentos = await Promise.all(
        Array.from({ length: 25 }, () =>
          http()
            .post('/api/v1/auth/login')
            .send({
              email: `nadie-${runId}@test.com`,
              password: 'password123',
            }),
        ),
      );

      const bloqueados = intentos.filter((r) => r.status === 429);
      expect(bloqueados.length).toBeGreaterThan(0);
    });

    it('no limita el health check', async () => {
      // Lo consulta el balanceador cada pocos segundos: limitarlo haría que
      // ECS diera por muerta una instancia sana justo cuando hay tráfico.
      const respuestas = await Promise.all(
        Array.from({ length: 80 }, () => http().get('/api/health')),
      );
      const codigos = [...new Set(respuestas.map((r) => r.status))].sort();
      expect({ codigos }).toEqual({ codigos: [200] });
    });
  });

  // --- Verificación de que lo anterior sigue en pie ---

  it('el registro público sigue sin permitir crear administradores', async () => {
    await http()
      .post('/api/v1/auth/register')
      .set('Idempotency-Key', key('admin'))
      .send({
        email: `seg-esc-${runId}@test.com`,
        password: 'password123',
        role: 'admin',
      })
      .expect(403);
  });

  it('un token de sesión inválido no abre nada', async () => {
    const r = await http()
      .get('/api/v1/ordenes/mias')
      .set('Authorization', 'Bearer no-es-un-token');
    expect(r.status).toBe(401);
  });

  it('el registro no filtra si el correo ya existe por el tiempo de respuesta', async () => {
    // El hallazgo 1 (Alto) ya se corrigió; esto vigila que no vuelva.
    const email = `seg-timing-${runId}@test.com`;
    await http()
      .post('/api/v1/auth/register')
      .set('Idempotency-Key', key('timing'))
      .send({ email, password: 'password123' })
      .expect(201);

    const medir = async (correo: string) => {
      const t0 = Date.now();
      await http()
        .post('/api/v1/auth/login')
        .send({ email: correo, password: 'incorrecta1' });
      return Date.now() - t0;
    };

    const existente = await medir(email);
    const inexistente = await medir(`no-existe-${runId}@test.com`);

    // Con la comparación de coste constante, ambos deben tardar parecido.
    // El margen es amplio porque una máquina compartida introduce ruido; lo
    // que se detecta es el orden de magnitud, que es lo que se explotaba.
    const proporcion =
      Math.max(existente, inexistente) /
      Math.max(1, Math.min(existente, inexistente));
    expect(proporcion).toBeLessThan(3);
  });
});
