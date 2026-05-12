import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { Database } from "@/types/database";

interface AuditEntry {
  entidade: string;
  entidade_id: string;
  acao: "create" | "update" | "soft_delete" | "delete" | "complete" | "reopen" | "approve";
  dados_antes?: Record<string, unknown>;
  dados_depois?: Record<string, unknown>;
  /**
   * UUID do ator humano. Use `null` quando a ação foi disparada por
   * automação/cron (ex.: auto-marcar entrega após 7 dias).
   * `audit_log.ator_id` é nullable no schema.
   */
  ator_id: string | null;
  justificativa?: string;
}

export async function logAudit(entry: AuditEntry) {
  const supabase = createServiceRoleClient();
  const insertData: Database["public"]["Tables"]["audit_log"]["Insert"] = {
    acao: entry.acao,
    entidade: entry.entidade,
    entidade_id: entry.entidade_id,
    ator_id: entry.ator_id,
    dados_antes: (entry.dados_antes ?? null) as Database["public"]["Tables"]["audit_log"]["Row"]["dados_antes"],
    dados_depois: (entry.dados_depois ?? null) as Database["public"]["Tables"]["audit_log"]["Row"]["dados_depois"],
    justificativa: entry.justificativa ?? null,
  };
  await supabase.from("audit_log").insert(insertData);
}
