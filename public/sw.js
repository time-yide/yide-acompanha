// Service Worker — Yide Digital PWA
// Versão básica: instala, ativa, e fica pronto pra receber Web Push (PR 2).
// Não faz cache offline aggressive — o app depende muito de dados ao vivo.

const SW_VERSION = "v1.0.0";

self.addEventListener("install", (event) => {
  // Ativa nova versão imediatamente, sem esperar tabs antigas fecharem.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Assume controle de todas as abas abertas assim que ativa.
  event.waitUntil(self.clients.claim());
});

// Fetch: passa direto pra rede. Cache vai entrar quando tiver shell offline
// (futuro). Por enquanto, comportamento idêntico a sem service worker —
// só o registro é necessário pra Web Push e pra "Adicionar à tela inicial".
self.addEventListener("fetch", (event) => {
  // Não interfere — deixa o browser lidar.
});

// === Web Push handlers (PR 2 vai popular) ===
// self.addEventListener("push", (event) => { ... });
// self.addEventListener("notificationclick", (event) => { ... });
