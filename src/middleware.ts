import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";

const PUBLIC_PATHS = ["/login", "/recuperar-senha", "/definir-senha", "/auth/callback", "/monitoring"];

const LEGACY_HOST = "yide-acompanha.vercel.app";
const CANONICAL_HOST = "sistemaacompanha.yidedigital.com.br";

export async function middleware(request: NextRequest) {
  if (request.headers.get("host") === LEGACY_HOST) {
    const url = new URL(
      request.nextUrl.pathname + request.nextUrl.search,
      `https://${CANONICAL_HOST}`,
    );
    return NextResponse.redirect(url, { status: 308 });
  }

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p));

  // Expõe o pathname pra server components do (authed) layout poderem
  // condicionar UI (ex: esconder gate de pendência quando já está em /audiovisual).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  // Exclui assets estáticos da PWA pra middleware não interceptar e
  // corromper o Content-Type (manifest e service worker precisam ser
  // servidos limpos, sem cookies de auth/redirect).
  matcher: [
    // Os ícones do app (apple-icon, icon0/1/2) são rotas dinâmicas geradas
    // por next/og — NÃO terminam em .png, então precisam ser excluídos
    // explicitamente, senão o auth redireciona pro /login e o ícone não
    // carrega (manifest é público mas apontava pra ícone gated).
    "/((?!_next/static|_next/image|favicon|public|manifest\\.webmanifest|sw\\.js|apple-icon|icon0|icon1|icon2|.*\\.svg|.*\\.png).*)",
  ],
};
