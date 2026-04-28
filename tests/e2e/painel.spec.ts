import { test, expect } from "@playwright/test";

test("rota /painel redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/painel");
  await expect(page).toHaveURL(/\/login/);
});
