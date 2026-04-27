import { test, expect } from "@playwright/test";

test("rota /onboarding redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/login/);
});

test("rota /onboarding/novo redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/onboarding/novo");
  await expect(page).toHaveURL(/\/login/);
});
