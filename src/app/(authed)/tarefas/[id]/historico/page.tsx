import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const ACAO_LABEL: Record<string, string> = {
  create: "Criada",
  update: "Atualizada",
  soft_delete: "Excluída",
  delete: "Excluída",
  complete: "Concluída",
  reopen: "Reaberta",
  approve: "Aprovada",
};

const ACAO_TONE: Record<string, string> = {
  create: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/40",
  update: "bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/40",
  complete: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40",
  reopen: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/40",
  approve: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40",
  delete: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40",
  soft_delete: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40",
};

interface AuditEntry {
  id: string;
  acao: string;
  dados_antes: Record<string, unknown> | null;
  dados_depois: Record<string, unknown> | null;
  justificativa: string | null;
  created_at: string;
  ator: { nome: string } | null;
}

/**
 * Campos relevantes pra exibir no diff. Pula campos técnicos
 * (id, organization_id, timestamps gerenciados automaticamente).
 */
const TRACKED_FIELDS: Array<{ key: string; label: string }> = [
  { key: "titulo", label: "Título" },
  { key: "descricao", label: "Descrição" },
  { key: "status", label: "Status" },
  { key: "prioridade", label: "Prioridade" },
  { key: "tipo", label: "Tipo" },
  { key: "atribuido_a", label: "Responsável" },
  { key: "participantes_ids", label: "Participantes" },
  { key: "client_id", label: "Cliente" },
  { key: "due_date", label: "Prazo" },
  { key: "drive_link", label: "Link da entrega" },
  { key: "artes_entregues", label: "Quantidade entregue" },
  { key: "entrega_observacoes", label: "Observações da entrega" },
];

function formatValue(v: unknown, profileNames: Map<string, string>): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (Array.isArray(v)) {
    if (v.length === 0) return "—";
    return v.map((x) => (typeof x === "string" ? profileNames.get(x) ?? x : String(x))).join(", ");
  }
  if (typeof v === "string") {
    // Tenta resolver UUID pra nome (atribuido_a, client_id etc.)
    return profileNames.get(v) ?? v;
  }
  return String(v);
}

function computeDiff(
  before: Record<string, unknown> | null,
  depois: Record<string, unknown> | null,
): Array<{ label: string; key: string; antes: unknown; depois: unknown }> {
  if (!depois && !before) return [];
  const diffs: Array<{ label: string; key: string; antes: unknown; depois: unknown }> = [];
  for (const { key, label } of TRACKED_FIELDS) {
    const a = before?.[key];
    const d = depois?.[key];
    // Compara via JSON pra arrays/objetos não darem falso positivo
    if (JSON.stringify(a) !== JSON.stringify(d)) {
      diffs.push({ key, label, antes: a, depois: d });
    }
  }
  return diffs;
}

export default async function TarefaHistoricoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAuth();

  const supabase = await createClient();

  // Verifica que a tarefa existe (mesmo soft-deletada — histórico continua acessível)
  const { data: task } = await supabase
    .from("tasks")
    .select("id, titulo")
    .eq("id", id)
    .maybeSingle();
  if (!task) notFound();

  // Restringe acesso ao histórico: adm/sócio/coord/assessor ou quem mexeu na task.
  // (Por simplicidade, libera pra adm/sócio/coord/assessor. Outros roles vêem o detalhe
  //  da tarefa em si, mas não esse histórico granular.)
  const ROLES_QUE_VEEM_HISTORICO = ["adm", "socio", "coordenador", "assessor", "audiovisual_chefe"];
  if (!ROLES_QUE_VEEM_HISTORICO.includes(user.role)) {
    notFound();
  }

  const { data: entries = [] } = await supabase
    .from("audit_log")
    .select(`
      id, acao, dados_antes, dados_depois, justificativa, created_at,
      ator:profiles!audit_log_ator_id_fkey(nome)
    `)
    .eq("entidade", "tasks")
    .eq("entidade_id", id)
    .order("created_at", { ascending: false });

  // Coleta UUIDs que aparecem nos dados pra resolver nomes
  const uuidsToResolve = new Set<string>();
  for (const e of (entries ?? []) as unknown as AuditEntry[]) {
    for (const data of [e.dados_antes, e.dados_depois]) {
      if (!data) continue;
      const candidates = [data.atribuido_a, data.client_id, data.criado_por].filter(
        (v): v is string => typeof v === "string",
      );
      candidates.forEach((u) => uuidsToResolve.add(u));
      if (Array.isArray(data.participantes_ids)) {
        for (const pid of data.participantes_ids) {
          if (typeof pid === "string") uuidsToResolve.add(pid);
        }
      }
    }
  }

  // Resolve UUIDs pra nomes (profiles + clients)
  const profileNames = new Map<string, string>();
  if (uuidsToResolve.size > 0) {
    const ids = Array.from(uuidsToResolve);
    const [{ data: profiles }, { data: clients }] = await Promise.all([
      supabase.from("profiles").select("id, nome").in("id", ids),
      supabase.from("clients").select("id, nome").in("id", ids),
    ]);
    for (const p of (profiles ?? []) as Array<{ id: string; nome: string }>) {
      profileNames.set(p.id, p.nome);
    }
    for (const c of (clients ?? []) as Array<{ id: string; nome: string }>) {
      profileNames.set(c.id, c.nome);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Histórico</h1>
          <p className="text-sm text-muted-foreground">{task.titulo}</p>
        </div>
        <Link href={`/tarefas/${id}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Voltar pra tarefa
          </Button>
        </Link>
      </div>

      {(entries ?? []).length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Sem alterações registradas.
        </Card>
      ) : (
        <ul className="space-y-3">
          {((entries ?? []) as unknown as AuditEntry[]).map((e) => {
            const diffs = computeDiff(e.dados_antes, e.dados_depois);
            return (
              <li key={e.id}>
                <Card className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge
                      variant="outline"
                      className={ACAO_TONE[e.acao] ?? "bg-muted text-muted-foreground"}
                    >
                      {ACAO_LABEL[e.acao] ?? e.acao}
                    </Badge>
                    <span className="font-medium">{e.ator?.nome ?? "—"}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">
                      {new Date(e.created_at).toLocaleString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {e.justificativa && (
                    <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm italic">
                      {e.justificativa}
                    </p>
                  )}

                  {diffs.length > 0 && (
                    <ul className="space-y-1.5 border-l-2 border-muted-foreground/20 pl-3 text-sm">
                      {diffs.map((d) => (
                        <li key={d.key} className="space-y-0.5">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {d.label}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-rose-700 line-through dark:text-rose-300">
                              {formatValue(d.antes, profileNames)}
                            </span>
                            <span className="text-muted-foreground">→</span>
                            <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-300">
                              {formatValue(d.depois, profileNames)}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Caso create — só dados_depois, sem diff. Mostra resumo. */}
                  {e.acao === "create" && diffs.length === 0 && (
                    <p className="text-xs italic text-muted-foreground">
                      Tarefa criada com os dados iniciais.
                    </p>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
