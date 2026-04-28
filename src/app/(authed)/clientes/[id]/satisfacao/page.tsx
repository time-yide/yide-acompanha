import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getSynthesisHistory } from "@/lib/satisfacao/queries";
import { SatisfactionSparkline } from "@/components/satisfacao/SatisfactionSparkline";
import { WeeklySatisfactionDetail } from "@/components/satisfacao/WeeklySatisfactionDetail";

export default async function ClienteSatisfacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAuth();

  const supabase = await createClient();
  const { data: cliente } = await supabase
    .from("clients")
    .select("id, nome")
    .eq("id", id)
    .single();
  if (!cliente) notFound();

  const history = await getSynthesisHistory(id, 52); // até 1 ano

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h2 className="text-xl font-bold tracking-tight">Satisfação histórica</h2>
        <SatisfactionSparkline clientId={id} size="md" />
        <p className="text-xs text-muted-foreground">
          {history.length} {history.length === 1 ? "semana avaliada" : "semanas avaliadas"}
        </p>
      </header>

      {history.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          Sem histórico de satisfação ainda.
        </p>
      ) : (
        <div className="space-y-3">
          {history.map((s) => (
            <WeeklySatisfactionDetail
              key={s.id}
              clientId={id}
              weekIso={s.semana_iso}
              scoreFinal={Number(s.score_final)}
              corFinal={s.cor_final}
              resumoIa={s.resumo_ia}
              divergenciaDetectada={s.divergencia_detectada}
              acaoSugerida={s.acao_sugerida}
            />
          ))}
        </div>
      )}
    </div>
  );
}
