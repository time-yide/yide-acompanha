import { test, expect } from "@playwright/test";

test("rota /prospeccao redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/prospeccao");
  await expect(page).toHaveURL(/\/login/);
});

test("rota /prospeccao/prospects redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/prospeccao/prospects");
  await expect(page).toHaveURL(/\/login/);
});

test("rota /prospeccao/historico redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/prospeccao/historico");
  await expect(page).toHaveURL(/\/login/);
});

test("rota /prospeccao/metas redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/prospeccao/metas");
  await expect(page).toHaveURL(/\/login/);
});

test("rota /prospeccao/funil redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/prospeccao/funil");
  await expect(page).toHaveURL(/\/login/);
});
