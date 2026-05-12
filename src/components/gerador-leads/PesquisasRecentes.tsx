"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { STATUS_PESQUISA_DEFS } from "@/lib/gerador-leads/tipos";
import type { PesquisaRow } from "@/lib/gerador-leads/queries";

interface Props {
  pesquisas: PesquisaRow[];
}

/**
 * Mostra histórico recente de pesquisas. Faz polling a cada 5s quando tem
 * alguma rodando (status=pendente/processando) pra atualizar resultado.
 */
export function PesquisasRecentes({ pesquisas }: Props) {
  const router = useRouter();
  const temRodando = pesquisas.some((p) => p.status === "pendente" || p.status === "processando");

  useEffect(() => {
    if (!temRodando) return;
    const interval = setInterval(() => {
      router.refresh();
    }, 5000);
    return () => clearInterval(interval);
  }, [temRodando, router]);

  if (pesquisas.length === 0) {
    return (
      <Card className="p-4 text-center text-xs text-muted-foreground">
        Nenhuma pesquisa ainda. Clica em &quot;Nova pesquisa&quot; pra começar.
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {pesquisas.map((p) => {
        const statusDef = STATUS_PESQUISA_DEFS[p.status];
        const Icon = p.status === "pendente" ? Clock
          : p.status === "processando" ? Loader2
          : p.status === "erro" ? AlertCircle
          : CheckCircle2;
        return (
          <Card key={p.id} className="p-3 flex items-center gap-3">
            <Icon
              className={`h-4 w-4 ${p.status === "processando" ? "animate-spin text-amber-600" : p.status === "erro" ? "text-destructive" : p.status === "concluido" ? "text-emerald-600" : "text-muted-foreground"}`}
            />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="font-medium text-sm">
                  {p.nicho} <span className="text-muted-foreground">em</span> {p.cidade}
                </p>
                {statusDef && (
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusDef.color}`}>
                    {statusDef.label}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {p.criado_por_nome ?? "Alguém"} · {new Date(p.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                {p.status === "concluido" && (
                  <>
                    {" · "}
                    <strong className="text-emerald-700 dark:text-emerald-400">{p.total_resultados}</strong> resultado(s)
                    {p.total_novos < p.total_resultados && (
                      <span className="text-muted-foreground"> ({p.total_novos} novos, {p.total_resultados - p.total_novos} duplicados)</span>
                    )}
                  </>
                )}
              </p>
              {p.erro_mensagem && (
                <p className="text-[11px] text-destructive mt-1">{p.erro_mensagem}</p>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
