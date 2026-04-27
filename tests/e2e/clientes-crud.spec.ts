import { test, expect } from "@playwright/test";

test("rota /clientes redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/clientes");
  await expect(page).toHaveURL(/\/login/);
});

test("rota /clientes/importar redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/clientes/importar");
  await expect(page).toHaveURL(/\/login/);
});

test("rota /tarefas redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/tarefas");
  await expect(page).toHaveURL(/\/login/);
});

test("rota /tarefas/nova redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/tarefas/nova");
  await expect(page).toHaveURL(/\/login/);
});
