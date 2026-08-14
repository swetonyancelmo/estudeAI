/**
 * Cookie "flag" de presença de sessão, gravado no DOMÍNIO WEB pelo próprio client.
 *
 * Por que existe: o refresh token httpOnly é setado pela API em OUTRO domínio
 * (em prod, Vercel web + Render api) e não é legível pelo proxy.ts do Next.
 * Este cookie NÃO contém segredo algum — só a informação "há uma sessão" — e
 * serve exclusivamente para o proxy.ts fazer redirect otimista sem flash.
 * A fonte da verdade continua sendo o AuthGuard (que valida via /auth/refresh).
 */
export const AUTH_FLAG_COOKIE = "estudeai_auth";

const MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export function setAuthFlag(): void {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${AUTH_FLAG_COOKIE}=1; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

export function clearAuthFlag(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_FLAG_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
