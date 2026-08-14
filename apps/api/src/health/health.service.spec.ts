import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;
  let queryMock: jest.Mock;

  beforeEach(async () => {
    queryMock = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: getDataSourceToken(),
          useValue: { query: queryMock },
        },
      ],
    }).compile();

    service = module.get(HealthService);
  });

  it('returns status ok when the database query succeeds', async () => {
    queryMock.mockResolvedValue([{ '?column?': 1 }]);

    const result = await service.check();

    expect(result.status).toBe('ok');
    expect(result.database).toBe('up');
  });

  it('returns status error when the database query fails', async () => {
    queryMock.mockRejectedValue(new Error('connection refused'));

    const result = await service.check();

    expect(result.status).toBe('error');
    expect(result.database).toBe('down');
  });
});
