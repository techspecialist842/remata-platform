import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/bootstrap';

// Smoke/contract coverage for the Fase 1 core APIs. Runs against a real
// Postgres (see .github/workflows/ci.yml's `postgres` service) — no mocks —
// because the acceptance criteria are about actual role-based access and
// actual token lifecycle, not just handler wiring.

interface AuthTokensBody {
  accessToken: string;
  refreshToken: string;
  userId: string;
}

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string;
  correlationId: string | null;
}

// supertest types `res.body` as `any`; funnel every read through these so the
// assertions below stay type-checked.
const asAuthBody = (body: unknown) => body as AuthTokensBody;
const asErrorBody = (body: unknown) => body as ErrorBody;

describe('Auth + Admin (e2e)', () => {
  let app: INestApplication<App>;
  // Unique per run (not just per test) so the suite is safe to re-run against
  // a persistent local DB — Idempotency-Key rows are permanent by design.
  const runId = Date.now();
  const email = `smoke-${runId}@test.com`;
  const idemKey = (suffix: string) => `e2e-${runId}-${suffix}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // Same options + same configureApp() as main.ts, so this suite exercises
    // the real middleware order rather than a test-only approximation.
    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects self-registration as admin', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Idempotency-Key', idemKey('admin-reject'))
      .send({ email: 'nope@test.com', password: 'password123', role: 'admin' })
      .expect(403);
  });

  it('registers a usuario and returns tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Idempotency-Key', idemKey('register-1'))
      .send({ email, password: 'password123', displayName: 'Smoke Test' })
      .expect(201);

    const body = asAuthBody(res.body);
    expect(body.accessToken).toEqual(expect.any(String));
    expect(body.refreshToken).toEqual(expect.any(String));
  });

  it('replays the same Idempotency-Key + body without creating a duplicate', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Idempotency-Key', idemKey('register-1'))
      .send({ email, password: 'password123', displayName: 'Smoke Test' })
      .expect(201);

    expect(asAuthBody(res.body).userId).toEqual(expect.any(String));
  });

  it('rejects the same Idempotency-Key reused with a different body', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Idempotency-Key', idemKey('register-1'))
      .send({ email: 'different@test.com', password: 'password123' })
      .expect(409);
  });

  it('logs in with correct credentials and rejects wrong ones', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(401);

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'password123' })
      .expect(201);

    expect(asAuthBody(res.body).accessToken).toEqual(expect.any(String));
  });

  it('rotates the refresh token and rejects reuse of the old one', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'password123' });
    const oldRefreshToken = asAuthBody(login.body).refreshToken;

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: oldRefreshToken })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: oldRefreshToken })
      .expect(401);
  });

  it('blocks a usuario from an admin-only endpoint (RBAC)', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'password123' });

    await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${asAuthBody(login.body).accessToken}`)
      .expect(403);
  });

  it('rejects an unauthenticated request to a protected endpoint', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/users').expect(401);
  });

  it('stamps a generated X-Correlation-Id on every response, and echoes a supplied one', async () => {
    const auto = await request(app.getHttpServer()).get('/api/health');
    expect(auto.headers['x-correlation-id']).toEqual(expect.any(String));

    const withHeader = await request(app.getHttpServer())
      .get('/api/health')
      .set('X-Correlation-Id', 'e2e-fixed-trace-id');
    expect(withHeader.headers['x-correlation-id']).toBe('e2e-fixed-trace-id');
  });

  // Regression guard: malformed JSON throws inside the body parser, so the
  // correlation middleware has to run BEFORE it (see main.ts) or this class of
  // error comes back untraceable.
  it('still returns a correlation id when the JSON body is malformed', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "a@b.com" "password": "missing-comma"}')
      .expect(400);

    expect(res.headers['x-correlation-id']).toEqual(expect.any(String));
    expect(asErrorBody(res.body).correlationId).toEqual(expect.any(String));
  });
});
