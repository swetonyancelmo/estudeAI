import { IsEmail, IsString, MinLength } from 'class-validator';
import type { LoginRequest } from '@estudeai/shared-types';

export class LoginDto implements LoginRequest {
  @IsEmail({}, { message: 'E-mail inválido.' })
  email: string;

  @IsString()
  @MinLength(1, { message: 'Senha obrigatória.' })
  password: string;
}
