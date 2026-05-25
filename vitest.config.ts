import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    exclude: ["node_modules", "dist", ".idea", ".git", ".cache", "tests/e2e"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Shims pra pacotes server-only que não resolvem no ambiente jsdom.
      "server-only": path.resolve(__dirname, "./tests/__mocks__/server-only.ts"),
      "web-push": path.resolve(__dirname, "./tests/__mocks__/web-push.ts"),
      "puppeteer-core": path.resolve(__dirname, "./tests/__mocks__/puppeteer-core.ts"),
      "@sparticuz/chromium": path.resolve(__dirname, "./tests/__mocks__/sparticuz-chromium.ts"),
    },
  },
});
