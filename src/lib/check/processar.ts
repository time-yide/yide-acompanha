// SERVER ONLY — chamado pelo reunioes-worker no passo de resumo.
import { casarCliente } from "./core";
import { extrairItensCheck } from "./extrator";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

/** Se a reunião é a gravação de um check-in, devolve o check; senão null. */
export async function checkDaReuniao(sb: SB, meetingId: string): Promise<{ id: string; assessor_id: string; status: string } | null> {
  const { data, error } = await sb
    .from("check_semanais")
    .select("id, assessor_id, status")
    .eq("meeting_id", meetingId)
    .maybeSingle();
  // Migration não aplicada → tabela não existe → trata como reunião comum.
  if (error) return null;
  return data ?? null;
}

/**
 * Extrai os itens do check-in com IA e grava como sugestões (origem 'ia').
 * Retorna "skip" quando a IA não está configurada (job volta pra fila).
 */
export async function processarCheckin(
  sb: SB,
  check: { id: string; assessor_id: string },
  textoCompleto: string,
): Promise<"ok" | "skip"> {
  const [{ data: assessor }, { data: clientes }] = await Promise.all([
    sb.from("profiles").select("nome").eq("id", check.assessor_id).maybeSingle(),
    sb.from("clients").select("id, nome").eq("assessor_id", check.assessor_id).in("status", ["ativo", "em_onboarding"]).order("nome"),
  ]);
  const carteira = (clientes ?? []) as Array<{ id: string; nome: string }>;

  const r = await extrairItensCheck({
    assessorNome: assessor?.nome ?? "assessor",
    clientes: carteira.map((c) => c.nome),
    textoCompleto,
  });
  if (!r.ok) {
    if (r.skipped) return "skip";
    throw new Error(r.error ?? "extração do check-in falhou");
  }

  const { count } = await sb
    .from("check_itens")
    .select("id", { count: "exact", head: true })
    .eq("check_id", check.id);
  const base = count ?? 0;

  if (r.itens.length > 0) {
    const { error } = await sb.from("check_itens").insert(
      r.itens.map((i, idx) => ({
        check_id: check.id,
        texto: i.texto,
        cliente_id: casarCliente(i.cliente, carteira),
        citacao: i.citacao,
        origem: "ia",
        ordem: base + idx,
      })),
    );
    if (error) throw new Error(`falha ao salvar itens do check: ${error.message}`);
  }

  await sb
    .from("check_semanais")
    .update({ status: "em_revisao", updated_at: new Date().toISOString() })
    .eq("id", check.id)
    .in("status", ["aberto", "processando"]);
  return "ok";
}
