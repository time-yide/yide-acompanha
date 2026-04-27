import { test, expect } from "@playwright/test";

test("rota /calendario redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/calendario");
  await expect(page).toHaveURL(/\/login/);
});

test("rota /calendario/novo redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/calendario/novo");
  await expect(page).toHaveURL(/\/login/);
});
