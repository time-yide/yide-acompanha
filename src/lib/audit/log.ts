import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { Database } from "@/types/database";

interface AuditEntry {
  entidade: string;
  entidade_id: string;
  acao: "create" | "update" | "soft_delete" | "approve";
  dados_antes?: Record<string, unknown>;
  dados_depois?: Record<string, unknown>;
  ator_id: string;
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
