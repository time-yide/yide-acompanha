import { test, expect } from "@playwright/test";

test("rota /satisfacao redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/satisfacao");
  await expect(page).toHaveURL(/\/login/);
});

test("rota /satisfacao/avaliar redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/satisfacao/avaliar");
  await expect(page).toHaveURL(/\/login/);
});

test("rota /clientes/[id]/satisfacao redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/clientes/00000000-0000-0000-0000-000000000000/satisfacao");
  await expect(page).toHaveURL(/\/login/);
});
