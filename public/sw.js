// Service Worker — Yide Digital PWA
// Recebe Web Push e mostra notificação nativa do SO. Click leva pra rota
// da notificação (ou pra home se sem link).

const SW_VERSION = "v1.4.0";
// Cache versionado pelo SW_VERSION. Bumpar a versão = novo cache + limpeza do
// antigo no activate. É o kill-switch: qualquer deploy que mude o SW_VERSION
// zera tudo que estava cacheado.
const STATIC_CACHE = `static-${SW_VERSION}`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Apaga caches de versões anteriores pra não acumular nem servir lixo
      // velho (foi o que mordeu a gente no "cache antigo no iPhone").
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

// Estratégia de cache — conservadora de propósito:
//
// - HTML (navegações) e payloads RSC: NUNCA cacheados. São auth-gated e
//   dinâmicos; o shell vem sempre da rede. É isso que evita servir página
//   velha/de outro usuário e o "cache antigo no iPhone".
// - /_next/static/* : chunks com hash no nome = imutáveis. cache-first pra
//   sempre. Deploy novo gera hash novo (URL nova) → busca da rede sozinho;
//   o chunk velho nunca mais é pedido. Zero risco de chunk-load-error.
// - imagens/ícones/fontes: stale-while-revalidate (mostra na hora, atualiza
//   em background).
// - resto (cross-origin Supabase/Sentry, POST, server actions): passa direto.
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Só GET. POST/PUT (server actions, mutations) vão sempre pra rede.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Só same-origin. Supabase storage, Sentry etc. ficam de fora.
  if (url.origin !== self.location.origin) return;

  // Nunca cacheia HTML nem RSC (conteúdo dinâmico, autenticado).
  if (request.mode === "navigate") return;
  if (request.headers.get("RSC") === "1") return;
  if (url.searchParams.has("_rsc")) return;

  // Assets versionados do Next (hash no nome → imutáveis): cache-first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Imagens otimizadas + estáticos de /public (logos, ícones, fontes):
  // podem trocar sem mudar a URL → stale-while-revalidate.
  if (
    url.pathname.startsWith("/_next/image") ||
    /\.(?:png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|otf)$/i.test(url.pathname)
  ) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Qualquer outra coisa: comportamento padrão (rede).
});

// Serve do cache se tiver; senão busca e guarda. Pra assets imutáveis.
async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  // Só cacheia respostas completas (200). Evita guardar 206/opaque/erro.
  if (response.ok && response.status === 200) {
    cache.put(request, response.clone());
  }
  return response;
}

// Serve do cache na hora (se tiver) e revalida em background. Se não tiver
// nada cacheado, espera a rede.
async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok && response.status === 200) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

// Recebe push e mostra notificação. Payload vem como JSON do server.
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Yide", body: event.data.text() };
  }

  const title = payload.title || "Yide";
  const urgent = payload.urgent === true;
  const options = {
    body: payload.body || "",
    icon: "/brand/logo-yide.png",
    badge: "/brand/logo-yide.png",
    tag: payload.tag || undefined,
    data: { url: payload.url || "/" },
    requireInteraction: urgent,
    ...(urgent && { vibrate: [200, 100, 200, 100, 200] }),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Click na notificação: foca tab existente OU abre nova.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Se já existe tab aberta no mesmo origin, foca e navega
      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client && targetUrl) {
            try { await client.navigate(targetUrl); } catch { /* ignora */ }
          }
          return;
        }
      }
      // Senão abre nova
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
