import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_PATHS = ["/login", "/cadastro", "/api/cron"];
const SET_PASSWORD = "/definir-senha";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/") return NextResponse.next(); // landing pública
  // Auto-cadastro só quando ligado de propósito: por padrão a equipe entra
  // pelo "Adicionar membro" do admin, e ninguém de fora cria conta.
  if (pathname.startsWith("/cadastro") && process.env.ALLOW_SELF_SIGNUP !== "true") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const token = request.cookies.get("polimatas_session")?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(
        token,
        new TextEncoder().encode(process.env.SESSION_SECRET ?? "dev-secret")
      );
      // Conta criada pelo admin com senha temporária: nada abre até a troca.
      if (payload.mustChangePassword === true && !pathname.startsWith(SET_PASSWORD)) {
        const url = request.nextUrl.clone();
        url.pathname = SET_PASSWORD;
        return NextResponse.redirect(url);
      }
      return NextResponse.next();
    } catch {
      /* token inválido → login */
    }
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|logo.svg).*)"],
};
