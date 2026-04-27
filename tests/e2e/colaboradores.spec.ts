import { test, expect } from "@playwright/test";

test("rota /colaboradores redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/colaboradores");
  await expect(page).toHaveURL(/\/login/);
});

test("rota /colaboradores/novo redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/colaboradores/novo");
  await expect(page).toHaveURL(/\/login/);
});

test("rota /colaboradores/[id] redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/colaboradores/00000000-0000-0000-0000-000000000000");
  await expect(page).toHaveURL(/\/login/);
});

test("rota /colaboradores/[id]/editar redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/colaboradores/00000000-0000-0000-0000-000000000000/editar");
  await expect(page).toHaveURL(/\/login/);
});
