// Contrato de autenticação compartilhado entre apps/web e apps/api.
// Interfaces puras (sem dependências de framework), no mesmo padrão de HealthStatusDto.
// O backend define classes DTO que `implements` estas interfaces — o tipo é definido uma única vez aqui.

export interface UserDto {
  id: string;
  email: string;
  /** ISO 8601 */
  createdAt: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Resposta de register/login/refresh.
 * O refresh token NÃO trafega aqui — ele vai num cookie httpOnly setado pela API.
 */
export interface AuthResponse {
  accessToken: string;
  user: UserDto;
}
