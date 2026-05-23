import { createHmac, timingSafeEqual } from "crypto";

const TTL_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Assina token HMAC com payload "timestamp.hmac" pra autorizar Puppeteer
 * a buscar a rota interna /api/internal/apresenta-yide-pdf/[id].
 * O token amarra (id, timestamp, secret) - não dá pra reusar com outro id
 * nem fora da janela de 5 min.
 */
export function signPdfToken(apresentacaoId: string, secret: string): string {
  const ts = Date.now().toString();
  const payload = `${apresentacaoId}.${ts}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${ts}.${sig}`;
}

export function verifyPdfToken(
  apresentacaoId: string,
  token: string,
  secret: string,
): boolean {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [tsStr, sig] = parts;
  const ts = parseInt(tsStr, 10);
  if (!Number.isFinite(ts)) return false;
  // Verifica janela de validade
  const age = Date.now() - ts;
  if (age < 0 || age > TTL_MS) return false;

  const expectedSig = createHmac("sha256", secret)
    .update(`${apresentacaoId}.${tsStr}`)
    .digest("hex");
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expectedSig, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
