import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import type { RegisterRequest } from '@estudeai/shared-types';

export class RegisterDto implements RegisterRequest {
  @IsEmail({}, { message: 'E-mail inválido.' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'A senha deve ter ao menos 8 caracteres.' })
  @MaxLength(72, { message: 'A senha deve ter no máximo 72 caracteres.' })
  password: string;
}
