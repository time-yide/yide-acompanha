import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const acaoLabel: Record<string, string> = {
  create: "Criado",
  update: "Atualizado",
  soft_delete: "Marcado como churn",
  approve: "Aprovado",
};

export default async function HistoricoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  if (!["adm", "socio"].includes(user.role)) redirect(`/clientes/${id}`);

  const supabase = await createClient();
  const { data: entries = [] } = await supabase
    .from("audit_log")
    .select(`
      id, acao, dados_antes, dados_depois, justificativa, created_at,
      ator:profiles!audit_log_ator_id_fkey(nome)
    `)
    .eq("entidade", "clients")
    .eq("entidade_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold">Histórico de mudanças</h2>
        <p className="text-xs text-muted-foreground">Audit log de tudo que mudou no cadastro deste cliente.</p>
      </header>
      {(entries ?? []).length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Sem alterações registradas.</Card>
      ) : (
        <ul className="space-y-2">
          {(entries ?? []).map((e) => (
            <li key={e.id}>
              <Card className="p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">{acaoLabel[e.acao] ?? e.acao}</Badge>
                  {/* @ts-expect-error nested */}
                  <span>{e.ator?.nome ?? "—"}</span>
                  <span>·</span>
                  <span>{new Date(e.created_at).toLocaleString("pt-BR")}</span>
                </div>
                {e.justificativa && (
                  <p className="mt-1 text-sm">{e.justificativa}</p>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
