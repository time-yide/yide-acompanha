// SERVER ONLY: nunca importar de Client Components
import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Criptografia AES-256-GCM pra senhas armazenadas no banco.
 *
 * Formato armazenado: "iv_hex:authtag_hex:ciphertext_hex" (3 partes separadas por ":")
 * - IV (12 bytes): novo a cada criptografia, garante que mesmo plaintext gera
 *   ciphertext diferente (segurança contra análise de padrões).
 * - Auth tag (16 bytes): valida integridade. Se alguém alterar o ciphertext
 *   no DB, decrypt falha — não dá pra forjar senha.
 * - Ciphertext: o conteúdo cifrado.
 *
 * Chave: 32 bytes (AES-256) lida de `CREDENTIALS_ENCRYPTION_KEY` (env var,
 * formato hex de 64 chars). Se essa chave vazar, todas as senhas no banco
 * podem ser decifradas — então fica em Vercel env vars (Production-only),
 * nunca commitada.
 *
 * Rotação de chave: não suportada nesta v1. Trocar a chave invalida todas
 * as credenciais existentes. Mitigação: credenciais raramente mudam, e
 * usuários podem regravar quando precisarem.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;

function getKey(): Buffer {
  const hex = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      "CREDENTIALS_ENCRYPTION_KEY não configurada. Gere uma com: openssl rand -hex 32",
    );
  }
  const key = Buffer.from(hex, "hex");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `CREDENTIALS_ENCRYPTION_KEY deve ter ${KEY_BYTES} bytes (${KEY_BYTES * 2} chars hex), recebido ${key.length} bytes`,
    );
  }
  return key;
}

export function encryptPassword(plaintext: string): string {
  if (!plaintext) throw new Error("Senha vazia");
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptPassword(stored: string): string {
  const parts = stored.split(":");
  if (parts.length !== 3) {
    throw new Error("Formato inválido. Esperado iv:tag:ciphertext");
  }
  const [ivHex, tagHex, ciphertextHex] = parts;
  const key = getKey();
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}
