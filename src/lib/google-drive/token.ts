// SERVER ONLY: assina/valida o token que amarra o prepare ao confirm.
import { createHmac, timingSafeEqual } from "node:crypto";
import { CATEGORIA_VALUES, type CategoriaVideo } from "./naming";

/**
 * Token de sessão de upload: o `prepareDriveUpload` decide no servidor cliente,
 * categoria, pasta e nomes dos arquivos e devolve isso assinado (HMAC-SHA256).
 * O `confirmDriveUpload` só aceita o token — nada de clientId/pasta/categoria
 * vindos do navegador.
 */
export interface DriveUploadSessao {
  v: 1;
  /** Quem preparou (o confirm tem que vir do mesmo usuário). */
  uid: string;
  clientId: string;
  categoria: CategoriaVideo;
  folderId: string;
  notificarEditor: boolean;
  /** Arquivos esperados: nome no Drive → nome original. */
  arquivos: Array<{ driveFileName: string; originalName: string }>;
  /** Expiração em ms epoch. */
  exp: number;
}

/** Sessão resumável do Drive vale 1 semana; 24h cobre envios longos sem ficar eterno. */
export const DRIVE_UPLOAD_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Chave do HMAC derivada de um segredo do servidor (separação de domínio pra
 * não reaproveitar o segredo cru).
 */
export function derivarChaveToken(segredoServidor: string): Buffer {
  return createHmac("sha256", segredoServidor).update("google-drive-upload-token:v1").digest();
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function assinarSessaoUpload(sessao: DriveUploadSessao, chave: Buffer): string {
  const payload = b64url(Buffer.from(JSON.stringify(sessao), "utf8"));
  const sig = b64url(createHmac("sha256", chave).update(payload).digest());
  return `${payload}.${sig}`;
}

function isSessao(x: unknown): x is DriveUploadSessao {
  if (!x || typeof x !== "object") return false;
  const s = x as Record<string, unknown>;
  return (
    s.v === 1 &&
    typeof s.uid === "string" &&
    typeof s.clientId === "string" &&
    typeof s.categoria === "string" &&
    (CATEGORIA_VALUES as readonly string[]).includes(s.categoria) &&
    typeof s.folderId === "string" &&
    /^[A-Za-z0-9_-]+$/.test(s.folderId) &&
    typeof s.notificarEditor === "boolean" &&
    typeof s.exp === "number" &&
    Array.isArray(s.arquivos) &&
    s.arquivos.every(
      (a) =>
        !!a &&
        typeof (a as Record<string, unknown>).driveFileName === "string" &&
        typeof (a as Record<string, unknown>).originalName === "string",
    )
  );
}

export type VerificacaoToken =
  | { ok: true; sessao: DriveUploadSessao }
  | { ok: false; motivo: "formato" | "assinatura" | "expirado" | "usuario" };

export function verificarSessaoUpload(
  token: string,
  chave: Buffer,
  esperado: { uid: string; agora?: number },
): VerificacaoToken {
  const partes = token.split(".");
  if (partes.length !== 2 || !partes[0] || !partes[1]) return { ok: false, motivo: "formato" };
  const [payload, sig] = partes;

  const esperada = createHmac("sha256", chave).update(payload).digest();
  const recebida = fromB64url(sig);
  if (recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) {
    return { ok: false, motivo: "assinatura" };
  }

  let obj: unknown;
  try {
    obj = JSON.parse(fromB64url(payload).toString("utf8"));
  } catch {
    return { ok: false, motivo: "formato" };
  }
  if (!isSessao(obj)) return { ok: false, motivo: "formato" };
  if (obj.exp < (esperado.agora ?? Date.now())) return { ok: false, motivo: "expirado" };
  if (obj.uid !== esperado.uid) return { ok: false, motivo: "usuario" };
  return { ok: true, sessao: obj };
}
