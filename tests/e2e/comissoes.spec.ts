import { test, expect } from "@playwright/test";

test("rota /comissoes redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/comissoes");
  await expect(page).toHaveURL(/\/login/);
});

test("rota /comissoes/minhas redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/comissoes/minhas");
  await expect(page).toHaveURL(/\/login/);
});

test("rota /comissoes/visao-geral redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/comissoes/visao-geral");
  await expect(page).toHaveURL(/\/login/);
});

test("rota /comissoes/fechamento redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/comissoes/fechamento");
  await expect(page).toHaveURL(/\/login/);
});

test("endpoint /api/cron/monthly-snapshot retorna 401 sem header de autorização", async ({ request }) => {
  const res = await request.get("/api/cron/monthly-snapshot");
  expect(res.status()).toBe(401);
});

test("endpoint /api/cron/monthly-snapshot retorna 401 com bearer errado", async ({ request }) => {
  const res = await request.get("/api/cron/monthly-snapshot", {
    headers: { authorization: "Bearer invalido" },
  });
  expect(res.status()).toBe(401);
});
