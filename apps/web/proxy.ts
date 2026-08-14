import { NextResponse, type NextRequest } from "next/server";
import { AUTH_FLAG_COOKIE } from "@/lib/auth/flag-cookie";

// Next.js 16: o antigo `middleware.ts` foi renomeado para `proxy.ts` (mesma função).

const PROTECTED_ROUTES = ["/dashboard"];
const AUTH_ROUTES = ["/login", "/register"];

/**
 * Guard OTIMISTA: redireciona sem flash com base na presença do cookie flag
 * `estudeai_auth` (setado pelo client no domínio web — sem segredo).
 * A validação real é do AuthGuard; aqui apenas melhoramos a UX.
 */
export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has(AUTH_FLAG_COOKIE);

  const isProtected = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  const isAuthRoute = AUTH_ROUTES.includes(pathname);

  if (isProtected && !hasSession) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (isAuthRoute && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$|favicon.ico).*)"],
};
