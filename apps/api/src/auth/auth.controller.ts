import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import type { AuthResponse, UserDto } from '@estudeai/shared-types';
import { AuthService, IssuedSession } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedUser } from './strategies/jwt.strategy';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';

const REFRESH_COOKIE = 'estudeai_rt';
/** Escopo do cookie: só é enviado para as rotas de auth sob o prefixo global api/v1. */
const REFRESH_COOKIE_PATH = '/api/v1/auth';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const session = await this.authService.register(dto.email, dto.password);
    this.setRefreshCookie(res, session);
    return session.response;
  }

  @Post('login')
  @UseGuards(LocalAuthGuard)
  @HttpCode(HttpStatus.OK)
  async login(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    // A LocalStrategy anexa a entidade User completa ao request.
    const session = await this.authService.login(req.user as User);
    this.setRefreshCookie(res, session);
    return session.response;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const rawToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!rawToken) {
      // Sem cookie não há sessão a renovar.
      throw new UnauthorizedException('Sessão não encontrada.');
    }
    const session = await this.authService.refresh(rawToken);
    this.setRefreshCookie(res, session);
    return session.response;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const rawToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    await this.authService.logout(rawToken);
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() current: AuthenticatedUser): Promise<UserDto> {
    const user = await this.usersService.findById(current.id);
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    return {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    };
  }

  private setRefreshCookie(res: Response, session: IssuedSession): void {
    res.cookie(REFRESH_COOKIE, session.refreshToken, this.refreshCookieOptions(session.refreshTokenExpiresAt));
  }

  private refreshCookieOptions(expires: Date): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
      expires,
    };
  }
}
