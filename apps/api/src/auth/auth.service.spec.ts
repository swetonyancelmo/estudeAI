import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from '../users/entities/user.entity';

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<Pick<UsersService, 'findByEmail' | 'findById' | 'create'>>;
  let refreshRepo: {
    findOne: jest.Mock;
    delete: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };

  const buildUser = (over: Partial<User> = {}): User =>
    ({
      id: 'user-1',
      email: 'dev@estude.ai',
      passwordHash: 'hash',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      refreshTokens: [],
      ...over,
    }) as User;

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    };
    refreshRepo = {
      findOne: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
      // `create` só monta a entidade; `save` persiste.
      create: jest.fn((v) => v),
      save: jest.fn((v) => Promise.resolve(v)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        {
          provide: JwtService,
          useValue: { signAsync: jest.fn().mockResolvedValue('access.jwt') },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('7') },
        },
        { provide: getRepositoryToken(RefreshToken), useValue: refreshRepo },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('register', () => {
    it('faz hash da senha, cria o usuário e emite sessão', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      const created = buildUser();
      usersService.create.mockResolvedValue(created);

      const session = await service.register('dev@estude.ai', 'supersecret');

      expect(usersService.create).toHaveBeenCalledTimes(1);
      const [, storedHash] = usersService.create.mock.calls[0];
      expect(storedHash).not.toBe('supersecret');
      await expect(bcrypt.compare('supersecret', storedHash)).resolves.toBe(true);

      expect(session.response.accessToken).toBe('access.jwt');
      expect(session.response.user.email).toBe('dev@estude.ai');
      expect(session.refreshToken).toEqual(expect.any(String));
      expect(refreshRepo.save).toHaveBeenCalledTimes(1);
    });

    it('lança Conflict quando o e-mail já existe', async () => {
      usersService.findByEmail.mockResolvedValue(buildUser());
      await expect(service.register('dev@estude.ai', 'x')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(usersService.create).not.toHaveBeenCalled();
    });
  });

  describe('validateUser', () => {
    it('retorna o usuário quando a senha confere', async () => {
      const passwordHash = await bcrypt.hash('supersecret', 4);
      usersService.findByEmail.mockResolvedValue(buildUser({ passwordHash }));

      const result = await service.validateUser('dev@estude.ai', 'supersecret');
      expect(result?.id).toBe('user-1');
    });

    it('retorna null quando a senha não confere', async () => {
      const passwordHash = await bcrypt.hash('supersecret', 4);
      usersService.findByEmail.mockResolvedValue(buildUser({ passwordHash }));

      const result = await service.validateUser('dev@estude.ai', 'errada');
      expect(result).toBeNull();
    });

    it('retorna null quando o usuário não existe', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      const result = await service.validateUser('nao@existe.ai', 'x');
      expect(result).toBeNull();
    });
  });

  describe('refresh', () => {
    it('rotaciona: invalida o token atual e emite um novo', async () => {
      const user = buildUser();
      refreshRepo.findOne.mockResolvedValue({
        id: 'rt-1',
        tokenHash: sha256('raw-token'),
        userId: user.id,
        user,
        expiresAt: new Date(Date.now() + 60_000),
      });

      const session = await service.refresh('raw-token');

      // o registro antigo foi apagado (rotação)
      expect(refreshRepo.delete).toHaveBeenCalledWith({ id: 'rt-1' });
      // e um novo foi persistido
      expect(refreshRepo.save).toHaveBeenCalledTimes(1);
      expect(session.refreshToken).not.toBe('raw-token');
      expect(session.response.accessToken).toBe('access.jwt');
    });

    it('rejeita token inexistente (possível reuso) com 401', async () => {
      refreshRepo.findOne.mockResolvedValue(null);
      await expect(service.refresh('desconhecido')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(refreshRepo.save).not.toHaveBeenCalled();
    });

    it('rejeita token expirado com 401 e o apaga', async () => {
      refreshRepo.findOne.mockResolvedValue({
        id: 'rt-old',
        tokenHash: sha256('raw-token'),
        userId: 'user-1',
        user: buildUser(),
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.refresh('raw-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(refreshRepo.delete).toHaveBeenCalledWith({ id: 'rt-old' });
    });
  });

  describe('logout', () => {
    it('apaga o token pelo hash', async () => {
      await service.logout('raw-token');
      expect(refreshRepo.delete).toHaveBeenCalledWith({
        tokenHash: sha256('raw-token'),
      });
    });

    it('é idempotente quando não há token', async () => {
      await service.logout(undefined);
      expect(refreshRepo.delete).not.toHaveBeenCalled();
    });
  });
});
