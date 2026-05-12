// SERVER ONLY
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

interface RateLimitOptions {
  /** Identificador único da operação (ex: 'login', 'reset') */
  scope: "login" | "reset" | "login-cliente";
  /** Identificador do recurso (ex: email do usuário) */
  identifier: string;
  /** Máximo de tentativas dentro da janela */
  maxAttempts: number;
  /** Janela em segundos */
  windowSeconds: number;
  /** Tempo de bloqueio depois de exceder (default: 15 min) */
  blockSeconds?: number;
}

/**
 * Checa rate limit. Cada chamada incrementa o contador.
 * Retorna `{ allowed: false, retryAfterSeconds: N }` quando bloqueado.
 *
 * Defense-in-depth do rate limit nativo do Supabase Auth (que protege
 * contra IPs específicos). Esta camada protege também por **email**, evitando
 * que um atacante distribuído (vários IPs) tente força bruta na mesma conta.
 */
export async function checkRateLimit(
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const supabase = createServiceRoleClient();
  const key = `${opts.scope}:${opts.identifier.toLowerCase().trim()}`;

  const { data, error } = await supabase.rpc("check_auth_rate_limit", {
    rate_key: key,
    max_attempts: opts.maxAttempts,
    window_seconds: opts.windowSeconds,
    block_seconds: opts.blockSeconds ?? 900,
  });

  if (error || !data || !Array.isArray(data) || data.length === 0) {
    // Falha aberta: se o rate-limit falha, permitimos a tentativa.
    // Caso contrário, um bug aqui derrubaria todo o login do sistema.
    console.error("[rate-limit] check failed:", error?.message);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const row = data[0] as { allowed: boolean; retry_after_seconds: number };
  return {
    allowed: row.allowed,
    retryAfterSeconds: row.retry_after_seconds,
  };
}

/**
 * Reseta o contador (chamar após sucesso pra evitar travar o usuário
 * que errou senha 4x e finalmente acertou).
 */
export async function resetRateLimit(
  scope: "login" | "reset" | "login-cliente",
  identifier: string,
): Promise<void> {
  const supabase = createServiceRoleClient();
  const key = `${scope}:${identifier.toLowerCase().trim()}`;
  await supabase.rpc("reset_auth_rate_limit", { rate_key: key });
}

export function formatRetryAfter(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} min`;
}
