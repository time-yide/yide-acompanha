import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";

const PUBLIC_PATHS = ["/login", "/recuperar-senha", "/definir-senha", "/auth/callback", "/monitoring", "/aprovacao-design", "/aprovacao-post", "/cliente/login"];

// Paths do portal cliente — middleware deixa passar pra page-level
// `requireClientPortalAuth()` validar (que checa também `client_portal_users.ativo`).
// Aqui só garantimos que tenha sessão Supabase válida.
const CLIENT_PORTAL_PATHS_PREFIX = "/cliente";

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
  const isClientPortalPath = pathname.startsWith(CLIENT_PORTAL_PATHS_PREFIX);

  // `kind` foi setado no auth.user_metadata em createUser (action de criar
  // acesso ao portal). Permite o middleware diferenciar portal cliente x
  // colaborador interno SEM um round-trip pro DB toda request.
  const userKind = user?.user_metadata?.kind as string | undefined;
  const isClientPortalUser = userKind === "client_portal";

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = isClientPortalPath ? "/cliente/login" : "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // Cliente portal logado tentando rota interna → manda pro painel cliente.
  // Evita loop infinito de /login ↔ / quando cliente portal user (sem
  // profile) cai no requireAuth interno.
  if (user && isClientPortalUser && !isClientPortalPath) {
    return NextResponse.redirect(new URL("/cliente", request.url));
  }

  // Colaborador interno tentando portal cliente → manda pro dashboard interno.
  if (user && !isClientPortalUser && isClientPortalPath && pathname !== "/cliente/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (user && pathname === "/cliente/login") {
    return NextResponse.redirect(new URL("/cliente", request.url));
  }

  return response;
}

export const config = {
  // Exclui assets estáticos da PWA pra middleware não interceptar e
  // corromper o Content-Type (manifest e service worker precisam ser
  // servidos limpos, sem cookies de auth/redirect).
  //
  // Também exclui `api/cron/*` e `api/webhooks/*` — esses endpoints são
  // chamados sem cookies de usuário (Vercel Cron, integrações externas),
  // então não faz sentido rodar `auth.getUser()` (~1 round-trip HTTP) neles.
  // Eles validam autenticação pelo próprio header (CRON_SECRET, signature
  // do webhook, etc).
  matcher: [
    "/((?!_next/static|_next/image|favicon|public|manifest\\.webmanifest|sw\\.js|api/cron|api/webhooks|.*\\.svg|.*\\.png).*)",
  ],
};
