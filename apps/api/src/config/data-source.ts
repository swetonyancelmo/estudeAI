import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { join } from 'node:path';

// DataSource usado apenas pela CLI do TypeORM (migration:generate/run/revert).
// A aplicação em si configura o TypeORM via buildTypeOrmConfig (typeorm.config.ts).
loadEnv();

const dbUrl = process.env.DATABASE_URL;
const isProd = process.env.NODE_ENV === 'production';
const ssl =
  process.env.DB_SSL === 'true' ||
  (dbUrl !== undefined && !dbUrl.includes('localhost')) ||
  (isProd && process.env.DB_HOST !== 'localhost');

export default new DataSource(
  dbUrl
    ? {
        type: 'postgres',
        url: dbUrl,
        ssl: ssl ? { rejectUnauthorized: false } : false,
        extra: ssl ? { ssl: { rejectUnauthorized: false } } : undefined,
        entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
        migrations: [join(__dirname, '..', 'migrations', '*.{ts,js}')],
        synchronize: false,
      }
    : {
        type: 'postgres',
        host: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? 5432),
        username: process.env.DB_USERNAME ?? 'postgres',
        password: process.env.DB_PASSWORD ?? 'postgres',
        database: process.env.DB_NAME ?? 'estudeai',
        ssl: ssl ? { rejectUnauthorized: false } : false,
        extra: ssl ? { ssl: { rejectUnauthorized: false } } : undefined,
        entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
        migrations: [join(__dirname, '..', 'migrations', '*.{ts,js}')],
        synchronize: false,
      },
);
