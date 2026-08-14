import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

describe('UsersService', () => {
  let service: UsersService;
  let repo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      create: jest.fn((v) => v),
      save: jest.fn((v) => Promise.resolve({ id: 'user-1', ...v })),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repo },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  it('findByEmail consulta pelo e-mail', async () => {
    repo.findOne.mockResolvedValue(null);
    await service.findByEmail('dev@estude.ai');
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { email: 'dev@estude.ai' },
    });
  });

  it('create monta e persiste o usuário', async () => {
    const user = await service.create('dev@estude.ai', 'hashed');
    expect(repo.create).toHaveBeenCalledWith({
      email: 'dev@estude.ai',
      passwordHash: 'hashed',
    });
    expect(repo.save).toHaveBeenCalled();
    expect(user.id).toBe('user-1');
  });
});
