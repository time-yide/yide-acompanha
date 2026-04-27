import { test, expect } from "@playwright/test";

test("redireciona para /login quando não autenticado", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});

test("mostra a marca Yide na página de login", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByAltText("Yide Digital")).toBeVisible();
});

test("permanece em /login com credenciais inválidas", async ({ page }) => {
  await page.goto("/login");
  await page.fill("input[name=email]", "naoexiste@yide.com");
  await page.fill("input[name=password]", "senhaerrada123");
  await page.click("button[type=submit]");
  // Aguardar processamento do server action
  await page.waitForTimeout(2000);
  // Server action retorna error sem redirect — esperar permanecer em /login ou voltar
  await expect(page).toHaveURL(/\/login/);
});
