import { test, expect } from "@playwright/test";

test("rota /tarefas redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/tarefas");
  await expect(page).toHaveURL(/\/login/);
});

test("rota /tarefas/nova redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/tarefas/nova");
  await expect(page).toHaveURL(/\/login/);
});

test("rota /notificacoes redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/notificacoes");
  await expect(page).toHaveURL(/\/login/);
});

test("rota /tarefas/[id] redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/tarefas/00000000-0000-0000-0000-000000000000");
  await expect(page).toHaveURL(/\/login/);
});
