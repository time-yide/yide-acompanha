"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { parseBulkImport } from "./import";
import { inferTipoPacote } from "./schema";

export async function bulkImportClientesAction(formData: FormData) {
  const actor = await requireAuth();
  if (!["adm", "socio"].includes(actor.role)) {
    throw new Error("Apenas ADM/Sócio podem importar clientes em lote");
  }

  const text = String(formData.get("import_text") ?? "");
  if (!text.trim()) throw new Error("Cole os dados antes de importar");

  const parsed = parseBulkImport(text);

  if (parsed.errors.length > 0 && parsed.rows.length === 0) {
    throw new Error(`Nenhuma linha válida. ${parsed.errors.length} erro(s).`);
  }

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").limit(1).single();
  if (!org) throw new Error("Organização não encontrada");

  const today = new Date().toISOString().slice(0, 10);
  const payload = parsed.rows.map((r) => ({
    organization_id: org.id,
    nome: r.nome,
    valor_mensal: r.valor_mensal,
    servico_contratado: r.servico_contratado,
    data_entrada: today,
    tipo_pacote: inferTipoPacote(r.servico_contratado),
  }));

  const { data: inserted, error } = await supabase
    .from("clients")
    .insert(payload)
    .select("id, nome");

  if (error) throw new Error(error.message);

  for (const row of inserted ?? []) {
    await logAudit({
      entidade: "clients",
      entidade_id: row.id,
      acao: "create",
      dados_depois: { nome: row.nome, source: "bulk_import" },
      ator_id: actor.id,
    });
  }

  revalidatePath("/clientes");
  redirect(`/clientes?imported=${inserted?.length ?? 0}`);
}
