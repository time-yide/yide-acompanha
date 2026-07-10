// Injeta a versão do deploy no service worker (public/sw.js) no build.
// Substitui o SW_VERSION pelo hash do commit (Vercel) ou um timestamp local.
// Toda atualização vira um sw.js diferente → o navegador troca o SW e o
// PWARegister recarrega a página sozinho (fim do "preciso limpar o cache").
//
// Robusto de propósito: NUNCA derruba o build. Se algo falhar, só loga e segue.
import { readFile, writeFile } from "node:fs/promises";

const SW_PATH = new URL("../public/sw.js", import.meta.url);

const version =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ||
  process.env.VERCEL_DEPLOYMENT_ID ||
  `local-${Date.now()}`;

try {
  const src = await readFile(SW_PATH, "utf8");
  const out = src.replace(/const SW_VERSION = "[^"]*";/, `const SW_VERSION = "${version}";`);
  if (out === src) {
    console.warn("[sw] linha SW_VERSION não encontrada — nada a injetar (ok)");
  } else {
    await writeFile(SW_PATH, out);
    console.log(`[sw] SW_VERSION → "${version}"`);
  }
} catch (err) {
  console.warn("[sw] injeção de versão falhou (ignorando):", err?.message ?? err);
}
