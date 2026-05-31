// Service Worker — Yide Digital PWA
// Recebe Web Push e mostra notificação nativa do SO. Click leva pra rota
// da notificação (ou pra home se sem link).

const SW_VERSION = "v1.3.0";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Sem cache offline por enquanto.
});

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
