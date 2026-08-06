import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { ENTITIES } from './entities';

loadEnv();

// Used only by the TypeORM CLI (migration:generate / migration:run), never imported
// by the running application — the app gets its connection via DatabaseModule.
//
// The migrations glob is relative to __dirname (not "src/...") so this same file
// works two ways: via ts-node against src/database/migrations/*.ts in local dev,
// and via plain `node` against the compiled dist/database/migrations/*.js when the
// deploy pipeline runs migrations inside the production image (see package.json
// "migration:run:prod" and .github/workflows/deploy.yml).
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: ENTITIES,
  migrations: [`${__dirname}/migrations/*{.ts,.js}`],
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});
