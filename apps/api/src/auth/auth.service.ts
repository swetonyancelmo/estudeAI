import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { randomBytes, createHash } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import type { AuthResponse, UserDto } from '@estudeai/shared-types';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import type { JwtPayload } from './strategies/jwt.strategy';

const BCRYPT_COST = 12;
const REFRESH_TOKEN_BYTES = 32;

/**
 * Resultado de qualquer operação que emite sessão. O `refreshToken` é o valor
 * bruto (texto puro) que o controller coloca no cookie httpOnly — nunca vai no body.
 */
export interface IssuedSession {
  response: AuthResponse;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
  ) {}

  async register(email: string, password: string): Promise<IssuedSession> {
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new ConflictException('E-mail já cadastrado.');
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    const user = await this.usersService.create(email, passwordHash);
    return this.issueSession(user);
  }

  /** Usado pela LocalStrategy. Retorna o usuário quando as credenciais batem. */
  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return null;
    }
    const matches = await bcrypt.compare(password, user.passwordHash);
    return matches ? user : null;
  }

  /** Login: o usuário já foi validado pela LocalStrategy/LocalAuthGuard. */
  login(user: User): Promise<IssuedSession> {
    return this.issueSession(user);
  }

  /**
   * Rotação: valida o refresh token do cookie, invalida o registro atual e emite
   * um novo par. Um token bruto que não existe mais no banco (mas era válido)
   * indica reuso → revogamos todas as sessões do usuário por segurança.
   */
  async refresh(rawToken: string): Promise<IssuedSession> {
    const tokenHash = this.hashToken(rawToken);
    const record = await this.refreshTokens.findOne({
      where: { tokenHash },
      relations: { user: true },
    });

    if (!record) {
      throw new UnauthorizedException('Refresh token inválido.');
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      await this.refreshTokens.delete({ id: record.id });
      throw new UnauthorizedException('Refresh token expirado.');
    }

    // Rotação: o token atual não pode ser reutilizado.
    await this.refreshTokens.delete({ id: record.id });
    return this.issueSession(record.user);
  }

  /** Logout: invalida o refresh token atual (idempotente). */
  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) {
      return;
    }
    await this.refreshTokens.delete({ tokenHash: this.hashToken(rawToken) });
  }

  private async issueSession(user: User): Promise<IssuedSession> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = await this.jwtService.signAsync(payload);

    const rawToken = randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    const expiresAt = this.refreshExpiry();

    await this.pruneExpired(user.id);
    await this.refreshTokens.save(
      this.refreshTokens.create({
        tokenHash: this.hashToken(rawToken),
        userId: user.id,
        expiresAt,
      }),
    );

    return {
      response: { accessToken, user: this.toUserDto(user) },
      refreshToken: rawToken,
      refreshTokenExpiresAt: expiresAt,
    };
  }

  /** SHA-256 é suficiente: o token é de alta entropia (não é senha) e permite lookup indexado. */
  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private refreshExpiry(): Date {
    const days = Number(this.config.get<string>('REFRESH_TTL_DAYS', '7'));
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private pruneExpired(userId: string): Promise<unknown> {
    return this.refreshTokens.delete({
      userId,
      expiresAt: LessThan(new Date()),
    });
  }

  private toUserDto(user: User): UserDto {
    return {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
