import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'node:path';

export function buildTypeOrmConfig(config: ConfigService): TypeOrmModuleOptions {
  const databaseUrl = config.get<string>('DATABASE_URL');
  const isProd = config.get<string>('NODE_ENV') === 'production';
  const sslEnabled =
    config.get<string>('DB_SSL') === 'true' ||
    (isProd && !!databaseUrl) ||
    (databaseUrl !== undefined && !databaseUrl.includes('localhost'));

  const baseConfig: TypeOrmModuleOptions = {
    type: 'postgres',
    autoLoadEntities: true,
    // O schema vem exclusivamente das migrations (rodadas no boot).
    synchronize: false,
    migrationsRun: true,
    migrations: [join(__dirname, '..', 'migrations', '*.{ts,js}')],
    retryAttempts: 3,
    retryDelay: 2000,
    ssl: sslEnabled ? { rejectUnauthorized: false } : false,
    extra: sslEnabled ? { ssl: { rejectUnauthorized: false } } : undefined,
  };

  if (databaseUrl) {
    return {
      ...baseConfig,
      url: databaseUrl,
    };
  }

  return {
    ...baseConfig,
    host: config.get<string>('DB_HOST', 'localhost'),
    port: config.get<number>('DB_PORT', 5432),
    username: config.get<string>('DB_USERNAME', 'postgres'),
    password: config.get<string>('DB_PASSWORD', 'postgres'),
    database: config.get<string>('DB_NAME', 'estudeai'),
  };
}
