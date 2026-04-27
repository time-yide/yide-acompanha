import { test, expect } from "@playwright/test";

test("rota /configuracoes/notificacoes redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/configuracoes/notificacoes");
  await expect(page).toHaveURL(/\/login/);
});

test("endpoint /api/cron/daily-digest retorna 401 sem header de autorização", async ({ request }) => {
  const res = await request.get("/api/cron/daily-digest");
  expect(res.status()).toBe(401);
});

test("endpoint /api/cron/daily-digest retorna 401 com bearer errado", async ({ request }) => {
  const res = await request.get("/api/cron/daily-digest", {
    headers: { authorization: "Bearer invalido" },
  });
  expect(res.status()).toBe(401);
});
