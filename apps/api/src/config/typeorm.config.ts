import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'node:path';

export function buildTypeOrmConfig(config: ConfigService): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: config.get<string>('DB_HOST', 'localhost'),
    port: config.get<number>('DB_PORT', 5432),
    username: config.get<string>('DB_USERNAME', 'postgres'),
    password: config.get<string>('DB_PASSWORD', 'postgres'),
    database: config.get<string>('DB_NAME', 'estudeai'),
    autoLoadEntities: true,
    // O schema vem exclusivamente das migrations (rodadas no boot).
    synchronize: false,
    migrationsRun: true,
    migrations: [join(__dirname, '..', 'migrations', '*.{ts,js}')],
    retryAttempts: 3,
    retryDelay: 2000,
  };
}
