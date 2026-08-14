import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { HealthStatusDto } from '@estudeai/shared-types';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async check(): Promise<HealthStatusDto> {
    const timestamp = new Date().toISOString();

    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok', database: 'up', timestamp };
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return { status: 'error', database: 'down', timestamp };
    }
  }
}
